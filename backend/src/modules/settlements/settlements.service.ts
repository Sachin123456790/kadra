import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async requestValidation(
    subscriptionId: string,
    input: {
      paymentDocumentId: string;
      declaredAmount: string;
      declaredCurrency: string;
      declaredReference: string;
    },
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundError('Subscription', subscriptionId);
    if (subscription.status !== 'PENDING') {
      throw new ConflictError(
        'SUBSCRIPTION_NOT_PENDING',
        'Subscription must be PENDING for validation',
      );
    }

    // Verify payment document exists
    const paymentDoc = await this.prisma.document.findUnique({
      where: { id: input.paymentDocumentId },
    });
    if (!paymentDoc)
      throw new NotFoundError('PaymentDocument', input.paymentDocumentId);

    const record = await this.prisma.settlementRecord.create({
      data: {
        subscriptionId,
        status: 'REQUESTED',
        expectedAmount: subscription.committedAmount,
        receivedAmount: input.declaredAmount,
        expectedCurrency: subscription.currency,
        receivedCurrency: input.declaredCurrency,
      },
    });

    // Run validation inline for MVP
    const result = await this.runValidation(record.id, subscription, input);
    return result;
  }

  private async runValidation(
    settlementRecordId: string,
    subscription: any,
    input: {
      paymentDocumentId: string;
      declaredAmount: string;
      declaredReference: string;
    },
  ) {
    await this.prisma.settlementRecord.update({
      where: { id: settlementRecordId },
      data: { status: 'VERIFYING' },
    });

    const checkAmountMatch =
      parseFloat(input.declaredAmount) ===
      parseFloat(subscription.committedAmount.toString());
    const checkReferenceMatch =
      input.declaredReference === subscription.subscriptionRef;

    // Investor match: verify payment document is linked to the subscription's investor
    const paymentDoc = await this.prisma.document.findUnique({
      where: { id: input.paymentDocumentId },
    });
    let checkInvestorMatch = false;
    if (paymentDoc) {
      if (
        paymentDoc.linkedEntityType === 'INVESTOR' &&
        paymentDoc.linkedEntityId != null
      ) {
        // Direct link: payment doc references a specific investor
        checkInvestorMatch =
          paymentDoc.linkedEntityId === subscription.investorId;
      } else {
        // Fallback: verify payment doc belongs to the same fund as the subscription
        checkInvestorMatch = paymentDoc.fundId === subscription.fundId;
      }
    }

    // Hash match: verify subscription's governing document hash record exists
    let checkHashMatch = false;
    if (subscription.governingHashId) {
      const governingHash = await this.prisma.documentHash.findUnique({
        where: { id: subscription.governingHashId },
      });
      checkHashMatch = governingHash != null;
    }

    // Check for double settlement
    const existingPassed = await this.prisma.settlementRecord.findFirst({
      where: { subscriptionId: subscription.id, status: 'PASSED' },
    });
    const checkNoDoubleSettlement = !existingPassed;

    const allPassed =
      checkAmountMatch &&
      checkReferenceMatch &&
      checkInvestorMatch &&
      checkHashMatch &&
      checkNoDoubleSettlement;

    let failureReasonCode: string | null = null;
    if (!checkAmountMatch) failureReasonCode = 'AMOUNT_MISMATCH';
    else if (!checkReferenceMatch) failureReasonCode = 'REFERENCE_MISMATCH';
    else if (!checkInvestorMatch) failureReasonCode = 'INVESTOR_MISMATCH';
    else if (!checkHashMatch) failureReasonCode = 'HASH_MISMATCH';
    else if (!checkNoDoubleSettlement) failureReasonCode = 'DOUBLE_SETTLEMENT';

    const now = new Date();
    const updated = await this.prisma.settlementRecord.update({
      where: { id: settlementRecordId },
      data: {
        status: allPassed ? 'PASSED' : 'FAILED',
        checkAmountMatch,
        checkInvestorMatch,
        checkReferenceMatch,
        checkHashMatch,
        checkNoDoubleSettlement,
        failureReasonCode,
        validatedAt: now,
      },
    });

    return {
      settlementRecordId: updated.id,
      status: updated.status,
      checks: {
        checkAmountMatch,
        checkInvestorMatch,
        checkReferenceMatch,
        checkHashMatch,
        checkNoDoubleSettlement,
      },
      failureReasonCode,
    };
  }

  async uploadPaymentEvidence(
    subscriptionId: string,
    input: {
      documentId: string;
      documentHashId?: string;
      notes?: string;
    },
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundError('Subscription', subscriptionId);

    // Find the latest settlement record for this subscription
    const settlementRecord = await this.prisma.settlementRecord.findFirst({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!settlementRecord) {
      throw new NotFoundError(
        'SettlementRecord for Subscription',
        subscriptionId,
      );
    }

    // Verify document exists
    const document = await this.prisma.document.findUnique({
      where: { id: input.documentId },
    });
    if (!document) throw new NotFoundError('Document', input.documentId);

    const evidence = await this.prisma.settlementEvidence.create({
      data: {
        settlementRecordId: settlementRecord.id,
        evidenceType: 'PAYMENT_DOCUMENT',
        documentId: input.documentId,
        documentHashId: input.documentHashId ?? null,
        notes: input.notes ?? null,
        metadata: {},
      },
    });

    return {
      evidenceId: evidence.id,
      subscriptionId,
      documentId: evidence.documentId,
    };
  }

  async overrideSettlement(
    settlementRecordId: string,
    input: { reason: string },
  ) {
    const record = await this.prisma.settlementRecord.findUnique({
      where: { id: settlementRecordId },
    });
    if (!record)
      throw new NotFoundError('SettlementRecord', settlementRecordId);
    if (record.status !== 'FAILED') {
      throw new ConflictError(
        'SETTLEMENT_NOT_FAILED',
        'Only FAILED settlements can be overridden',
      );
    }

    const now = new Date();

    const updated = await this.prisma.settlementRecord.update({
      where: { id: settlementRecordId },
      data: {
        status: 'OVERRIDDEN',
        failureReasonText: input.reason,
        updatedAt: now,
      },
    });

    // Log to system_event_log
    await this.prisma.systemEventLog.create({
      data: {
        eventType: 'SETTLEMENT_OVERRIDDEN',
        aggregateType: 'SETTLEMENT_RECORD',
        aggregateId: settlementRecordId,
        sourceContext: 'settlements.service',
        payloadJson: {
          settlementRecordId,
          subscriptionId: record.subscriptionId,
          reason: input.reason,
          previousStatus: 'FAILED',
          newStatus: 'OVERRIDDEN',
        },
        occurredAt: now,
      },
    });

    return {
      settlementRecordId: updated.id,
      status: 'OVERRIDDEN',
    };
  }

  async confirmSettlement(subscriptionId: string, settlementRecordId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { fund: true, wallet: true },
    });
    if (!subscription) throw new NotFoundError('Subscription', subscriptionId);
    if (subscription.status !== 'PENDING') {
      throw new ConflictError(
        'SUBSCRIPTION_NOT_PENDING',
        'Subscription is not in PENDING status',
      );
    }

    const record = await this.prisma.settlementRecord.findUnique({
      where: { id: settlementRecordId },
    });
    if (!record)
      throw new NotFoundError('SettlementRecord', settlementRecordId);
    if (record.subscriptionId !== subscriptionId) {
      throw new ConflictError(
        'SETTLEMENT_MISMATCH',
        'Settlement record does not belong to this subscription',
      );
    }
    if (record.status !== 'PASSED') {
      throw new ConflictError(
        'SETTLEMENT_NOT_PASSED',
        'Settlement must be PASSED before confirmation',
      );
    }

    const now = new Date();
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'SETTLED', settledAt: now, updatedAt: now },
    });

    // Create capital account for the settled subscription
    const contributionAmount = parseFloat(
      subscription.committedAmount.toString(),
    );
    await this.prisma.capitalAccount.create({
      data: {
        fundId: subscription.fundId,
        investorId: subscription.investorId,
        openingBalance: 0,
        initialContribution: contributionAmount,
        contributedAt: now,
        capitalReturned: 0,
        accruedPref: 0,
        residualAllocation: 0,
        endingCapitalBalance: contributionAmount,
        asOfDate: now,
        isCurrent: true,
      },
    });

    // Generate ECDSA mint authorization
    let mintAuthSignature: string | null = null;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (privateKey) {
      try {
        const { ethers } = await import('ethers');
        const wallet = new ethers.Wallet(privateKey);
        const message = ethers.solidityPackedKeccak256(
          ['string', 'string', 'uint256'],
          [subscriptionId, subscription.walletId ?? '', BigInt(Date.now())],
        );
        mintAuthSignature = await wallet.signMessage(ethers.getBytes(message));
      } catch (e) {
        console.warn('ECDSA signature generation failed:', e);
      }
    }

    await this.eventLog.log({
      eventType: 'SETTLEMENT_CONFIRMED',
      aggregateType: 'SUBSCRIPTION',
      aggregateId: subscriptionId,
      fundId: subscription.fundId,
      payload: {
        settlementRecordId,
        settledAt: now.toISOString(),
        committedAmount: subscription.committedAmount.toString(),
        mintAuthSignature,
      },
    });

    return {
      subscriptionId: updated.id,
      status: updated.status,
      settledAt: updated.settledAt?.toISOString(),
      mintAuthSignature,
    };
  }
}
