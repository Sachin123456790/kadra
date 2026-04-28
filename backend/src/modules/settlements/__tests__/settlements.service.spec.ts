import { SettlementsService } from '../settlements.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { TokenizationService } from '../../tokenization/tokenization.service';
import { NotFoundError, ConflictError } from '../../../common/errors';

const mockPrisma = () => ({
  subscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  document: {
    findUnique: jest.fn(),
  },
  documentHash: {
    findUnique: jest.fn(),
  },
  investor: {
    findUnique: jest.fn(),
  },
  settlementRecord: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  capitalAccount: {
    upsert: jest.fn(),
  },
});

const mockStorage = () => ({
  save: jest.fn(),
  read: jest.fn().mockResolvedValue(Buffer.alloc(2048, 1)),
  delete: jest.fn(),
});

function mockGeminiFetch(result: {
  amountMatch: boolean;
  referenceMatch: boolean;
  investorMatch: boolean;
}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(result) }],
          },
        },
      ],
    }),
  }) as unknown as typeof fetch;
}

describe('SettlementsService', () => {
  let service: SettlementsService;
  let prisma: ReturnType<typeof mockPrisma>;

  const subscriptionId = 'sub-1';
  const paymentDocumentId = 'doc-pay-1';
  const validInput = {
    paymentDocumentId,
    declaredAmount: '500000',
    declaredCurrency: 'USD',
    declaredReference: 'SUB-001',
  };

  const pendingSubscription = {
    id: subscriptionId,
    status: 'PENDING',
    committedAmount: 500000,
    currency: 'USD',
    subscriptionRef: 'SUB-001',
    fundId: 'fund-1',
    investorId: 'inv-1',
    governingHashId: 'hash-1',
    walletId: 'w-1',
  };

  beforeEach(() => {
    prisma = mockPrisma();
    const mockEventLog = {
      log: jest.fn().mockResolvedValue({}),
    } as unknown as EventLogService;
    const mockTokenizationService = {
      mintForSubscription: jest
        .fn()
        .mockResolvedValue({ txHash: '0xmock', tokenAmount: '2000' }),
    } as unknown as TokenizationService;
    service = new SettlementsService(
      prisma as unknown as PrismaService,
      mockEventLog,
      mockTokenizationService,
      mockStorage() as never,
    );
    process.env.GEMINI_API_KEY = 'test-key';
    prisma.investor.findUnique.mockResolvedValue({
      id: 'inv-1',
      legalName: 'Acme LP',
      email: 'lp@acme.test',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestValidation', () => {
    it('succeeds and passes when amounts and reference match', async () => {
      mockGeminiFetch({
        amountMatch: true,
        referenceMatch: true,
        investorMatch: true,
      });
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.document.findUnique.mockResolvedValue({
        id: paymentDocumentId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: 'inv-1',
        fundId: 'fund-1',
        storageKey: 'docs/wire.pdf',
      });
      prisma.documentHash.findUnique.mockResolvedValue({ id: 'hash-1' });
      prisma.settlementRecord.create.mockResolvedValue({
        id: 'sr-1',
        status: 'REQUESTED',
      });
      prisma.settlementRecord.update
        .mockResolvedValueOnce({ id: 'sr-1', status: 'VERIFYING' }) // first update: VERIFYING
        .mockResolvedValueOnce({ id: 'sr-1', status: 'PASSED' }); // second update: PASSED
      prisma.settlementRecord.findFirst.mockResolvedValue(null); // no double settlement

      const result = await service.requestValidation(
        subscriptionId,
        validInput,
      );

      expect(result.status).toBe('PASSED');
      expect(result.checks.checkAmountMatch).toBe(true);
      expect(result.checks.checkReferenceMatch).toBe(true);
      expect(result.checks.checkInvestorMatch).toBe(true);
      expect(result.checks.checkNoDoubleSettlement).toBe(true);
      expect(result.failureReasonCode).toBeNull();
    });

    it('fails on amount mismatch', async () => {
      mockGeminiFetch({
        amountMatch: false,
        referenceMatch: true,
        investorMatch: true,
      });
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.document.findUnique.mockResolvedValue({
        id: paymentDocumentId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: 'inv-1',
        fundId: 'fund-1',
        storageKey: 'docs/wire.pdf',
      });
      prisma.documentHash.findUnique.mockResolvedValue({ id: 'hash-1' });
      prisma.settlementRecord.create.mockResolvedValue({
        id: 'sr-2',
        status: 'REQUESTED',
      });
      prisma.settlementRecord.update
        .mockResolvedValueOnce({ id: 'sr-2', status: 'VERIFYING' })
        .mockResolvedValueOnce({ id: 'sr-2', status: 'FAILED' });
      prisma.settlementRecord.findFirst.mockResolvedValue(null);

      const result = await service.requestValidation(subscriptionId, {
        ...validInput,
        declaredAmount: '999999',
      });

      expect(result.status).toBe('FAILED');
      expect(result.checks.checkAmountMatch).toBe(false);
      expect(result.failureReasonCode).toBe('AMOUNT_MISMATCH');
    });

    it('fails on reference mismatch', async () => {
      mockGeminiFetch({
        amountMatch: true,
        referenceMatch: false,
        investorMatch: true,
      });
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.document.findUnique.mockResolvedValue({
        id: paymentDocumentId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: 'inv-1',
        fundId: 'fund-1',
        storageKey: 'docs/wire.pdf',
      });
      prisma.documentHash.findUnique.mockResolvedValue({ id: 'hash-1' });
      prisma.settlementRecord.create.mockResolvedValue({
        id: 'sr-3',
        status: 'REQUESTED',
      });
      prisma.settlementRecord.update
        .mockResolvedValueOnce({ id: 'sr-3', status: 'VERIFYING' })
        .mockResolvedValueOnce({ id: 'sr-3', status: 'FAILED' });
      prisma.settlementRecord.findFirst.mockResolvedValue(null);

      const result = await service.requestValidation(subscriptionId, {
        ...validInput,
        declaredReference: 'WRONG-REF',
      });

      expect(result.status).toBe('FAILED');
      expect(result.checks.checkReferenceMatch).toBe(false);
      expect(result.failureReasonCode).toBe('REFERENCE_MISMATCH');
    });

    it('rejects non-PENDING subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...pendingSubscription,
        status: 'SETTLED',
      });

      await expect(
        service.requestValidation(subscriptionId, validInput),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.requestValidation(subscriptionId, validInput),
      ).rejects.toThrow('Subscription must be PENDING');
    });

    it('rejects when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.requestValidation('no-sub', validInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects when payment document not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(
        service.requestValidation(subscriptionId, validInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('detects double settlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.document.findUnique.mockResolvedValue({
        id: paymentDocumentId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: 'inv-1',
        fundId: 'fund-1',
      });
      prisma.documentHash.findUnique.mockResolvedValue({ id: 'hash-1' });
      prisma.settlementRecord.create.mockResolvedValue({
        id: 'sr-4',
        status: 'REQUESTED',
      });
      prisma.settlementRecord.update
        .mockResolvedValueOnce({ id: 'sr-4', status: 'VERIFYING' })
        .mockResolvedValueOnce({ id: 'sr-4', status: 'FAILED' });
      // Existing PASSED record found
      prisma.settlementRecord.findFirst.mockResolvedValue({
        id: 'sr-prev',
        status: 'PASSED',
      });

      const result = await service.requestValidation(
        subscriptionId,
        validInput,
      );

      expect(result.status).toBe('FAILED');
      expect(result.checks.checkNoDoubleSettlement).toBe(false);
      expect(result.failureReasonCode).toBe('DOUBLE_SETTLEMENT');
    });
  });

  describe('confirmSettlement', () => {
    const settlementRecordId = 'sr-1';

    it('succeeds when settlement is PASSED', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.settlementRecord.findUnique.mockResolvedValue({
        id: settlementRecordId,
        subscriptionId,
        status: 'PASSED',
      });
      const settledAt = new Date();
      prisma.subscription.update.mockResolvedValue({
        id: subscriptionId,
        status: 'SETTLED',
        settledAt,
      });
      prisma.capitalAccount.upsert.mockResolvedValue({ id: 'ca-1' });

      const result = await service.confirmSettlement(
        subscriptionId,
        settlementRecordId,
      );

      expect(result.status).toBe('SETTLED');
      expect(result.subscriptionId).toBe(subscriptionId);
      expect(result.settledAt).toBe(settledAt.toISOString());
      expect(prisma.capitalAccount.upsert).toHaveBeenCalledTimes(1);
    });

    it('rolls forward an existing current capital account instead of creating another', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.settlementRecord.findUnique.mockResolvedValue({
        id: settlementRecordId,
        subscriptionId,
        status: 'PASSED',
      });
      prisma.subscription.update.mockResolvedValue({
        id: subscriptionId,
        status: 'SETTLED',
        settledAt: new Date(),
      });
      prisma.capitalAccount.upsert.mockResolvedValue({ id: 'ca-current' });

      await service.confirmSettlement(subscriptionId, settlementRecordId);

      expect(prisma.capitalAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fundId_investorId_isCurrent: {
              fundId: pendingSubscription.fundId,
              investorId: pendingSubscription.investorId,
              isCurrent: true,
            },
          },
          update: expect.objectContaining({
            initialContribution: { increment: 500000 },
            endingCapitalBalance: { increment: 500000 },
          }),
        }),
      );
    });

    it('rejects when settlement is FAILED', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.settlementRecord.findUnique.mockResolvedValue({
        id: settlementRecordId,
        subscriptionId,
        status: 'FAILED',
      });

      await expect(
        service.confirmSettlement(subscriptionId, settlementRecordId),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.confirmSettlement(subscriptionId, settlementRecordId),
      ).rejects.toThrow('Settlement must be PASSED');
    });

    it('rejects when settlement does not belong to subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.settlementRecord.findUnique.mockResolvedValue({
        id: settlementRecordId,
        subscriptionId: 'other-sub',
        status: 'PASSED',
      });

      await expect(
        service.confirmSettlement(subscriptionId, settlementRecordId),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.confirmSettlement(subscriptionId, settlementRecordId),
      ).rejects.toThrow('does not belong');
    });

    it('rejects when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmSettlement('no-sub', settlementRecordId),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects when settlement record not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(pendingSubscription);
      prisma.settlementRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmSettlement(subscriptionId, 'no-sr'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
