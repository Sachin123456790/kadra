import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ServiceTokenGuard } from '../../common/guards/service-token.guard';
import { randomUUID } from 'crypto';

@Controller('admin/jobs')
@UseGuards(ServiceTokenGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('run')
  async runPendingJobs(
    @Body() body: { batchSize?: number; jobTypes?: string[] },
  ) {
    const data = await this.jobsService.runPendingJobs(
      body.batchSize,
      body.jobTypes,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':jobId/run')
  async runSingleJob(@Param('jobId') jobId: string) {
    const data = await this.jobsService.runSingleJob(jobId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':jobId/retry')
  async retryDeadLetter(@Param('jobId') jobId: string) {
    const data = await this.jobsService.retryDeadLetter(jobId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('chain-ingest')
  async chainIngest(@Body() body: { fundId?: string }) {
    const data = await this.jobsService.ingestChainEvents(body.fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('tx-sync')
  async txSync() {
    const data = await this.jobsService.syncPendingTransactions();
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
