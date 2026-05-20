import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { TokenContractAdapter } from '../../adapters/blockchain/token-contract.adapter';
import { TOKEN_CONTRACT_ADAPTER } from '../../adapters/blockchain/token-contract.adapter';
import {
  NotFoundError,
  ConflictError,
  ExternalDependencyError,
} from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';
import { NoticesService } from '../notices/notices.service';

@Injectable()
export class TokenizationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_CONTRACT_ADAPTER)
    private readonly tokenAdapter: TokenContractAdapter,
    private readonly eventLog: EventLogService,
    private readonly noticesService: NoticesService,
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
        process.env.IDENTITY_REGISTRY_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
    });

    const contract = await this.prisma.tokenContract.create({
      data: {
        fundId,
        chainId: 11155111,
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

    // Tokens are dollar-anchored: 1 token represents TOKEN_PAR_USD of committed
    // capital. Minting against a fixed par (rather than a % of a fixed supply)
    // keeps the cap table correct when an LPA amendment expands the fund -- new
    // LPs mint fresh supply, so every LP's share of total supply equals their
    // share of total committed capital. (e.g. $30M / $5,000 = 6,000 tokens.)
    const TOKEN_PAR_USD = 5000;
    // Floored to whole tokens -- ERC-20 balances here are integer units.
    const tokenAmount = Math.floor(
      Number(subscription.committedAmount) / TOKEN_PAR_USD,
    );

    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;
    let result: Awaited<ReturnType<typeof this.tokenAdapter.mint>> | null =
      null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        result = await this.tokenAdapter.mint({
          contractAddress: contract.contractAddress,
          toAddress: subscription.wallet.address,
          amount: tokenAmount.toString(),
        });
        break;
      } catch (err) {
        lastError = err;
        console.warn(
          `[mint] attempt ${attempt}/${MAX_ATTEMPTS} failed for sub ${subscriptionId}:`,
          err instanceof Error ? err.message : err,
        );
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
        }
      }
    }
    if (!result) {
      throw new ExternalDependencyError(
        'Blockchain',
        `Mint failed after ${MAX_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
      );
    }

    try {
      // Record the mint event
      const event = await this.prisma.tokenPositionEvent.create({
        data: {
          fundId: subscription.fundId,
          tokenContractId: contract.id,
          chainId: 11155111,
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

      await this.eventLog.log({
        eventType: 'TOKEN_MINTED',
        aggregateType: 'TOKEN_POSITION_EVENT',
        aggregateId: event.id,
        fundId: subscription.fundId,
        payload: {
          subscriptionId,
          investorId: subscription.investorId,
          walletAddress: subscription.wallet.address,
          tokenAmount,
          contractAddress: contract.contractAddress,
        },
        txHash: result.txHash,
        blockNumber: result.blockNumber,
      });

      try {
        await this.noticesService.generateNotice({
          fundId: subscription.fundId,
          type: 'TOKEN_MINTED',
          recipientInvestorId: subscription.investorId,
          anchorTxHash: result.txHash,
        });
      } catch (noticeError) {
        await this.eventLog.log({
          eventType: 'NOTICE_GENERATION_FAILED',
          aggregateType: 'SUBSCRIPTION',
          aggregateId: subscriptionId,
          fundId: subscription.fundId,
          payload: {
            stage: 'TOKEN_MINT',
            recipientInvestorId: subscription.investorId,
            txHash: result.txHash,
            error:
              noticeError instanceof Error ? noticeError.message : 'unknown',
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

  /**
   * Validate a transfer (pre-checks only). Does NOT submit to chain.
   * Returns a transferRequestId with status REQUESTED if pre-checks pass.
   * The frontend must then sign the tx with the investor's wallet and call confirmTransfer.
   */
  async validateTransfer(
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

      await this.eventLog.log({
        eventType: 'TRANSFER_FAILED',
        aggregateType: 'TRANSFER_REQUEST',
        aggregateId: transferRequest.id,
        fundId,
        payload: {
          stage: 'PRECHECK',
          failureCode,
          fromWallet: input.fromWalletAddress,
          toWallet: input.toWalletAddress,
          tokenAmount: input.tokenAmount,
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
        contractAddress: contract.contractAddress,
        txHash: null,
      };
    }

    return {
      transferRequestId: transferRequest.id,
      requestStatus: 'REQUESTED',
      precheck: {
        recipientEligible: true,
        senderEligible: true,
        sufficientBalance: true,
      },
      contractAddress: contract.contractAddress,
      txHash: null,
    };
  }

  /**
   * Confirm a transfer after the investor has signed and submitted the tx from their wallet.
   * Records the on-chain result and updates positions/capital accounts.
   */
  async confirmTransfer(transferRequestId: string, txHash: string) {
    const transferRequest = await this.prisma.transferRequest.findUnique({
      where: { id: transferRequestId },
    });
    if (!transferRequest)
      throw new NotFoundError('TransferRequest', transferRequestId);
    if (transferRequest.requestStatus !== 'REQUESTED') {
      throw new ConflictError(
        'TRANSFER_NOT_PENDING',
        `Transfer is in ${transferRequest.requestStatus} state, not REQUESTED`,
      );
    }

    const fundId = transferRequest.fundId;
    const contract = await this.prisma.tokenContract.findFirst({
      where: {
        id: transferRequest.tokenContractId,
        deploymentStatus: 'DEPLOYED',
        deletedAt: null,
      },
    });
    if (!contract)
      throw new NotFoundError('TokenContract', transferRequest.tokenContractId);

    // Verify the transaction on-chain
    const adapter = this.tokenAdapter as any;
    if (typeof adapter.verifyTransferTx !== 'function') {
      throw new ExternalDependencyError(
        'Blockchain',
        'Adapter does not support verifyTransferTx',
      );
    }
    await this.prisma.transferRequest.update({
      where: { id: transferRequestId },
      data: {
        requestStatus: 'SUBMITTED',
        submittedTxHash: txHash,
        submittedAt: new Date(),
      },
    });

    await this.prisma.transferEvent.create({
      data: {
        transferRequestId,
        fundId,
        tokenContractId: contract.id,
        eventKind: 'SUBMITTED',
        txHash,
        payload: {
          fromWallet: transferRequest.fromWalletAddress,
          toWallet: transferRequest.toWalletAddress,
          amount: transferRequest.tokenAmount.toString(),
        },
      },
    });

    let receipt: { txHash: string; blockNumber: number; status: string };
    try {
      receipt = await adapter.verifyTransferTx(txHash);
    } catch (error) {
      // Transaction failed or not found
      await this.prisma.transferRequest.update({
        where: { id: transferRequestId },
        data: {
          requestStatus: 'CHAIN_REVERTED',
          finalizedAt: new Date(),
        },
      });

      await this.prisma.transferEvent.create({
        data: {
          transferRequestId,
          fundId,
          tokenContractId: contract.id,
          eventKind: 'CHAIN_REVERTED',
          reasonCode: 'CONTRACT_REVERT',
          reasonText: error instanceof Error ? error.message : 'unknown',
          payload: {},
        },
      });

      await this.eventLog.log({
        eventType: 'TRANSFER_FAILED',
        aggregateType: 'TRANSFER_REQUEST',
        aggregateId: transferRequestId,
        fundId,
        payload: {
          stage: 'CHAIN',
          reason: error instanceof Error ? error.message : 'unknown',
          txHash,
        },
      });

      return {
        transferRequestId,
        requestStatus: 'CHAIN_REVERTED',
        txHash,
      };
    }

    if (receipt.status === 'REVERTED') {
      await this.prisma.transferRequest.update({
        where: { id: transferRequestId },
        data: {
          requestStatus: 'CHAIN_REVERTED',
          submittedTxHash: txHash,
          finalizedAt: new Date(),
        },
      });

      return { transferRequestId, requestStatus: 'CHAIN_REVERTED', txHash };
    }

    // Transaction confirmed — record everything
    const amount = Number(transferRequest.tokenAmount);
    const fromAddress = transferRequest.fromWalletAddress;
    const toAddress = transferRequest.toWalletAddress;

    await this.prisma.transferRequest.update({
      where: { id: transferRequestId },
      data: {
        requestStatus: 'MINED',
        submittedTxHash: receipt.txHash,
        submittedAt: new Date(),
        finalizedAt: new Date(),
      },
    });

    await this.prisma.transferEvent.create({
      data: {
        transferRequestId,
        fundId,
        tokenContractId: contract.id,
        eventKind: 'MINED',
        txHash: receipt.txHash,
        blockNumber: BigInt(receipt.blockNumber),
        blockTimestamp: new Date(),
        payload: {
          fromWallet: fromAddress,
          toWallet: toAddress,
          amount: amount.toString(),
        },
      },
    });

    await this.prisma.tokenPositionEvent.create({
      data: {
        fundId,
        tokenContractId: contract.id,
        chainId: 11155111,
        blockNumber: BigInt(receipt.blockNumber),
        blockTimestamp: new Date(),
        txHash: receipt.txHash,
        logIndex: 0,
        eventType: 'TRANSFER',
        fromWalletAddress: fromAddress,
        toWalletAddress: toAddress,
        tokenAmount: amount,
        relatedTransferRequestId: transferRequestId,
        ingestStatus: 'CONFIRMED',
        rawEvent: {
          type: 'TRANSFER',
          from: fromAddress,
          to: toAddress,
          amount,
        },
      },
    });

    // Update positions and capital accounts atomically
    const senderWallet = await this.prisma.wallet.findFirst({
      where: { addressNorm: fromAddress.toLowerCase(), deletedAt: null },
    });
    const recipientWallet = await this.prisma.wallet.findFirst({
      where: { addressNorm: toAddress.toLowerCase(), deletedAt: null },
    });
    const position = await this.prisma.tokenPosition.findFirst({
      where: {
        tokenContractId: contract.id,
        walletAddressNorm: fromAddress.toLowerCase(),
      },
    });
    const balance = position ? Number(position.settledTokenBalance) : 0;

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
          walletAddressNorm: toAddress.toLowerCase(),
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
            walletAddress: toAddress,
            walletAddressNorm: toAddress.toLowerCase(),
            settledTokenBalance: amount,
          },
        });
      }

      const transferFraction = balance > 0 ? amount / balance : 0;
      let transferredCapital = 0;

      const senderAccount = senderWallet
        ? await tx.capitalAccount.findFirst({
            where: {
              fundId,
              investorId: senderWallet.investorId,
              isCurrent: true,
              deletedAt: null,
            },
          })
        : null;

      if (senderAccount) {
        const senderBalance = parseFloat(
          senderAccount.endingCapitalBalance.toString(),
        );
        transferredCapital = senderBalance * transferFraction;
        await tx.capitalAccount.update({
          where: { id: senderAccount.id },
          data: {
            endingCapitalBalance: senderBalance - transferredCapital,
            asOfDate: new Date(),
          },
        });
      }

      if (recipientWallet && transferredCapital > 0) {
        const recipientAccount = await tx.capitalAccount.findFirst({
          where: {
            fundId,
            investorId: recipientWallet.investorId,
            isCurrent: true,
            deletedAt: null,
          },
        });

        if (recipientAccount) {
          await tx.capitalAccount.update({
            where: { id: recipientAccount.id },
            data: {
              endingCapitalBalance: { increment: transferredCapital },
              asOfDate: new Date(),
            },
          });
        } else {
          await tx.capitalAccount.create({
            data: {
              fundId,
              investorId: recipientWallet.investorId,
              openingBalance: 0,
              initialContribution: 0,
              contributedAt: new Date(),
              capitalReturned: 0,
              accruedPref: 0,
              residualAllocation: 0,
              endingCapitalBalance: transferredCapital,
              asOfDate: new Date(),
              isCurrent: true,
            },
          });
        }
      }
    });

    await this.eventLog.log({
      eventType: 'TRANSFER_COMPLETED',
      aggregateType: 'TRANSFER_REQUEST',
      aggregateId: transferRequestId,
      fundId,
      payload: {
        fromWallet: fromAddress,
        toWallet: toAddress,
        tokenAmount: amount.toString(),
      },
      txHash: receipt.txHash,
      blockNumber: receipt.blockNumber,
    });

    return {
      transferRequestId,
      requestStatus: 'MINED',
      txHash: receipt.txHash,
    };
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
              senderEligible: req.precheckReasonCode !== 'SENDER_NOT_ELIGIBLE',
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
