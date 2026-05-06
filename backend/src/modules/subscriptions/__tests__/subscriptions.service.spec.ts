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
    // Default: no existing subscriptions in the fund. Individual tests
    // override this when exercising top-up / over-allocation scenarios.
    prisma.subscription.findMany.mockResolvedValue([]);
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

    // ── Top-up validation: cross-subscription totals ───────────────────
    it('allows a top-up subscription when fund headroom is sufficient', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [{ id: 'hash-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      // Investor inv-1 already has a 20% sub; fund total so far is 80%.
      // A 10% top-up for inv-1 should succeed (inv-1 → 30%, fund → 90%).
      prisma.subscription.findMany.mockResolvedValue([
        { investorId: 'inv-1', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-2', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-3', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-4', allocationPct: 20, status: 'SETTLED' },
      ]);
      mockTx.subscription.create.mockResolvedValue({
        id: 'sub-topup',
        status: 'PENDING',
        subscriptionRef: 'SUB-TOPUP',
      });

      const topUp = [
        {
          investorId: 'inv-1',
          walletId: 'w-1',
          allocationPct: 10,
          committedAmount: '100000',
          subscriptionRef: 'SUB-TOPUP',
        },
      ];

      const result = await service.createSubscriptions(
        fundId,
        governingDocumentId,
        topUp,
      );
      expect(result.createdCount).toBe(1);
      expect(mockTx.subscription.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a top-up that would push the fund total above 100%', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [{ id: 'hash-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      // Fund is already 100% allocated.
      prisma.subscription.findMany.mockResolvedValue([
        { investorId: 'inv-1', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-2', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-3', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-4', allocationPct: 20, status: 'SETTLED' },
        { investorId: 'inv-5', allocationPct: 20, status: 'SETTLED' },
      ]);

      const topUp = [
        {
          investorId: 'inv-1',
          walletId: 'w-1',
          allocationPct: 5,
          committedAmount: '50000',
          subscriptionRef: 'SUB-OVER',
        },
      ];

      await expect(
        service.createSubscriptions(fundId, governingDocumentId, topUp),
      ).rejects.toThrow(ConflictError);
      await expect(
        service.createSubscriptions(fundId, governingDocumentId, topUp),
      ).rejects.toThrow('LPA Amendment');
    });

    it('rejects a top-up that would push one investor above 100%', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: governingDocumentId,
        hashes: [{ id: 'hash-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      // inv-1 already at 95%; only 5% headroom for them.
      prisma.subscription.findMany.mockResolvedValue([
        { investorId: 'inv-1', allocationPct: 95, status: 'SETTLED' },
      ]);

      const topUp = [
        {
          investorId: 'inv-1',
          walletId: 'w-1',
          allocationPct: 10,
          committedAmount: '100000',
          subscriptionRef: 'SUB-INV-OVER',
        },
      ];

      await expect(
        service.createSubscriptions(fundId, governingDocumentId, topUp),
      ).rejects.toThrow(/Investor .* would have/);
    });
  });

  describe('getFundAllocation', () => {
    it('groups subscriptions by investor and reports headroom', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.subscription.findMany.mockResolvedValue([
        {
          investorId: 'inv-1',
          allocationPct: 20,
          status: 'SETTLED',
          committedAmount: '200000',
          investor: { legalName: 'Alpine', email: 'alpine@example.com' },
        },
        {
          // top-up for inv-1
          investorId: 'inv-1',
          allocationPct: 10,
          status: 'PENDING',
          committedAmount: '100000',
          investor: { legalName: 'Alpine', email: 'alpine@example.com' },
        },
        {
          investorId: 'inv-2',
          allocationPct: 30,
          status: 'SETTLED',
          committedAmount: '300000',
          investor: { legalName: 'Bridge', email: 'bridge@example.com' },
        },
      ]);

      const result = await service.getFundAllocation(fundId);

      expect(result.totalAllocationPct).toBeCloseTo(60);
      expect(result.remainingHeadroomPct).toBeCloseTo(40);
      expect(result.investors).toHaveLength(2);
      const alpine = result.investors.find((i) => i.investorId === 'inv-1')!;
      expect(alpine.totalAllocationPct).toBeCloseTo(30);
      expect(alpine.settledAllocationPct).toBeCloseTo(20);
      expect(alpine.pendingAllocationPct).toBeCloseTo(10);
      expect(alpine.subscriptionCount).toBe(2);
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
          tokenPositionEvents: [],
          investor: { legalName: 'Alpine' },
          governingHash: { hashHex: 'abc' },
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
