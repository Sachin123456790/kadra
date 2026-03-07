import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { DistributionService } from './distribution.service';
import { randomUUID } from 'crypto';

@Controller('admin/funds')
export class DistributionController {
  constructor(private readonly distributionService: DistributionService) {}

  @Get(':fundId/waterfall-configs/active')
  async getActiveConfig(@Param('fundId') fundId: string) {
    const data =
      await this.distributionService.getActiveWaterfallConfig(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':fundId/distributions/preview')
  async previewDistribution(
    @Param('fundId') fundId: string,
    @Body()
    body: {
      waterfallConfigId: string;
      asOfTimestamp: string;
      grossDistributableAmount: string;
      currency?: string;
    },
  ) {
    const data = await this.distributionService.previewDistribution(
      fundId,
      body,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':fundId/distributions/runs')
  async executeRun(
    @Param('fundId') fundId: string,
    @Body()
    body: {
      waterfallConfigId: string;
      asOfTimestamp: string;
      grossDistributableAmount: string;
      currency?: string;
    },
  ) {
    const data = await this.distributionService.executeDistributionRun(
      fundId,
      body,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
