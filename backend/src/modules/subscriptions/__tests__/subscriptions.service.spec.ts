import { SubscriptionsService } from '../subscriptions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError, ConflictError } from '../../../common/errors';

const mockTx = {
  subscription: {
    create: jest.fn(),
  },
};

const mockPrisma = () => ({
  fund: { findUnique: jest.fn() },
  document: { findUnique: jest.fn() },
  investorFundEligibility: { findFirst: jest.fn() },
  subscription: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<any>) =>
    fn(mockTx),
  ),
});

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    mockTx.subscription.create.mockReset();
    const mockEventLog = {
      log: jest.fn().mockResolvedValue({}),
    } as unknown as EventLogService;
    service = new SubscriptionsService(
      prisma as unknown as PrismaService,
      mockEventLog,
    );
  });

  const fundId = 'fund-1';
  const governingDocumentId = 'doc-1';
  const items = [
    {
      investorId: 'inv-1',
      walletId: 'w-1',
      allocationPct: 50,
      committedAmount: '500000',
      subscriptionRef: 'SUB-001',
    },
    {
      investorId: 'inv-2',
      walletId: 'w-2',
      allocationPct: 50,
      committedAmount: '500000',
      subscriptionRef: 'SUB-002',
    },
  ];

  describe('createSubscriptions', () => {
    it('succeeds with valid inputs', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [{ id: 'hash-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      mockTx.subscription.create
        .mockResolvedValueOnce({
          id: 'sub-1',
          status: 'PENDING',
          subscriptionRef: 'SUB-001',
        })
        .mockResolvedValueOnce({
          id: 'sub-2',
          status: 'PENDING',
          subscriptionRef: 'SUB-002',
        });

      const result = await service.createSubscriptions(
        fundId,
        governingDocumentId,
        items,
      );

      expect(result.createdCount).toBe(2);
      expect(result.subscriptions).toHaveLength(2);
      expect(result.subscriptions[0].subscriptionId).toBe('sub-1');
      expect(result.subscriptions[1].subscriptionId).toBe('sub-2');
      expect(mockTx.subscription.create).toHaveBeenCalledTimes(2);
    });

    it('rejects when fund does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, items),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects when governing document does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, items),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects when governing document has no hash', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [],
      });
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, items),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, items),
      ).rejects.toThrow('Governing document has no hash');
    });

    it('rejects ineligible investor', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [{ id: 'hash-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue(null);

      await expect(
        service.createSubscriptions(fundId, governingDocumentId, items),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, items),
      ).rejects.toThrow('not eligible');
    });

    it('rejects total allocation > 100%', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [{ id: 'hash-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });

      const overAllocated = [
        {
          investorId: 'inv-1',
          walletId: 'w-1',
          allocationPct: 60,
          committedAmount: '600000',
          subscriptionRef: 'SUB-001',
        },
        {
          investorId: 'inv-2',
          walletId: 'w-2',
          allocationPct: 50,
          committedAmount: '500000',
          subscriptionRef: 'SUB-002',
        },
      ];

      await expect(
        service.createSubscriptions(fundId, governingDocumentId, overAllocated),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, overAllocated),
      ).rejects.toThrow('exceeds 100%');
    });
  });

  describe('listSubscriptions', () => {
    it('returns subscriptions for a fund', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          subscriptionRef: 'SUB-001',
          investorId: 'inv-1',
          walletId: 'w-1',
          allocationPct: 20,
          committedAmount: 200000,
          status: 'PENDING',
          settledAt: null,
          settlementRecords: [],
        },
      ]);

      const result = await service.listSubscriptions(fundId);

      expect(result).toHaveLength(1);
      expect(result[0].subscriptionId).toBe('sub-1');
      expect(result[0].status).toBe('PENDING');
      expect(result[0].latestSettlementStatus).toBeNull();
    });

    it('filters by status', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.subscription.findMany.mockResolvedValue([]);

      await service.listSubscriptions(fundId, { status: 'SETTLED' });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SETTLED' }),
        }),
      );
    });

    it('throws NotFoundError when fund does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);
      await expect(service.listSubscriptions('no-fund')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getSubscription', () => {
    it('returns subscription by id', async () => {
      const mockSub = {
        id: 'sub-1',
        subscriptionRef: 'SUB-001',
        investor: { id: 'inv-1' },
        wallet: { id: 'w-1' },
        governingDocument: { id: 'doc-1', hashes: [{ id: 'hash-1' }] },
        settlementRecords: [],
      };
      prisma.subscription.findUnique.mockResolvedValue(mockSub);

      const result = await service.getSubscription('sub-1');
      expect(result.id).toBe('sub-1');
    });

    it('throws NotFoundError when subscription does not exist', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(service.getSubscription('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
