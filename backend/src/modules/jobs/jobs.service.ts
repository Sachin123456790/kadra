import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { ViemClientProvider } from '../../adapters/blockchain/viem-client.provider';
import { KADRA_TOKEN_ABI } from '../../adapters/blockchain/abi/kadra-token.abi';
import type { Address } from 'viem';

export interface RunSummary {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

export interface SingleJobResult {
  jobId: string;
  status: string;
  error?: string;
}

export interface ChainIngestSummary {
  contractsProcessed: number;
  eventsIngested: number;
}

export interface TxSyncSummary {
  checked: number;
  confirmed: number;
  reverted: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(ViemClientProvider)
    private readonly viem?: ViemClientProvider,
  ) {}

  async runPendingJobs(
    batchSize: number = 10,
    jobTypes?: string[],
  ): Promise<RunSummary> {
    const now = new Date();
    const whereClause: Record<string, unknown> = {
      status: 'QUEUED',
      scheduledAt: { lte: now },
    };
    if (jobTypes && jobTypes.length > 0) {
      whereClause.jobType = { in: jobTypes };
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
      take: batchSize,
    });

    const summary: RunSummary = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
    };

    for (const job of jobs) {
      summary.processed++;

      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          attempts: job.attempts + 1,
          startedAt: new Date(),
          lockedBy: 'job-runner',
          lockedAt: new Date(),
        },
      });

      try {
        await this.executeJob(job);
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            lockedBy: null,
            lockedAt: null,
          },
        });
        summary.succeeded++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const newAttempts = job.attempts + 1;

        if (newAttempts >= job.maxAttempts) {
          // Move to dead letter
          await this.prisma.jobDeadLetter.create({
            data: {
              originalJobId: job.id,
              jobType: job.jobType,
              payload: job.payload as object,
              attempts: newAttempts,
              lastError: errorMessage,
              failedAt: new Date(),
            },
          });
          await this.prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              lastError: errorMessage,
              lockedBy: null,
              lockedAt: null,
            },
          });
          summary.deadLettered++;
        } else {
          await this.prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              lastError: errorMessage,
              lockedBy: null,
              lockedAt: null,
            },
          });
        }
        summary.failed++;
      }
    }

    return summary;
  }

  async runSingleJob(jobId: string): Promise<SingleJobResult> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundError('Job', jobId);
    }
    if (job.status !== 'QUEUED' && job.status !== 'FAILED') {
      throw new NotFoundError(
        'Job',
        `${jobId} (status ${job.status} is not retriable)`,
      );
    }

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'RUNNING',
        attempts: job.attempts + 1,
        startedAt: new Date(),
      },
    });

    try {
      await this.executeJob(job);
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return { jobId: job.id, status: 'COMPLETED' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: errorMessage },
      });
      return { jobId: job.id, status: 'FAILED', error: errorMessage };
    }
  }

  async retryDeadLetter(deadLetterId: string) {
    const deadLetter = await this.prisma.jobDeadLetter.findUnique({
      where: { id: deadLetterId },
    });
    if (!deadLetter) {
      throw new NotFoundError('JobDeadLetter', deadLetterId);
    }

    const newJob = await this.prisma.job.create({
      data: {
        jobType: deadLetter.jobType,
        payload: deadLetter.payload as object,
        status: 'QUEUED',
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date(),
      },
    });

    return newJob;
  }

  async ingestChainEvents(fundId?: string): Promise<ChainIngestSummary> {
    const whereClause: Record<string, unknown> = {
      deploymentStatus: 'DEPLOYED',
      deletedAt: null,
    };
    if (fundId) {
      whereClause.fundId = fundId;
    }

    const contracts = await this.prisma.tokenContract.findMany({
      where: whereClause,
    });

    if (!this.viem) {
      this.logger.warn(
        'ViemClientProvider not available, skipping chain ingest',
      );
      return { contractsProcessed: contracts.length, eventsIngested: 0 };
    }

    let totalIngested = 0;
    for (const contract of contracts) {
      try {
        const currentBlock = await this.viem.publicClient.getBlockNumber();
        // Look back 1000 blocks max
        const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;

        const logs = await this.viem.publicClient.getContractEvents({
          address: contract.contractAddress as Address,
          abi: KADRA_TOKEN_ABI,
          eventName: 'Transfer',
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          const existing = await this.prisma.tokenPositionEvent.findFirst({
            where: {
              txHash: log.transactionHash,
              logIndex: log.logIndex ?? 0,
            },
          });
          if (existing) continue;

          await this.prisma.tokenPositionEvent.create({
            data: {
              fundId: contract.fundId,
              tokenContractId: contract.id,
              chainId: contract.chainId,
              blockNumber: BigInt(log.blockNumber ?? 0),
              blockTimestamp: new Date(),
              txHash: log.transactionHash ?? '',
              logIndex: log.logIndex ?? 0,
              eventType: 'TRANSFER',
              fromWalletAddress: (log.args as any)?.from ?? '',
              toWalletAddress: (log.args as any)?.to ?? '',
              tokenAmount: Number((log.args as any)?.value ?? 0) / 1e18,
              ingestStatus: 'CONFIRMED',
              rawEvent: {
                type: 'CHAIN_INGEST',
                log: JSON.parse(
                  JSON.stringify(log, (_k, v) =>
                    typeof v === 'bigint' ? v.toString() : v,
                  ),
                ),
              },
            },
          });
          totalIngested++;
        }
      } catch (e) {
        this.logger.error(
          `Chain ingest error for ${contract.contractAddress}:`,
          e,
        );
      }
    }

    return {
      contractsProcessed: contracts.length,
      eventsIngested: totalIngested,
    };
  }

  async syncPendingTransactions(): Promise<TxSyncSummary> {
    const pending = await this.prisma.transferRequest.findMany({
      where: { requestStatus: 'SUBMITTED' },
    });

    if (!this.viem || pending.length === 0) {
      return { checked: pending.length, confirmed: 0, reverted: 0 };
    }

    let confirmed = 0;
    let reverted = 0;

    for (const tx of pending) {
      if (!tx.submittedTxHash) continue;
      try {
        const receipt = await this.viem.publicClient.getTransactionReceipt({
          hash: tx.submittedTxHash as `0x${string}`,
        });

        if (receipt.status === 'success') {
          await this.prisma.transferRequest.update({
            where: { id: tx.id },
            data: { requestStatus: 'MINED', finalizedAt: new Date() },
          });
          confirmed++;
        } else {
          await this.prisma.transferRequest.update({
            where: { id: tx.id },
            data: { requestStatus: 'CHAIN_REVERTED', finalizedAt: new Date() },
          });
          reverted++;
        }
      } catch (e) {
        // Receipt not available yet — still pending
        this.logger.debug(`Tx ${tx.submittedTxHash} still pending`);
      }
    }

    return { checked: pending.length, confirmed, reverted };
  }

  private async executeJob(job: { jobType: string; payload: unknown }) {
    switch (job.jobType) {
      case 'document.parse':
        this.logger.log(`[STUB] Executing document.parse job`);
        break;
      case 'settlement.validate':
        this.logger.log(`[STUB] Executing settlement.validate job`);
        break;
      case 'token.mint':
        this.logger.log(`[STUB] Executing token.mint job`);
        break;
      case 'transfer.submit':
        this.logger.log(`[STUB] Executing transfer.submit job`);
        break;
      case 'export.bundle.generate':
        this.logger.log(`[STUB] Executing export.bundle.generate job`);
        break;
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }
  }
}
