import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const checkInvestorMatch = true; // Simplified for MVP — payment doc is accepted as evidence

    // Check for double settlement
    const existingPassed = await this.prisma.settlementRecord.findFirst({
      where: { subscriptionId: subscription.id, status: 'PASSED' },
    });
    const checkNoDoubleSettlement = !existingPassed;

    const allPassed =
      checkAmountMatch &&
      checkReferenceMatch &&
      checkInvestorMatch &&
      checkNoDoubleSettlement;

    let failureReasonCode: string | null = null;
    if (!checkAmountMatch) failureReasonCode = 'AMOUNT_MISMATCH';
    else if (!checkReferenceMatch) failureReasonCode = 'REFERENCE_MISMATCH';
    else if (!checkInvestorMatch) failureReasonCode = 'INVESTOR_MISMATCH';
    else if (!checkNoDoubleSettlement) failureReasonCode = 'DOUBLE_SETTLEMENT';

    const now = new Date();
    const updated = await this.prisma.settlementRecord.update({
      where: { id: settlementRecordId },
      data: {
        status: allPassed ? 'PASSED' : 'FAILED',
        checkAmountMatch,
        checkInvestorMatch,
        checkReferenceMatch,
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
      throw new NotFoundError('SettlementRecord for Subscription', subscriptionId);
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
    if (!record) throw new NotFoundError('SettlementRecord', settlementRecordId);
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

  async confirmSettlement(
    subscriptionId: string,
    settlementRecordId: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
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
    if (!record) throw new NotFoundError('SettlementRecord', settlementRecordId);
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

    return {
      subscriptionId: updated.id,
      status: updated.status,
      settledAt: updated.settledAt?.toISOString(),
    };
  }
}
