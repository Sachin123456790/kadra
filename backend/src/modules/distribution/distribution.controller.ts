import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { DistributionService } from './distribution.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';

@Controller('admin/funds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class DistributionController {
  constructor(
    private readonly distributionService: DistributionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':fundId/waterfall-configs/active')
  async getActiveConfig(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data =
      await this.distributionService.getActiveWaterfallConfig(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':fundId/distributions/preview')
  async previewDistribution(
    @Param('fundId') fundIdOrCode: string,
    @Body()
    body: {
      waterfallConfigId: string;
      asOfTimestamp: string;
      grossDistributableAmount: string;
      currency?: string;
    },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.distributionService.previewDistribution(
      fundId,
      body,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get(':fundId/distributions/runs/:runId')
  async getDistributionRun(
    @Param('fundId') fundIdOrCode: string,
    @Param('runId') runId: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.distributionService.getDistributionRun(
      fundId,
      runId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':fundId/distributions/runs')
  async executeRun(
    @Param('fundId') fundIdOrCode: string,
    @Body()
    body: {
      waterfallConfigId: string;
      asOfTimestamp: string;
      grossDistributableAmount: string;
      currency?: string;
    },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
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
