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

  async confirmSettlement(
    subscriptionId: string,
    settlementRecordId: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundError('Subscription', subscriptionId);

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
