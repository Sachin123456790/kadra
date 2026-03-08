import { DistributionService } from '../distribution.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError, ConflictError } from '../../../common/errors';

const mockPrisma = () => ({
  fund: {
    findUnique: jest.fn(),
  },
  waterfallConfig: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  tokenContract: {
    findFirst: jest.fn(),
  },
  tokenPosition: {
    findMany: jest.fn(),
  },
  ownershipSnapshot: {
    create: jest.fn(),
  },
  ownershipSnapshotRow: {
    create: jest.fn(),
  },
  wallet: {
    findFirst: jest.fn(),
  },
  capitalAccount: {
    findFirst: jest.fn(),
  },
  distributionRun: {
    create: jest.fn(),
    update: jest.fn(),
  },
  distributionLineItem: {
    create: jest.fn(),
  },
});

const mockEventLog = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

describe('DistributionService', () => {
  let service: DistributionService;
  let prisma: ReturnType<typeof mockPrisma>;

  const fundId = 'fund-1';
  const configId = 'wf-config-1';
  const contractId = 'contract-1';

  const mockFund = { id: fundId, name: 'Test Fund', status: 'ACTIVE' };
  const mockContract = {
    id: contractId,
    fundId,
    deploymentStatus: 'DEPLOYED',
    deletedAt: null,
  };

  const mockConfig = {
    id: configId,
    fundId,
    version: '1.0',
    isActive: true,
    calculationBasis: 'IRR',
    distributionFrequency: 'QUARTERLY',
    catchUpEnabled: false,
    gpPromotePct: '20.000000',
    prefReturnPct: '8.000000',
    rulesJson: { note: 'display-only' },
    tiers: [
      {
        tierOrder: 1,
        tierName: 'Return of Capital',
        hurdleType: 'NONE',
        hurdleValue: null,
        lpSharePct: '100.000000',
        gpSharePct: '0.000000',
        catchUp: false,
      },
      {
        tierOrder: 2,
        tierName: 'Preferred Return',
        hurdleType: 'IRR',
        hurdleValue: '8.000000',
        lpSharePct: '100.000000',
        gpSharePct: '0.000000',
        catchUp: false,
      },
    ],
  };

  const mockPositions = [
    {
      id: 'pos-1',
      tokenContractId: contractId,
      walletId: 'wallet-1',
      walletAddress: '0xAAA',
      settledTokenBalance: 2000,
      wallet: {
        address: '0xAAA',
        investor: { id: 'inv-1', legalName: 'Investor A' },
      },
    },
    {
      id: 'pos-2',
      tokenContractId: contractId,
      walletId: 'wallet-2',
      walletAddress: '0xBBB',
      settledTokenBalance: 3000,
      wallet: {
        address: '0xBBB',
        investor: { id: 'inv-2', legalName: 'Investor B' },
      },
    },
  ];

  let eventLog: ReturnType<typeof mockEventLog>;

  beforeEach(() => {
    prisma = mockPrisma();
    eventLog = mockEventLog();
    service = new DistributionService(
      prisma as unknown as PrismaService,
      eventLog as unknown as EventLogService,
    );
  });

  describe('getActiveWaterfallConfig', () => {
    it('returns config with tiers', async () => {
      prisma.waterfallConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await service.getActiveWaterfallConfig(fundId);

      expect(result.waterfallConfigId).toBe(configId);
      expect(result.version).toBe('1.0');
      expect(result.calculationBasis).toBe('IRR');
      expect(result.distributionFrequency).toBe('QUARTERLY');
      expect(result.catchUpEnabled).toBe(false);
      expect(result.gpPromotePct).toBe(20);
      expect(result.prefReturnPct).toBe(8);
      expect(result.rules).toEqual({ note: 'display-only' });
      expect(result.tiers).toHaveLength(2);
      expect(result.tiers[0].tierOrder).toBe(1);
      expect(result.tiers[0].tierName).toBe('Return of Capital');
      expect(result.tiers[0].lpSharePct).toBe(100);
      expect(result.tiers[0].gpSharePct).toBe(0);
      expect(result.tiers[1].hurdleValue).toBe(8);
    });

    it('throws NotFoundError when no active config', async () => {
      prisma.waterfallConfig.findFirst.mockResolvedValue(null);

      await expect(service.getActiveWaterfallConfig(fundId)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('previewDistribution', () => {
    const previewInput = {
      waterfallConfigId: configId,
      asOfTimestamp: '2026-03-07T17:00:00.000Z',
      grossDistributableAmount: '500000.00',
      currency: 'USD',
    };

    it('returns tiered waterfall line items with tier breakdown', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue(mockPositions);
      // No capital accounts — fallback uses gross allocation as contribution
      prisma.capitalAccount.findFirst.mockResolvedValue(null);

      const result = await service.previewDistribution(fundId, previewInput);

      expect(result.asOfTimestamp).toBe('2026-03-07T17:00:00.000Z');
      expect(result.summary.gross).toBe('500000.00');
      expect(result.summary.currency).toBe('USD');
      expect(result.lineItems).toHaveLength(2);

      // Investor A: 2000/5000 = 40% -> 200000
      // No capital account: contribution = grossAllocation, RoC absorbs all, net = gross
      expect(result.lineItems[0].investorId).toBe('inv-1');
      expect(result.lineItems[0].investorName).toBe('Investor A');
      expect(result.lineItems[0].ownershipPctUsed).toBe(40);
      expect(result.lineItems[0].grossAmount).toBe('200000.00');
      expect(result.lineItems[0].netAmount).toBe('200000.00');
      expect(result.lineItems[0].tierBreakdown).toBeDefined();
      expect(result.lineItems[0].tierBreakdown.returnOfCapital).toBe(
        '200000.00',
      );

      // Investor B: 3000/5000 = 60% -> 300000
      expect(result.lineItems[1].investorId).toBe('inv-2');
      expect(result.lineItems[1].ownershipPctUsed).toBe(60);
      expect(result.lineItems[1].grossAmount).toBe('300000.00');
    });

    it('applies waterfall tiers when capital accounts are available', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue(mockPositions);
      // Capital accounts with contribution < gross allocation to trigger tiers
      prisma.capitalAccount.findFirst.mockResolvedValue({
        id: 'ca-1',
        initialContribution: 100000, // Less than 200k/300k gross allocation
      });

      const result = await service.previewDistribution(fundId, previewInput);

      expect(result.lineItems).toHaveLength(2);

      // Investor A: gross = 200000, contribution = 100000
      // Tier 1 RoC: min(200000, 100000) = 100000, remaining = 100000
      // Tier 2 Pref: min(100000, 100000 * 0.08) = 8000, remaining = 92000
      // Tier 3 GP catch-up: disabled
      // Tier 4 Carried: GP gets 92000 * 0.20 = 18400
      // Net = 200000 - 18400 = 181600
      const itemA = result.lineItems[0];
      expect(itemA.grossAmount).toBe('200000.00');
      expect(itemA.tierBreakdown.returnOfCapital).toBe('100000.00');
      expect(itemA.tierBreakdown.preferredReturn).toBe('8000.00');
      expect(itemA.tierBreakdown.gpCatchUp).toBe('0.00');
      expect(itemA.tierBreakdown.carriedInterest).toBe('18400.00');
      expect(itemA.netAmount).toBe('181600.00');

      // Investor B: gross = 300000, contribution = 100000
      // Tier 1 RoC: min(300000, 100000) = 100000, remaining = 200000
      // Tier 2 Pref: min(200000, 100000 * 0.08) = 8000, remaining = 192000
      // Tier 3 GP catch-up: disabled
      // Tier 4 Carried: GP gets 192000 * 0.20 = 38400
      // Net = 300000 - 38400 = 261600
      const itemB = result.lineItems[1];
      expect(itemB.grossAmount).toBe('300000.00');
      expect(itemB.tierBreakdown.returnOfCapital).toBe('100000.00');
      expect(itemB.tierBreakdown.preferredReturn).toBe('8000.00');
      expect(itemB.tierBreakdown.gpCatchUp).toBe('0.00');
      expect(itemB.tierBreakdown.carriedInterest).toBe('38400.00');
      expect(itemB.netAmount).toBe('261600.00');

      // Summary: total promote = 18400 + 38400 = 56800
      expect(result.summary.totalPromote).toBe('56800.00');
    });

    it('applies GP catch-up when enabled', async () => {
      const configWithCatchUp = {
        ...mockConfig,
        catchUpEnabled: true,
      };
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(configWithCatchUp);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      // Single investor for simplicity
      prisma.tokenPosition.findMany.mockResolvedValue([mockPositions[0]]);
      prisma.capitalAccount.findFirst.mockResolvedValue({
        id: 'ca-1',
        initialContribution: 100000,
      });

      const singleInput = {
        ...previewInput,
        grossDistributableAmount: '200000.00',
      };
      const result = await service.previewDistribution(fundId, singleInput);

      // Investor A owns 100% (only position), gross = 200000, contribution = 100000
      // Tier 1 RoC: 100000, remaining = 100000
      // Tier 2 Pref: 8000, remaining = 92000
      // Tier 3 GP catch-up: LP has 108000, GP target = (108000 / 0.80) * 0.20 = 27000
      //   catch-up = min(92000, 27000) = 27000, remaining = 65000
      // Tier 4 Carried: GP gets 65000 * 0.20 = 13000
      // Total promote = 27000 + 13000 = 40000, Net = 160000
      const item = result.lineItems[0];
      expect(item.tierBreakdown.returnOfCapital).toBe('100000.00');
      expect(item.tierBreakdown.preferredReturn).toBe('8000.00');
      expect(item.tierBreakdown.gpCatchUp).toBe('27000.00');
      expect(item.tierBreakdown.carriedInterest).toBe('13000.00');
      expect(item.netAmount).toBe('160000.00');
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(
        service.previewDistribution('nonexistent', previewInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for missing waterfall config', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.previewDistribution(fundId, previewInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when no settled ownership', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(null);

      await expect(
        service.previewDistribution(fundId, previewInput),
      ).rejects.toThrow(ConflictError);
    });

    it('defaults currency to USD when not provided', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue(mockPositions);

      const result = await service.previewDistribution(fundId, {
        ...previewInput,
        currency: undefined,
      });

      expect(result.summary.currency).toBe('USD');
    });
  });

  describe('executeDistributionRun', () => {
    const runInput = {
      waterfallConfigId: configId,
      asOfTimestamp: '2026-03-07T17:00:00.000Z',
      grossDistributableAmount: '500000.00',
      currency: 'USD',
    };

    beforeEach(() => {
      prisma.ownershipSnapshot.create.mockResolvedValue({ id: 'snap-1' });
      prisma.ownershipSnapshotRow.create.mockResolvedValue({ id: 'row-1' });
      prisma.wallet.findFirst.mockResolvedValue({ id: 'wallet-1' });
      prisma.distributionRun.create.mockResolvedValue({ id: 'run-1' });
      prisma.distributionRun.update.mockResolvedValue({ id: 'run-1' });
      prisma.distributionLineItem.create.mockResolvedValue({ id: 'li-1' });
      prisma.capitalAccount.findFirst.mockResolvedValue({
        id: 'ca-1',
        initialContribution: 0,
      });
    });

    it('creates snapshot and line items', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue(mockPositions);

      const result = await service.executeDistributionRun(fundId, runInput);

      expect(result.distributionRunId).toBe('run-1');
      expect(result.runStatus).toBe('COMPLETED');
      expect(result.lineItemCount).toBe(2);

      // Verify snapshot was created
      expect(prisma.ownershipSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fundId,
            tokenContractId: contractId,
            snapshotType: 'RUN_START',
            source: 'DISTRIBUTION_RUN',
          }),
        }),
      );

      // Verify snapshot rows were created (one per position)
      expect(prisma.ownershipSnapshotRow.create).toHaveBeenCalledTimes(2);

      // Verify distribution run was created
      expect(prisma.distributionRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fundId,
            waterfallConfigId: configId,
            ownershipSnapshotId: 'snap-1',
            runStatus: 'RUNNING',
            currency: 'USD',
          }),
        }),
      );

      // Verify line items were created (one per position)
      expect(prisma.distributionLineItem.create).toHaveBeenCalledTimes(2);

      // Verify run was marked COMPLETED
      expect(prisma.distributionRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
          data: expect.objectContaining({
            runStatus: 'COMPLETED',
            totalGrossAmount: 500000,
            totalNetAmount: 500000,
          }),
        }),
      );
    });

    it('marks run as COMPLETED on success', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue(mockPositions);

      const result = await service.executeDistributionRun(fundId, runInput);

      expect(result.runStatus).toBe('COMPLETED');
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(
        service.executeDistributionRun('nonexistent', runInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when no settled ownership', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(null);

      await expect(
        service.executeDistributionRun(fundId, runInput),
      ).rejects.toThrow(ConflictError);
    });

    it('marks run as FAILED when line item creation errors', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.waterfallConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue(mockPositions);
      prisma.distributionLineItem.create.mockRejectedValue(
        new Error('DB constraint violation'),
      );

      await expect(
        service.executeDistributionRun(fundId, runInput),
      ).rejects.toThrow('DB constraint violation');

      expect(prisma.distributionRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
          data: expect.objectContaining({
            runStatus: 'FAILED',
            failureReason: 'DB constraint violation',
          }),
        }),
      );
    });
  });
});
