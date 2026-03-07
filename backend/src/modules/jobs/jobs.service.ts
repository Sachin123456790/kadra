import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';

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

  constructor(private readonly prisma: PrismaService) {}

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
        const errorMessage =
          err instanceof Error ? err.message : String(err);
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
      const errorMessage =
        err instanceof Error ? err.message : String(err);
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

    this.logger.log(
      `[STUB] Chain ingest called for ${contracts.length} contract(s)` +
        (fundId ? ` (fundId=${fundId})` : ''),
    );

    // Stub: real implementation will use ethers to fetch events
    return {
      contractsProcessed: contracts.length,
      eventsIngested: 0,
    };
  }

  async syncPendingTransactions(): Promise<TxSyncSummary> {
    const pending = await this.prisma.transferRequest.findMany({
      where: { requestStatus: 'SUBMITTED' },
    });

    this.logger.log(
      `[STUB] Tx sync called, found ${pending.length} pending transaction(s)`,
    );

    // Stub: real implementation will check tx receipts via ethers
    return {
      checked: pending.length,
      confirmed: 0,
      reverted: 0,
    };
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
