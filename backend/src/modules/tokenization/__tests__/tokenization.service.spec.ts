import { TokenizationService } from '../tokenization.service';
import { PrismaService } from '../../../prisma/prisma.service';
// Mock adapter removed — tests use inline mocks
import { EventLogService } from '../../../common/event-log.service';
import {
  NotFoundError,
  ConflictError,
  ExternalDependencyError,
} from '../../../common/errors';

const mockPrisma = () => ({
  fund: { findUnique: jest.fn() },
  subscription: {
    findUnique: jest.fn(),
  },
  tokenContract: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  tokenPositionEvent: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  tokenPosition: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

describe('TokenizationService', () => {
  let service: TokenizationService;
  let prisma: ReturnType<typeof mockPrisma>;
  let adapter: any;

  const fundId = 'fund-1';
  const subscriptionId = 'sub-1';
  const contractId = 'tc-1';
  const contractAddress = '0xabcdef1234567890abcdef1234567890abcdef12';

  const mockFund = { id: fundId, name: 'Demo Fund' };
  const mockWallet = {
    id: 'w-1',
    address: '0x1111111111111111111111111111111111111111',
  };
  const settledSubscription = {
    id: subscriptionId,
    status: 'SETTLED',
    fundId,
    walletId: 'w-1',
    allocationPct: 20,
    wallet: mockWallet,
    fund: mockFund,
  };
  const deployedContract = {
    id: contractId,
    fundId,
    contractAddress,
    deploymentStatus: 'DEPLOYED',
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = mockPrisma();
    adapter = {
      deploy: jest.fn().mockResolvedValue({
        contractAddress: contractAddress,
        txHash: '0x' + 'ab'.repeat(32),
        blockNumber: 100,
      }),
      mint: jest.fn().mockResolvedValue({
        txHash: '0x' + 'cd'.repeat(32),
        blockNumber: 101,
      }),
      transfer: jest.fn(),
      getBalance: jest.fn(),
    };
    const mockEventLog = {
      log: jest.fn().mockResolvedValue({}),
    } as unknown as EventLogService;
    service = new TokenizationService(
      prisma as unknown as PrismaService,
      adapter,
      mockEventLog,
    );
  });

  describe('ensureContract', () => {
    it('creates new contract on first call', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(null);
      prisma.tokenContract.create.mockImplementation(async ({ data }) => ({
        id: 'tc-new',
        contractAddress: data.contractAddress,
        deploymentStatus: data.deploymentStatus,
      }));

      const result = await service.ensureContract(fundId);

      expect(result.deploymentStatus).toBe('DEPLOYED');
      expect(result.contractAddress).toBeTruthy();
      expect(result.tokenContractId).toBe('tc-new');
      expect(prisma.tokenContract.create).toHaveBeenCalledTimes(1);
    });

    it('returns existing contract on second call', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(deployedContract);

      const result = await service.ensureContract(fundId);

      expect(result.tokenContractId).toBe(contractId);
      expect(result.contractAddress).toBe(contractAddress);
      expect(prisma.tokenContract.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when fund does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(service.ensureContract('no-fund')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('mintForSubscription', () => {
    it('succeeds for SETTLED subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(settledSubscription);
      prisma.tokenPositionEvent.findFirst.mockResolvedValue(null); // no existing mint
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      // ensureContract: first findFirst returns null (no existing), then after create, second findFirst returns the contract
      prisma.tokenContract.findFirst
        .mockResolvedValueOnce(null) // ensureContract check
        .mockResolvedValueOnce(deployedContract); // after ensureContract, find for mint
      prisma.tokenContract.create.mockImplementation(async ({ data }) => ({
        id: contractId,
        contractAddress: data.contractAddress,
        deploymentStatus: 'DEPLOYED',
      }));
      prisma.tokenPositionEvent.create.mockResolvedValue({
        id: 'evt-1',
      });
      prisma.tokenPosition.findFirst.mockResolvedValue(null); // no existing position
      prisma.tokenPosition.create.mockResolvedValue({ id: 'pos-1' });

      const result = await service.mintForSubscription(subscriptionId);

      expect(result.status).toBe('CONFIRMED');
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.tokenAmount).toBe('2000'); // 20% of 10000
      expect(result.mintRequestId).toBe('evt-1');
      expect(prisma.tokenPositionEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.tokenPosition.create).toHaveBeenCalledTimes(1);
    });

    it('rejects non-SETTLED subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...settledSubscription,
        status: 'PENDING',
      });

      await expect(service.mintForSubscription(subscriptionId)).rejects.toThrow(
        ConflictError,
      );
      await expect(service.mintForSubscription(subscriptionId)).rejects.toThrow(
        'Subscription must be SETTLED',
      );
    });

    it('rejects already-minted subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(settledSubscription);
      prisma.tokenPositionEvent.findFirst.mockResolvedValue({
        id: 'evt-existing',
        eventType: 'MINT',
      });

      await expect(service.mintForSubscription(subscriptionId)).rejects.toThrow(
        ConflictError,
      );
      await expect(service.mintForSubscription(subscriptionId)).rejects.toThrow(
        'already minted',
      );
    });

    it('rejects when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.mintForSubscription('no-sub')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('updates existing token position on repeat mint to same wallet', async () => {
      prisma.subscription.findUnique.mockResolvedValue(settledSubscription);
      prisma.tokenPositionEvent.findFirst.mockResolvedValue(null);
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst
        .mockResolvedValueOnce(deployedContract) // ensureContract finds existing
        .mockResolvedValueOnce(deployedContract); // mint finds it too
      prisma.tokenPositionEvent.create.mockResolvedValue({ id: 'evt-2' });
      prisma.tokenPosition.findFirst.mockResolvedValue({
        id: 'pos-existing',
        settledTokenBalance: 1000,
      });
      prisma.tokenPosition.update.mockResolvedValue({ id: 'pos-existing' });

      const result = await service.mintForSubscription(subscriptionId);

      expect(result.status).toBe('CONFIRMED');
      expect(prisma.tokenPosition.update).toHaveBeenCalledTimes(1);
      expect(prisma.tokenPosition.create).not.toHaveBeenCalled();
    });
  });
});
