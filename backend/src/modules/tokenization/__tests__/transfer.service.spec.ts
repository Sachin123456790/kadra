import { TokenizationService } from '../tokenization.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MockTokenContractAdapter } from '../../../adapters/blockchain/mock-token-contract.adapter';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError } from '../../../common/errors';

const mockPrisma = () => {
  const txProxy = {
    tokenPosition: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    capitalAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  return {
    fund: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn() },
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
    wallet: { findFirst: jest.fn() },
    investorFundEligibility: { findFirst: jest.fn() },
    transferRequest: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    transferEvent: { create: jest.fn() },
    $transaction: jest
      .fn()
      .mockImplementation(async (fn: (tx: typeof txProxy) => Promise<void>) => {
        await fn(txProxy);
      }),
    _tx: txProxy,
  };
};

describe('TokenizationService – Transfer Enforcement', () => {
  let service: TokenizationService;
  let prisma: ReturnType<typeof mockPrisma>;
  let adapter: MockTokenContractAdapter;

  const fundId = 'fund-1';
  const contractId = 'tc-1';
  const contractAddress = '0xabcdef1234567890abcdef1234567890abcdef12';

  const mockFund = { id: fundId, name: 'Demo Fund' };
  const deployedContract = {
    id: contractId,
    fundId,
    contractAddress,
    deploymentStatus: 'DEPLOYED',
    deletedAt: null,
  };

  const senderWallet = {
    id: 'w-1',
    address: '0x1111111111111111111111111111111111111111',
    addressNorm: '0x1111111111111111111111111111111111111111',
    deletedAt: null,
  };
  const recipientWallet = {
    id: 'w-2',
    address: '0x2222222222222222222222222222222222222222',
    addressNorm: '0x2222222222222222222222222222222222222222',
    deletedAt: null,
  };

  const senderEligibility = {
    id: 'ife-1',
    fundId,
    walletId: 'w-1',
    eligibilityStatus: 'ELIGIBLE',
    deletedAt: null,
  };
  const recipientEligibility = {
    id: 'ife-2',
    fundId,
    walletId: 'w-2',
    eligibilityStatus: 'ELIGIBLE',
    deletedAt: null,
  };

  const senderPosition = {
    id: 'pos-1',
    tokenContractId: contractId,
    walletAddressNorm: senderWallet.addressNorm,
    settledTokenBalance: 2000,
  };

  const transferInput = {
    fromWalletAddress: senderWallet.address,
    toWalletAddress: recipientWallet.address,
    tokenAmount: '500',
    reason: 'LP transfer',
  };

  beforeEach(() => {
    prisma = mockPrisma();
    adapter = new MockTokenContractAdapter();
    const mockEventLog = {
      log: jest.fn().mockResolvedValue({}),
    } as unknown as EventLogService;
    service = new TokenizationService(
      prisma as unknown as PrismaService,
      adapter,
      mockEventLog,
    );
  });

  function setupSuccessfulTransfer() {
    prisma.fund.findUnique.mockResolvedValue(mockFund);
    prisma.tokenContract.findFirst.mockResolvedValue(deployedContract);
    prisma.wallet.findFirst
      .mockResolvedValueOnce({ ...senderWallet, investorId: 'inv-1' })
      .mockResolvedValueOnce({ ...recipientWallet, investorId: 'inv-2' });
    prisma.investorFundEligibility.findFirst
      .mockResolvedValueOnce(senderEligibility)
      .mockResolvedValueOnce(recipientEligibility);
    prisma.tokenPosition.findFirst.mockResolvedValueOnce(senderPosition); // balance check
    prisma.transferRequest.create.mockResolvedValue({
      id: 'tr-1',
      requestStatus: 'REQUESTED',
    });
    prisma.transferRequest.update.mockResolvedValue({ id: 'tr-1' });
    prisma.transferEvent.create.mockResolvedValue({ id: 'te-1' });
    prisma.tokenPositionEvent.create.mockResolvedValue({ id: 'tpe-1' });
    prisma.tokenPosition.update.mockResolvedValue({});
    // Set up transaction proxy mocks
    prisma._tx.tokenPosition.findFirst.mockResolvedValue({
      id: 'pos-2',
      settledTokenBalance: 1000,
    });
    prisma._tx.tokenPosition.update.mockResolvedValue({});
    prisma._tx.capitalAccount.findFirst.mockResolvedValue(null);
    // Mock the adapter transfer to return a successful result
    jest.spyOn(adapter, 'transfer').mockResolvedValue({
      txHash: '0x' + 'a'.repeat(64),
      blockNumber: 101,
    });
  }

  describe('initiateTransfer', () => {
    it('succeeds between eligible wallets with sufficient balance', async () => {
      setupSuccessfulTransfer();

      const result = await service.initiateTransfer(fundId, transferInput);

      expect(result.requestStatus).toBe('MINED');
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.precheck.senderEligible).toBe(true);
      expect(result.precheck.recipientEligible).toBe(true);
      expect(result.precheck.sufficientBalance).toBe(true);
      expect(prisma.transferRequest.create).toHaveBeenCalledTimes(1);
      expect(prisma.transferEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.tokenPositionEvent.create).toHaveBeenCalledTimes(1);
      // Both sender and recipient positions updated inside transaction
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('fails pre-check when recipient is not eligible', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(deployedContract);
      prisma.wallet.findFirst
        .mockResolvedValueOnce(senderWallet)
        .mockResolvedValueOnce(recipientWallet);
      prisma.investorFundEligibility.findFirst
        .mockResolvedValueOnce(senderEligibility)
        .mockResolvedValueOnce(null); // recipient NOT eligible
      prisma.tokenPosition.findFirst.mockResolvedValueOnce(senderPosition);
      prisma.transferRequest.create.mockResolvedValue({
        id: 'tr-2',
        requestStatus: 'REQUESTED',
      });
      prisma.transferRequest.update.mockResolvedValue({ id: 'tr-2' });
      prisma.transferEvent.create.mockResolvedValue({ id: 'te-2' });

      const result = await service.initiateTransfer(fundId, transferInput);

      expect(result.requestStatus).toBe('PRECHECK_FAILED');
      expect(result.precheck.recipientEligible).toBe(false);
      expect(result.precheck.senderEligible).toBe(true);
      expect(result.txHash).toBeNull();
      expect(prisma.transferEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKind: 'PRECHECK_FAILED',
            reasonCode: 'RECIPIENT_NOT_ELIGIBLE',
          }),
        }),
      );
    });

    it('fails pre-check when sender is not eligible', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(deployedContract);
      prisma.wallet.findFirst
        .mockResolvedValueOnce(senderWallet)
        .mockResolvedValueOnce(recipientWallet);
      prisma.investorFundEligibility.findFirst
        .mockResolvedValueOnce(null) // sender NOT eligible
        .mockResolvedValueOnce(recipientEligibility);
      prisma.tokenPosition.findFirst.mockResolvedValueOnce(senderPosition);
      prisma.transferRequest.create.mockResolvedValue({
        id: 'tr-3',
        requestStatus: 'REQUESTED',
      });
      prisma.transferRequest.update.mockResolvedValue({ id: 'tr-3' });
      prisma.transferEvent.create.mockResolvedValue({ id: 'te-3' });

      const result = await service.initiateTransfer(fundId, transferInput);

      expect(result.requestStatus).toBe('PRECHECK_FAILED');
      expect(result.precheck.senderEligible).toBe(false);
      expect(result.txHash).toBeNull();
    });

    it('fails pre-check when balance is insufficient', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(deployedContract);
      prisma.wallet.findFirst
        .mockResolvedValueOnce(senderWallet)
        .mockResolvedValueOnce(recipientWallet);
      prisma.investorFundEligibility.findFirst
        .mockResolvedValueOnce(senderEligibility)
        .mockResolvedValueOnce(recipientEligibility);
      prisma.tokenPosition.findFirst.mockResolvedValueOnce({
        ...senderPosition,
        settledTokenBalance: 100, // only 100, requesting 500
      });
      prisma.transferRequest.create.mockResolvedValue({
        id: 'tr-4',
        requestStatus: 'REQUESTED',
      });
      prisma.transferRequest.update.mockResolvedValue({ id: 'tr-4' });
      prisma.transferEvent.create.mockResolvedValue({ id: 'te-4' });

      const result = await service.initiateTransfer(fundId, transferInput);

      expect(result.requestStatus).toBe('PRECHECK_FAILED');
      expect(result.precheck.sufficientBalance).toBe(false);
      expect(result.precheck.senderEligible).toBe(true);
      expect(result.precheck.recipientEligible).toBe(true);
      expect(result.txHash).toBeNull();
    });

    it('returns CHAIN_REVERTED when adapter throws', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.tokenContract.findFirst.mockResolvedValue(deployedContract);
      prisma.wallet.findFirst
        .mockResolvedValueOnce(senderWallet)
        .mockResolvedValueOnce(recipientWallet);
      prisma.investorFundEligibility.findFirst
        .mockResolvedValueOnce(senderEligibility)
        .mockResolvedValueOnce(recipientEligibility);
      prisma.tokenPosition.findFirst.mockResolvedValueOnce(senderPosition);
      prisma.transferRequest.create.mockResolvedValue({
        id: 'tr-5',
        requestStatus: 'REQUESTED',
      });
      prisma.transferRequest.update.mockResolvedValue({ id: 'tr-5' });
      prisma.transferEvent.create.mockResolvedValue({ id: 'te-5' });

      // Mock adapter to throw
      jest
        .spyOn(adapter, 'transfer')
        .mockRejectedValue(new Error('execution reverted'));

      const result = await service.initiateTransfer(fundId, transferInput);

      expect(result.requestStatus).toBe('CHAIN_REVERTED');
      expect(result.txHash).toBeNull();
      expect(prisma.transferEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKind: 'CHAIN_REVERTED',
            reasonCode: 'CONTRACT_REVERT',
          }),
        }),
      );
    });
  });

  describe('getTransferValidation', () => {
    it('returns correct status for a failed transfer', async () => {
      prisma.transferRequest.findUnique.mockResolvedValue({
        id: 'tr-fail',
        requestStatus: 'PRECHECK_FAILED',
        precheckPassed: false,
        precheckReasonCode: 'RECIPIENT_NOT_ELIGIBLE',
        submittedTxHash: null,
        finalizedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const result = await service.getTransferValidation('tr-fail');

      expect(result.requestStatus).toBe('PRECHECK_FAILED');
      expect(result.precheckResult).toBeTruthy();
      expect(result.precheckResult!.recipientEligible).toBe(false);
      expect(result.precheckResult!.senderEligible).toBe(true);
      expect(result.precheckResult!.sufficientBalance).toBe(true);
      expect(result.precheckResult!.failureCode).toBe('RECIPIENT_NOT_ELIGIBLE');
      expect(result.txHash).toBeNull();
    });

    it('throws NotFoundError for unknown transfer request', async () => {
      prisma.transferRequest.findUnique.mockResolvedValue(null);

      await expect(service.getTransferValidation('no-such-id')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getFailedTransfers', () => {
    it('returns PRECHECK_FAILED and CHAIN_REVERTED transfers', async () => {
      prisma.transferRequest.findMany.mockResolvedValue([
        {
          id: 'tr-a',
          requestStatus: 'PRECHECK_FAILED',
          precheckReasonCode: 'SENDER_NOT_ELIGIBLE',
          fromWalletAddress: '0xaaa',
          toWalletAddress: '0xbbb',
          tokenAmount: { toString: () => '100' },
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'tr-b',
          requestStatus: 'CHAIN_REVERTED',
          precheckReasonCode: 'CONTRACT_REVERT',
          fromWalletAddress: '0xccc',
          toWalletAddress: '0xddd',
          tokenAmount: { toString: () => '200' },
          createdAt: new Date('2026-01-02T00:00:00Z'),
        },
      ]);

      const result = await service.getFailedTransfers(fundId);

      expect(result).toHaveLength(2);
      expect(result[0].failureStage).toBe('PRECHECK');
      expect(result[0].failureCode).toBe('SENDER_NOT_ELIGIBLE');
      expect(result[1].failureStage).toBe('CHAIN');
      expect(result[1].failureCode).toBe('CONTRACT_REVERT');
    });
  });

  describe('getSuccessfulTransfers', () => {
    it('returns only MINED transfers', async () => {
      prisma.transferRequest.findMany.mockResolvedValue([
        {
          id: 'tr-ok',
          fromWalletAddress: '0xaaa',
          toWalletAddress: '0xbbb',
          tokenAmount: { toString: () => '500' },
          submittedTxHash: '0xdeadbeef',
          createdAt: new Date('2026-01-03T00:00:00Z'),
        },
      ]);

      const result = await service.getSuccessfulTransfers(fundId);

      expect(result).toHaveLength(1);
      expect(result[0].transferRequestId).toBe('tr-ok');
      expect(result[0].txHash).toBe('0xdeadbeef');
      expect(result[0].tokenAmount).toBe('500');
    });
  });
});
