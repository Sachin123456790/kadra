import { OwnershipService } from '../ownership.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundError } from '../../../common/errors';

const mockPrisma = () => ({
  fund: {
    findUnique: jest.fn(),
  },
  tokenContract: {
    findFirst: jest.fn(),
  },
  tokenPosition: {
    findMany: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
  },
  tokenPositionEvent: {
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
    findMany: jest.fn(),
  },
});

describe('OwnershipService', () => {
  let service: OwnershipService;
  let prisma: ReturnType<typeof mockPrisma>;

  const fundId = 'fund-1';
  const contractId = 'contract-1';

  const mockFund = { id: fundId, name: 'Test Fund', status: 'ACTIVE' };
  const mockContract = {
    id: contractId,
    fundId,
    deploymentStatus: 'DEPLOYED',
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = mockPrisma();
    service = new OwnershipService(prisma as unknown as PrismaService);
  });

  describe('getCapTable', () => {
    it('returns positions with ownership %', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          tokenContractId: contractId,
          walletAddress: '0xABC',
          settledTokenBalance: 2000,
          wallet: {
            address: '0xABC',
            investor: { id: 'inv-1', legalName: 'Investor A' },
          },
        },
        {
          id: 'pos-2',
          tokenContractId: contractId,
          walletAddress: '0xDEF',
          settledTokenBalance: 3000,
          wallet: {
            address: '0xDEF',
            investor: { id: 'inv-2', legalName: 'Investor B' },
          },
        },
      ]);
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getCapTable(fundId);

      expect(result.fundId).toBe(fundId);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].ownershipPct).toBe(40); // 2000/5000 * 100
      expect(result.rows[1].ownershipPct).toBe(60); // 3000/5000 * 100
      expect(result.rows[0].settledTokenBalance).toBe('2000');
      expect(result.rows[0].investorName).toBe('Investor A');
    });

    it('includes pending subscriptions when includePending is true', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(null); // no contract deployed
      prisma.tokenPosition.findMany.mockResolvedValue([]); // won't be called, but safe
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          investorId: 'inv-1',
          allocationPct: 20,
          investor: { id: 'inv-1', legalName: 'Investor A' },
          wallet: { address: '0xABC' },
        },
      ]);

      const result = await service.getCapTable(fundId, {
        includePending: true,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].pendingAllocationPct).toBe(20);
      expect(result.rows[0].settledTokenBalance).toBe('0');
      expect(result.rows[0].ownershipPct).toBe(0);
    });

    it('merges pending allocation into existing settled row', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          tokenContractId: contractId,
          walletAddress: '0xabc',
          settledTokenBalance: 5000,
          wallet: {
            address: '0xabc',
            investor: { id: 'inv-1', legalName: 'Investor A' },
          },
        },
      ]);
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          investorId: 'inv-1',
          allocationPct: 20,
          investor: { id: 'inv-1', legalName: 'Investor A' },
          wallet: { address: '0xABC' }, // different case
        },
      ]);

      const result = await service.getCapTable(fundId, {
        includePending: true,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].pendingAllocationPct).toBe(20);
      expect(result.rows[0].ownershipPct).toBe(100);
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(service.getCapTable('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('returns empty rows when no contract and no pending subs', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(null);
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getCapTable(fundId);

      expect(result.rows).toHaveLength(0);
    });

    it('excludes pending when includePending is false', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(null);

      const result = await service.getCapTable(fundId, {
        includePending: false,
      });

      expect(result.rows).toHaveLength(0);
      expect(prisma.subscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getOwnershipHistory', () => {
    const now = new Date('2026-03-07T17:00:00.000Z');

    it('returns events filtered by wallet', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenPositionEvent.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          eventType: 'MINT',
          fromWalletAddress: null,
          toWalletAddress: '0xABC',
          tokenAmount: 2000,
          txHash: '0xtx1',
          blockNumber: BigInt(100),
          blockTimestamp: now,
        },
      ]);

      const result = await service.getOwnershipHistory(fundId, {
        walletAddress: '0xABC',
      });

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe('evt-1');
      expect(result[0].eventType).toBe('MINT');
      expect(result[0].tokenDelta).toBe('2000');
      expect(result[0].blockNumber).toBe(100);
      expect(result[0].eventTimestamp).toBe(now.toISOString());
    });

    it('returns events filtered by time range', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenPositionEvent.findMany.mockResolvedValue([]);

      await service.getOwnershipHistory(fundId, {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.999Z',
      });

      const whereArg =
        prisma.tokenPositionEvent.findMany.mock.calls[0][0].where;
      expect(whereArg.blockTimestamp.gte).toEqual(
        new Date('2026-01-01T00:00:00.000Z'),
      );
      expect(whereArg.blockTimestamp.lte).toEqual(
        new Date('2026-12-31T23:59:59.999Z'),
      );
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(service.getOwnershipHistory('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('createSnapshot', () => {
    it('persists snapshot rows', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(mockContract);
      prisma.tokenPosition.findMany.mockResolvedValue([
        {
          id: 'pos-1',
          tokenContractId: contractId,
          walletAddress: '0xABC',
          settledTokenBalance: 5000,
          wallet: {
            address: '0xABC',
            investor: { id: 'inv-1', legalName: 'Investor A' },
          },
        },
      ]);
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.ownershipSnapshot.create.mockResolvedValue({ id: 'snap-1' });
      prisma.wallet.findFirst.mockResolvedValue({ id: 'wallet-1' });
      prisma.ownershipSnapshotRow.create.mockResolvedValue({ id: 'row-1' });

      const result = await service.createSnapshot(fundId);

      expect(result.snapshotId).toBe('snap-1');
      expect(result.rowCount).toBe(1);
      expect(prisma.ownershipSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fundId,
            tokenContractId: contractId,
            snapshotType: 'ON_DEMAND',
            source: 'EVENTS_REBUILD',
          }),
        }),
      );
      expect(prisma.ownershipSnapshotRow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            snapshotId: 'snap-1',
            investorId: 'inv-1',
            walletId: 'wallet-1',
            walletAddress: '0xABC',
            settledTokenBalance: 5000,
            ownershipPct: 100,
          }),
        }),
      );
    });

    it('uses custom snapshot type', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(null);
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.ownershipSnapshot.create.mockResolvedValue({ id: 'snap-2' });

      const result = await service.createSnapshot(fundId, 'RUN_START');

      expect(result.snapshotId).toBe('snap-2');
      expect(prisma.ownershipSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            snapshotType: 'RUN_START',
          }),
        }),
      );
    });
  });

  describe('getCapitalAccounts', () => {
    it('returns capital accounts with investor info', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.capitalAccount.findMany.mockResolvedValue([
        {
          id: 'ca-1',
          investorId: 'inv-1',
          investor: { legalName: 'Investor A' },
          openingBalance: { toString: () => '0.00' },
          initialContribution: { toString: () => '1000000.00' },
          capitalReturned: { toString: () => '0.00' },
          accruedPref: { toString: () => '80000.00' },
          residualAllocation: { toString: () => '0.00' },
          endingCapitalBalance: { toString: () => '1080000.00' },
          asOfDate: new Date('2026-01-01'),
        },
      ]);

      const result = await service.getCapitalAccounts(fundId);

      expect(result).toHaveLength(1);
      expect(result[0].investorName).toBe('Investor A');
      expect(result[0].initialContribution).toBe('1000000.00');
      expect(result[0].endingBalance).toBe('1080000.00');
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(service.getCapitalAccounts('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
