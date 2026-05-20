import { SubscriptionsService } from '../subscriptions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError, ConflictError } from '../../../common/errors';

const mockTx = {
  subscription: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  fund: {
    update: jest.fn(),
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
    mockTx.subscription.findMany.mockReset().mockResolvedValue([]);
    mockTx.subscription.update.mockReset().mockResolvedValue({});
    mockTx.fund.update.mockReset().mockResolvedValue({});
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

    // ── Amendment-driven subscription creation ─────────────────────────
    // An LPA Amendment expands the fund (dollar-anchored model): it raises
    // the fund's targetCommitment and re-normalizes every LP's allocation %
    // so the cap table still sums to 100% with existing LPs diluted.
    it('expands the fund and re-normalizes allocations from an LPA amendment', async () => {
      const amendmentDocId = 'amendment-doc-1';
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: amendmentDocId,
        documentType: 'LPA_AMENDMENT',
        parentDocumentId: 'master-lpa-1',
        hashes: [{ id: 'hash-amend-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      // Fund is fully subscribed at $50M (Summit $30M / Holloway $20M).
      prisma.subscription.findMany.mockResolvedValue([
        {
          investorId: 'inv-1',
          allocationPct: 60,
          committedAmount: '30000000',
          status: 'SETTLED',
        },
        {
          investorId: 'inv-2',
          allocationPct: 40,
          committedAmount: '20000000',
          status: 'SETTLED',
        },
      ]);
      mockTx.subscription.create.mockResolvedValue({
        id: 'sub-amend-1',
        status: 'PENDING',
        subscriptionRef: 'SUB-AMEND-001',
        committedAmount: '12500000',
      });
      // The post-create recompute query returns all three subscriptions.
      mockTx.subscription.findMany.mockResolvedValue([
        { id: 'sub-old-1', committedAmount: '30000000' },
        { id: 'sub-old-2', committedAmount: '20000000' },
        { id: 'sub-amend-1', committedAmount: '12500000' },
      ]);

      // Amendment adds a new $12.5M LP, expanding the fund to $62.5M.
      const amendmentItems = [
        {
          investorId: 'inv-5',
          walletId: 'w-5',
          allocationPct: 20,
          committedAmount: '12500000',
          subscriptionRef: 'SUB-AMEND-001',
        },
      ];

      const result = await service.createSubscriptions(
        fundId,
        amendmentDocId,
        amendmentItems,
      );

      expect(result.createdCount).toBe(1);
      expect(mockTx.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            governingDocumentId: amendmentDocId,
            governingHashId: 'hash-amend-1',
          }),
        }),
      );
      // Fund target raised to the new total committed capital.
      expect(mockTx.fund.update).toHaveBeenCalledWith({
        where: { id: fundId },
        data: { targetCommitment: 62500000 },
      });
      // Every subscription's allocation % re-normalized against $62.5M.
      expect(mockTx.subscription.update).toHaveBeenCalledTimes(3);
      expect(mockTx.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-old-1' },
        data: { allocationPct: 48 }, // 30M / 62.5M
      });
      expect(mockTx.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-amend-1' },
        data: { allocationPct: 20 }, // 12.5M / 62.5M
      });
    });

    it('lets an amendment expand a fully-allocated fund instead of rejecting', async () => {
      const amendmentDocId = 'amendment-doc-2';
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: amendmentDocId,
        documentType: 'LPA_AMENDMENT',
        parentDocumentId: 'master-lpa-1',
        hashes: [{ id: 'hash-amend-2', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      // Fund already fully allocated at 100% ($50M).
      prisma.subscription.findMany.mockResolvedValue([
        {
          investorId: 'inv-1',
          allocationPct: 50,
          committedAmount: '25000000',
          status: 'SETTLED',
        },
        {
          investorId: 'inv-2',
          allocationPct: 50,
          committedAmount: '25000000',
          status: 'SETTLED',
        },
      ]);
      mockTx.subscription.create.mockResolvedValue({
        id: 'sub-amend-over',
        status: 'PENDING',
        subscriptionRef: 'SUB-AMEND-OVER',
        committedAmount: '10000000',
      });
      mockTx.subscription.findMany.mockResolvedValue([
        { id: 'sub-old-1', committedAmount: '25000000' },
        { id: 'sub-old-2', committedAmount: '25000000' },
        { id: 'sub-amend-over', committedAmount: '10000000' },
      ]);

      const amendmentItems = [
        {
          investorId: 'inv-3',
          walletId: 'w-3',
          allocationPct: 10,
          committedAmount: '10000000',
          subscriptionRef: 'SUB-AMEND-OVER',
        },
      ];

      const result = await service.createSubscriptions(
        fundId,
        amendmentDocId,
        amendmentItems,
      );

      expect(result.createdCount).toBe(1);
      // No 100% cap rejection — the fund expanded to $60M instead.
      expect(mockTx.fund.update).toHaveBeenCalledWith({
        where: { id: fundId },
        data: { targetCommitment: 60000000 },
      });
    });

    it('does not treat a side letter as a fund expansion', async () => {
      // A SIDE_LETTER references a parent document but must NOT expand the
      // fund. With the fund already at 100%, the normal cap check applies.
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: 'side-letter-1',
        documentType: 'SIDE_LETTER',
        parentDocumentId: 'master-lpa-1',
        hashes: [{ id: 'hash-sl-1', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });
      prisma.subscription.findMany.mockResolvedValue([
        { investorId: 'inv-1', allocationPct: 100, status: 'SETTLED' },
      ]);

      const sideLetterItems = [
        {
          investorId: 'inv-2',
          walletId: 'w-2',
          allocationPct: 10,
          committedAmount: '5000000',
          subscriptionRef: 'SUB-SL-001',
        },
      ];

      await expect(
        service.createSubscriptions(fundId, 'side-letter-1', sideLetterItems),
      ).rejects.toThrow('exceeds 100%');
      expect(mockTx.fund.update).not.toHaveBeenCalled();
    });

    it('rejects an amendment that brings no new committed capital', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.document.findUnique.mockResolvedValue({
        id: 'amendment-doc-3',
        documentType: 'LPA_AMENDMENT',
        hashes: [{ id: 'hash-amend-3', isPrimary: true }],
      });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-1',
        eligibilityStatus: 'ELIGIBLE',
      });

      const zeroItems = [
        {
          investorId: 'inv-1',
          walletId: 'w-1',
          allocationPct: 0,
          committedAmount: '0',
          subscriptionRef: 'SUB-AMEND-ZERO',
        },
      ];

      await expect(
        service.createSubscriptions(fundId, 'amendment-doc-3', zeroItems),
      ).rejects.toThrow('positive committed amount');
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

      prisma.fund.findUnique.mockResolvedValue({
        id: fundId,
        targetCommitment: '1000000',
      });

      const result = await service.getFundAllocation(fundId);

      expect(result.totalAllocationPct).toBeCloseTo(60);
      expect(result.remainingHeadroomPct).toBeCloseTo(40);
      expect(result.totalCommitted).toBeCloseTo(600000);
      expect(result.targetCommitment).toBe(1000000);
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
