import { FundService } from '../fund.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundError } from '../../../common/errors';

const mockPrisma = () => ({
  fund: {
    findUnique: jest.fn(),
  },
  investor: {
    count: jest.fn(),
  },
  investorFundEligibility: {
    count: jest.fn(),
  },
  subscription: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  tokenContract: {
    findFirst: jest.fn(),
  },
  systemEventLog: {
    findMany: jest.fn(),
  },
});

describe('FundService', () => {
  let service: FundService;
  let prisma: ReturnType<typeof mockPrisma>;

  const fundId = 'fund-1';
  const mockFund = { id: fundId, name: 'Kadra Demo Fund I', status: 'ACTIVE' };

  beforeEach(() => {
    prisma = mockPrisma();
    service = new FundService(prisma as unknown as PrismaService);
  });

  describe('getFundOverview', () => {
    it('returns correct counts and totals', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.investor.count.mockResolvedValue(5);
      prisma.investorFundEligibility.count.mockResolvedValue(5);
      prisma.subscription.count
        .mockResolvedValueOnce(1) // pending
        .mockResolvedValueOnce(4); // settled
      prisma.tokenContract.findFirst.mockResolvedValue({
        chainId: 31337,
        contractAddress: '0xContract',
        deploymentStatus: 'DEPLOYED',
      });
      prisma.subscription.aggregate
        .mockResolvedValueOnce({ _sum: { committedAmount: 5000000 } }) // total committed
        .mockResolvedValueOnce({ _sum: { committedAmount: 4000000 } }); // settled committed

      const result = await service.getFundOverview(fundId);

      expect(result.fundId).toBe(fundId);
      expect(result.fundName).toBe('Kadra Demo Fund I');
      expect(result.status).toBe('ACTIVE');
      expect(result.lpCount).toBe(5);
      expect(result.eligibleWalletCount).toBe(5);
      expect(result.pendingSubscriptions).toBe(1);
      expect(result.settledSubscriptions).toBe(4);
      expect(result.totalCommittedAmount).toBe('5000000');
      expect(result.totalSettledAmount).toBe('4000000');
      expect(result.tokenContract).toEqual({
        chainId: 31337,
        contractAddress: '0xContract',
        deploymentStatus: 'DEPLOYED',
      });
    });

    it('returns null tokenContract when none exists', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.investor.count.mockResolvedValue(0);
      prisma.investorFundEligibility.count.mockResolvedValue(0);
      prisma.subscription.count.mockResolvedValue(0);
      prisma.tokenContract.findFirst.mockResolvedValue(null);
      prisma.subscription.aggregate.mockResolvedValue({
        _sum: { committedAmount: null },
      });

      const result = await service.getFundOverview(fundId);

      expect(result.tokenContract).toBeNull();
      expect(result.totalCommittedAmount).toBe('0.00');
      expect(result.totalSettledAmount).toBe('0.00');
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(service.getFundOverview('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getActivityFeed', () => {
    it('returns events in reverse chronological order', async () => {
      const now = new Date('2026-03-09T12:00:00Z');
      const earlier = new Date('2026-03-09T11:00:00Z');
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.systemEventLog.findMany.mockResolvedValue([
        {
          id: BigInt(2),
          eventId: 'evt-2',
          eventType: 'SETTLEMENT_COMPLETED',
          aggregateType: 'SETTLEMENT',
          aggregateId: 'settle-1',
          payloadJson: { investorId: 'inv-1' },
          metadataJson: {},
          occurredAt: now,
          txHash: '0xabc',
          blockNumber: BigInt(200),
        },
        {
          id: BigInt(1),
          eventId: 'evt-1',
          eventType: 'DOCUMENT_UPLOADED',
          aggregateType: 'DOCUMENT',
          aggregateId: 'doc-1',
          payloadJson: { filename: 'lpa.pdf' },
          metadataJson: {},
          occurredAt: earlier,
          txHash: null,
          blockNumber: null,
        },
      ]);

      const result = await service.getActivityFeed(fundId, {
        limit: 50,
        offset: 0,
      });

      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('SETTLEMENT_COMPLETED');
      expect(result[0].blockNumber).toBe(200);
      expect(result[1].eventType).toBe('DOCUMENT_UPLOADED');
      expect(result[1].blockNumber).toBeNull();
      expect(prisma.systemEventLog.findMany).toHaveBeenCalledWith({
        where: { fundId },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(
        service.getActivityFeed('nonexistent', { limit: 50, offset: 0 }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
