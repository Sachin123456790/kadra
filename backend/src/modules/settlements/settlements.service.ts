import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';
import { TokenizationService } from '../tokenization/tokenization.service';
import type { DocumentStorageAdapter } from '../../adapters/storage/storage.adapter';
import { STORAGE_ADAPTER } from '../../adapters/storage/storage.adapter';

const MIN_WIRE_PDF_BYTES = 1024;

interface WireMatchResult {
  amountMatch: boolean;
  referenceMatch: boolean;
  investorMatch: boolean;
  notes?: string;
}

async function geminiMatchWire(
  buffer: Buffer,
  expected: {
    amount: string;
    currency: string;
    reference: string;
    investorName: string;
    investorEmail: string;
  },
): Promise<WireMatchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

  const prompt = [
    'You are a settlement verification engine for a private fund admin platform.',
    'You receive a wire confirmation PDF and a set of expected transaction details.',
    'Return strict JSON only — no markdown, no commentary.',
    '',
    'Expected transaction:',
    `- Amount: ${expected.amount} ${expected.currency}`,
    `- Reference / subscription ref: ${expected.reference}`,
    `- Investor legal name: ${expected.investorName}`,
    `- Investor email (optional fallback identifier): ${expected.investorEmail}`,
    '',
    'For each field, decide whether the PDF actually contains the expected value (or an unambiguous equivalent — e.g. "$1,000,000.00" matches 1000000).',
    'A blank, empty, or unrelated PDF must produce all-false.',
    '',
    'Return JSON of shape:',
    '{"amountMatch":boolean,"referenceMatch":boolean,"investorMatch":boolean,"notes":"short rationale"}',
  ].join('\n');

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: buffer.toString('base64'),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<WireMatchResult>;
    return {
      amountMatch: parsed.amountMatch === true,
      referenceMatch: parsed.referenceMatch === true,
      investorMatch: parsed.investorMatch === true,
      notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly tokenizationService: TokenizationService,
    @Inject(STORAGE_ADAPTER) private readonly storage: DocumentStorageAdapter,
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

    const expectedAmount = parseFloat(subscription.committedAmount.toString());
    const expectedRef = subscription.subscriptionRef ?? '';

    // Load and inspect the uploaded wire confirmation PDF. A blank or empty
    // PDF must never pass — checks remain false unless the document body
    // actually contains the expected values.
    const paymentDoc = await this.prisma.document.findUnique({
      where: { id: input.paymentDocumentId },
    });
    const investor = await this.prisma.investor.findUnique({
      where: { id: subscription.investorId },
    });

    let pdfBuffer: Buffer | null = null;
    let pdfBytes = 0;
    if (paymentDoc) {
      try {
        pdfBuffer = await this.storage.read(paymentDoc.storageKey);
        pdfBytes = pdfBuffer.length;
      } catch {
        pdfBuffer = null;
      }
    }

    const pdfPresent = pdfBuffer != null && pdfBytes >= MIN_WIRE_PDF_BYTES;

    // Ask Gemini to compare the PDF body against the expected transaction
    // details. If Gemini is unavailable or the PDF is too small to be a
    // legitimate wire confirmation, all content checks remain false.
    let geminiResult: WireMatchResult | null = null;
    if (pdfPresent && pdfBuffer) {
      geminiResult = await geminiMatchWire(pdfBuffer, {
        amount: expectedAmount.toString(),
        currency: subscription.currency ?? 'USD',
        reference: expectedRef,
        investorName: investor?.legalName ?? '',
        investorEmail: investor?.email ?? '',
      });
    }

    const declaredAmountMatchesSubscription =
      parseFloat(input.declaredAmount) === expectedAmount;
    const declaredRefMatchesSubscription =
      input.declaredReference === expectedRef && expectedRef.length > 0;

    const checkAmountMatch =
      pdfPresent &&
      geminiResult?.amountMatch === true &&
      declaredAmountMatchesSubscription;

    const checkReferenceMatch =
      pdfPresent &&
      geminiResult?.referenceMatch === true &&
      declaredRefMatchesSubscription;

    let checkInvestorMatch = false;
    if (pdfPresent && paymentDoc && geminiResult?.investorMatch === true) {
      const linkedToInvestor =
        paymentDoc.linkedEntityType === 'INVESTOR' &&
        paymentDoc.linkedEntityId === subscription.investorId;
      const linkedToFund =
        paymentDoc.fundId === subscription.fundId &&
        paymentDoc.linkedEntityType !== 'INVESTOR';
      checkInvestorMatch = linkedToInvestor || linkedToFund;
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
    if (!pdfPresent) failureReasonCode = 'WIRE_PDF_BLANK_OR_UNREADABLE';
    else if (geminiResult == null)
      failureReasonCode = 'WIRE_VERIFICATION_UNAVAILABLE';
    else if (!checkAmountMatch) failureReasonCode = 'AMOUNT_MISMATCH';
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

  async approveSettlementDirectly(subscriptionId: string, reason: string) {
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

    const now = new Date();

    // Create an OVERRIDDEN settlement record via manual GP attestation. The
    // five check booleans mirror the overrideSettlement path: an override
    // bypasses the 3-way match rather than recording per-check outcomes.
    const record = await this.prisma.settlementRecord.create({
      data: {
        subscriptionId,
        status: 'OVERRIDDEN',
        expectedAmount: subscription.committedAmount,
        receivedAmount: subscription.committedAmount,
        expectedCurrency: subscription.currency,
        receivedCurrency: subscription.currency,
        checkAmountMatch: false,
        checkInvestorMatch: false,
        checkReferenceMatch: false,
        checkHashMatch: false,
        checkNoDoubleSettlement: false,
        failureReasonText: reason,
        validatedAt: now,
      },
    });

    await this.prisma.settlementEvidence.create({
      data: {
        settlementRecordId: record.id,
        evidenceType: 'MANUAL_ATTESTATION',
        notes: reason,
        metadata: {},
      },
    });

    return this.confirmSettlement(subscriptionId, record.id);
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
    if (record.status !== 'PASSED' && record.status !== 'OVERRIDDEN') {
      throw new ConflictError(
        'SETTLEMENT_NOT_PASSED',
        'Settlement must be PASSED or OVERRIDDEN before confirmation',
      );
    }

    const now = new Date();
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'SETTLED', settledAt: now, updatedAt: now },
    });

    // Roll forward the investor's current capital account instead of blindly creating
    // a new current row on every confirmation attempt.
    const contributionAmount = parseFloat(
      subscription.committedAmount.toString(),
    );
    await this.prisma.capitalAccount.upsert({
      where: {
        fundId_investorId_isCurrent: {
          fundId: subscription.fundId,
          investorId: subscription.investorId,
          isCurrent: true,
        },
      },
      create: {
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
      update: {
        initialContribution: { increment: contributionAmount },
        endingCapitalBalance: { increment: contributionAmount },
        contributedAt: now,
        asOfDate: now,
      },
    });

    // Generate ECDSA mint authorization using viem
    let mintAuthSignature: string | null = null;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (privateKey) {
      try {
        const { privateKeyToAccount } = await import('viem/accounts');
        const { keccak256, encodePacked } = await import('viem');
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const message = keccak256(
          encodePacked(
            ['string', 'string', 'uint256'],
            [subscriptionId, subscription.walletId ?? '', BigInt(Date.now())],
          ),
        );
        mintAuthSignature = await account.signMessage({ message });
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

    // Auto-mint tokens for the settled subscription (non-blocking)
    this.tokenizationService
      .mintForSubscription(subscriptionId)
      .then((mintResult) => {
        console.log(
          `Auto-mint completed for ${subscriptionId}: txHash=${mintResult.txHash}, tokens=${mintResult.tokenAmount}`,
        );
      })
      .catch((e) => {
        console.warn(
          `Auto-mint failed for ${subscriptionId}:`,
          e?.message ?? e,
        );
      });

    return {
      subscriptionId: updated.id,
      status: updated.status,
      settledAt: updated.settledAt?.toISOString(),
      mintAuthSignature,
    };
  }
}
