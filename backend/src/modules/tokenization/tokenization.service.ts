import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { TokenContractAdapter } from '../../adapters/blockchain/token-contract.adapter';
import { TOKEN_CONTRACT_ADAPTER } from '../../adapters/blockchain/token-contract.adapter';
import {
  NotFoundError,
  ConflictError,
  ExternalDependencyError,
} from '../../common/errors';

@Injectable()
export class TokenizationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_CONTRACT_ADAPTER)
    private readonly tokenAdapter: TokenContractAdapter,
  ) {}

  async ensureContract(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    // Check for existing deployed contract
    const existing = await this.prisma.tokenContract.findFirst({
      where: { fundId, deletedAt: null, deploymentStatus: 'DEPLOYED' },
    });

    if (existing)
      return {
        tokenContractId: existing.id,
        contractAddress: existing.contractAddress,
        deploymentStatus: existing.deploymentStatus,
      };

    // Deploy new contract
    const result = await this.tokenAdapter.deploy({
      name: fund.name + ' Token',
      symbol: 'KDRA',
      identityRegistryAddress:
        '0x0000000000000000000000000000000000000000', // Mock for MVP
    });

    const contract = await this.prisma.tokenContract.create({
      data: {
        fundId,
        chainId: 31337,
        contractAddress: result.contractAddress,
        contractAddressNorm: result.contractAddress.toLowerCase(),
        tokenStandard: 'ERC-3643',
        deploymentStatus: 'DEPLOYED',
        deploymentTxHash: result.txHash,
        deployedBlockNumber: BigInt(result.blockNumber),
        deployedAt: new Date(),
        transferRestrictionsEnabled: true,
        metadata: {},
      },
    });

    return {
      tokenContractId: contract.id,
      contractAddress: contract.contractAddress,
      deploymentStatus: contract.deploymentStatus,
    };
  }

  async mintForSubscription(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { wallet: true, fund: true },
    });
    if (!subscription) throw new NotFoundError('Subscription', subscriptionId);
    if (subscription.status !== 'SETTLED') {
      throw new ConflictError(
        'SUBSCRIPTION_NOT_SETTLED',
        'Subscription must be SETTLED before minting',
      );
    }

    // Check for existing confirmed mint
    const existingMint = await this.prisma.tokenPositionEvent.findFirst({
      where: {
        relatedSubscriptionId: subscriptionId,
        eventType: 'MINT',
      },
    });
    if (existingMint) {
      throw new ConflictError(
        'MINT_ALREADY_CONFIRMED',
        'Tokens already minted for this subscription',
      );
    }

    // Ensure contract exists
    await this.ensureContract(subscription.fundId);
    const contract = await this.prisma.tokenContract.findFirst({
      where: {
        fundId: subscription.fundId,
        deploymentStatus: 'DEPLOYED',
        deletedAt: null,
      },
    });
    if (!contract)
      throw new ExternalDependencyError(
        'Blockchain',
        'No deployed contract found',
      );

    // Calculate token amount (allocation % of total supply, e.g., 20% of 10000 = 2000)
    const totalSupply = 10000;
    const tokenAmount =
      (Number(subscription.allocationPct) / 100) * totalSupply;

    try {
      const result = await this.tokenAdapter.mint({
        contractAddress: contract.contractAddress,
        toAddress: subscription.wallet.address,
        amount: tokenAmount.toString(),
      });

      // Record the mint event
      const event = await this.prisma.tokenPositionEvent.create({
        data: {
          fundId: subscription.fundId,
          tokenContractId: contract.id,
          chainId: 31337,
          blockNumber: BigInt(result.blockNumber),
          blockTimestamp: new Date(),
          txHash: result.txHash,
          logIndex: 0,
          eventType: 'MINT',
          fromWalletAddress: '0x0000000000000000000000000000000000000000',
          toWalletAddress: subscription.wallet.address,
          tokenAmount: tokenAmount,
          relatedSubscriptionId: subscriptionId,
          ingestStatus: 'CONFIRMED',
          rawEvent: {
            type: 'MINT',
            subscriptionId,
            amount: tokenAmount,
          },
        },
      });

      // Update or create token position
      const existingPosition = await this.prisma.tokenPosition.findFirst({
        where: {
          tokenContractId: contract.id,
          walletAddressNorm: subscription.wallet.address.toLowerCase(),
        },
      });

      if (existingPosition) {
        await this.prisma.tokenPosition.update({
          where: { id: existingPosition.id },
          data: {
            settledTokenBalance: { increment: tokenAmount },
            lastEventId: event.id,
            asOfBlockNumber: BigInt(result.blockNumber),
            asOfTimestamp: new Date(),
          },
        });
      } else {
        await this.prisma.tokenPosition.create({
          data: {
            fundId: subscription.fundId,
            tokenContractId: contract.id,
            walletId: subscription.walletId,
            walletAddress: subscription.wallet.address,
            walletAddressNorm: subscription.wallet.address.toLowerCase(),
            settledTokenBalance: tokenAmount,
            lastEventId: event.id,
            asOfBlockNumber: BigInt(result.blockNumber),
            asOfTimestamp: new Date(),
          },
        });
      }

      return {
        mintRequestId: event.id,
        status: 'CONFIRMED',
        txHash: result.txHash,
        tokenAmount: tokenAmount.toString(),
      };
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError)
        throw error;
      throw new ExternalDependencyError(
        'Blockchain',
        `Mint failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async initiateTransfer(
    fundId: string,
    input: {
      fromWalletAddress: string;
      toWalletAddress: string;
      tokenAmount: string;
      reason?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });
    if (!contract) throw new NotFoundError('TokenContract', fundId);

    // Pre-check: sender eligibility
    const senderWallet = await this.prisma.wallet.findFirst({
      where: {
        addressNorm: input.fromWalletAddress.toLowerCase(),
        deletedAt: null,
      },
    });
    const senderEligible = senderWallet
      ? await this.prisma.investorFundEligibility.findFirst({
          where: {
            fundId,
            walletId: senderWallet.id,
            eligibilityStatus: 'ELIGIBLE',
            deletedAt: null,
          },
        })
      : null;

    // Pre-check: recipient eligibility
    const recipientWallet = await this.prisma.wallet.findFirst({
      where: {
        addressNorm: input.toWalletAddress.toLowerCase(),
        deletedAt: null,
      },
    });
    const recipientEligible = recipientWallet
      ? await this.prisma.investorFundEligibility.findFirst({
          where: {
            fundId,
            walletId: recipientWallet.id,
            eligibilityStatus: 'ELIGIBLE',
            deletedAt: null,
          },
        })
      : null;

    // Pre-check: balance
    const position = await this.prisma.tokenPosition.findFirst({
      where: {
        tokenContractId: contract.id,
        walletAddressNorm: input.fromWalletAddress.toLowerCase(),
      },
    });
    const balance = position ? Number(position.settledTokenBalance) : 0;
    const amount = parseFloat(input.tokenAmount);
    const sufficientBalance = balance >= amount;

    // Create transfer request
    const transferRequest = await this.prisma.transferRequest.create({
      data: {
        fundId,
        tokenContractId: contract.id,
        fromWalletId: senderWallet?.id,
        fromWalletAddress: input.fromWalletAddress,
        toWalletId: recipientWallet?.id,
        toWalletAddress: input.toWalletAddress,
        tokenAmount: amount,
        requestStatus: 'REQUESTED',
        metadata: { reason: input.reason },
      },
    });

    // Evaluate pre-checks
    let failureCode: string | null = null;
    if (!senderEligible) failureCode = 'SENDER_NOT_ELIGIBLE';
    else if (!recipientEligible) failureCode = 'RECIPIENT_NOT_ELIGIBLE';
    else if (!sufficientBalance) failureCode = 'INSUFFICIENT_BALANCE';

    if (failureCode) {
      // Pre-check failed
      await this.prisma.transferRequest.update({
        where: { id: transferRequest.id },
        data: {
          requestStatus: 'PRECHECK_FAILED',
          precheckPassed: false,
          precheckReasonCode: failureCode,
          precheckReasonText: failureCode.replace(/_/g, ' ').toLowerCase(),
          finalizedAt: new Date(),
        },
      });

      await this.prisma.transferEvent.create({
        data: {
          transferRequestId: transferRequest.id,
          fundId,
          tokenContractId: contract.id,
          eventKind: 'PRECHECK_FAILED',
          reasonCode: failureCode,
          reasonText: failureCode.replace(/_/g, ' ').toLowerCase(),
          payload: {
            fromWallet: input.fromWalletAddress,
            toWallet: input.toWalletAddress,
          },
        },
      });

      return {
        transferRequestId: transferRequest.id,
        requestStatus: 'PRECHECK_FAILED',
        precheck: {
          recipientEligible: !!recipientEligible,
          senderEligible: !!senderEligible,
          sufficientBalance,
        },
        txHash: null,
      };
    }

    // Pre-check passed — submit to chain
    try {
      const result = await this.tokenAdapter.transfer({
        contractAddress: contract.contractAddress,
        fromAddress: input.fromWalletAddress,
        toAddress: input.toWalletAddress,
        amount: input.tokenAmount,
      });

      await this.prisma.transferRequest.update({
        where: { id: transferRequest.id },
        data: {
          requestStatus: 'MINED',
          precheckPassed: true,
          submittedTxHash: result.txHash,
          submittedAt: new Date(),
          finalizedAt: new Date(),
        },
      });

      // Record transfer event
      await this.prisma.transferEvent.create({
        data: {
          transferRequestId: transferRequest.id,
          fundId,
          tokenContractId: contract.id,
          eventKind: 'MINED',
          txHash: result.txHash,
          blockNumber: BigInt(result.blockNumber),
          blockTimestamp: new Date(),
          payload: {
            fromWallet: input.fromWalletAddress,
            toWallet: input.toWalletAddress,
            amount: input.tokenAmount,
          },
        },
      });

      // Record token position event
      await this.prisma.tokenPositionEvent.create({
        data: {
          fundId,
          tokenContractId: contract.id,
          chainId: 31337,
          blockNumber: BigInt(result.blockNumber),
          blockTimestamp: new Date(),
          txHash: result.txHash,
          logIndex: 0,
          eventType: 'TRANSFER',
          fromWalletAddress: input.fromWalletAddress,
          toWalletAddress: input.toWalletAddress,
          tokenAmount: amount,
          relatedTransferRequestId: transferRequest.id,
          ingestStatus: 'CONFIRMED',
          rawEvent: {
            type: 'TRANSFER',
            from: input.fromWalletAddress,
            to: input.toWalletAddress,
            amount,
          },
        },
      });

      // Update positions atomically
      await this.prisma.$transaction(async (tx) => {
        if (position) {
          await tx.tokenPosition.update({
            where: { id: position.id },
            data: { settledTokenBalance: { decrement: amount } },
          });
        }

        const recipientPosition = await tx.tokenPosition.findFirst({
          where: {
            tokenContractId: contract.id,
            walletAddressNorm: input.toWalletAddress.toLowerCase(),
          },
        });
        if (recipientPosition) {
          await tx.tokenPosition.update({
            where: { id: recipientPosition.id },
            data: { settledTokenBalance: { increment: amount } },
          });
        } else {
          await tx.tokenPosition.create({
            data: {
              fundId,
              tokenContractId: contract.id,
              walletId: recipientWallet?.id,
              walletAddress: input.toWalletAddress,
              walletAddressNorm: input.toWalletAddress.toLowerCase(),
              settledTokenBalance: amount,
            },
          });
        }
      });

      return {
        transferRequestId: transferRequest.id,
        requestStatus: 'MINED',
        precheck: {
          recipientEligible: true,
          senderEligible: true,
          sufficientBalance: true,
        },
        txHash: result.txHash,
      };
    } catch (error) {
      await this.prisma.transferRequest.update({
        where: { id: transferRequest.id },
        data: {
          requestStatus: 'CHAIN_REVERTED',
          precheckPassed: true,
          finalizedAt: new Date(),
        },
      });

      await this.prisma.transferEvent.create({
        data: {
          transferRequestId: transferRequest.id,
          fundId,
          tokenContractId: contract.id,
          eventKind: 'CHAIN_REVERTED',
          reasonCode: 'CONTRACT_REVERT',
          reasonText:
            error instanceof Error ? error.message : 'unknown',
          payload: {},
        },
      });

      return {
        transferRequestId: transferRequest.id,
        requestStatus: 'CHAIN_REVERTED',
        precheck: {
          recipientEligible: true,
          senderEligible: true,
          sufficientBalance: true,
        },
        txHash: null,
      };
    }
  }

  async getTransferValidation(transferRequestId: string) {
    const req = await this.prisma.transferRequest.findUnique({
      where: { id: transferRequestId },
    });
    if (!req) throw new NotFoundError('TransferRequest', transferRequestId);

    return {
      transferRequestId: req.id,
      requestStatus: req.requestStatus,
      precheckResult:
        req.precheckPassed === false
          ? {
              recipientEligible:
                req.precheckReasonCode !== 'RECIPIENT_NOT_ELIGIBLE',
              senderEligible:
                req.precheckReasonCode !== 'SENDER_NOT_ELIGIBLE',
              sufficientBalance:
                req.precheckReasonCode !== 'INSUFFICIENT_BALANCE',
              failureCode: req.precheckReasonCode,
            }
          : null,
      txHash: req.submittedTxHash,
      finalizedAt: req.finalizedAt?.toISOString(),
    };
  }

  async getFailedTransfers(fundId: string) {
    const transfers = await this.prisma.transferRequest.findMany({
      where: {
        fundId,
        requestStatus: { in: ['PRECHECK_FAILED', 'CHAIN_REVERTED'] },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => ({
      transferRequestId: t.id,
      failureStage:
        t.requestStatus === 'PRECHECK_FAILED' ? 'PRECHECK' : 'CHAIN',
      failureCode: t.precheckReasonCode,
      fromWalletAddress: t.fromWalletAddress,
      toWalletAddress: t.toWalletAddress,
      tokenAmount: t.tokenAmount.toString(),
      timestamp: t.createdAt.toISOString(),
    }));
  }

  async getSuccessfulTransfers(fundId: string) {
    const transfers = await this.prisma.transferRequest.findMany({
      where: { fundId, requestStatus: 'MINED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => ({
      transferRequestId: t.id,
      fromWalletAddress: t.fromWalletAddress,
      toWalletAddress: t.toWalletAddress,
      tokenAmount: t.tokenAmount.toString(),
      txHash: t.submittedTxHash,
      timestamp: t.createdAt.toISOString(),
    }));
  }
}
