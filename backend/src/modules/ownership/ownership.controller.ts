import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { OwnershipService } from './ownership.service';
import { RebuildProjectionDto } from './ownership.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';

@Controller('admin/funds')
export class OwnershipController {
  constructor(
    private readonly ownershipService: OwnershipService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':fundId/cap-table')
  async getCapTable(
    @Param('fundId') fundIdOrCode: string,
    @Query('asOfTimestamp') asOfTimestamp?: string,
    @Query('includePending') includePending?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.ownershipService.getCapTable(fundId, {
      asOfTimestamp,
      includePending: includePending !== 'false',
    });
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }

  @Get(':fundId/ownership-history')
  async getOwnershipHistory(
    @Param('fundId') fundIdOrCode: string,
    @Query('walletAddress') walletAddress?: string,
    @Query('investorId') investorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.ownershipService.getOwnershipHistory(fundId, {
      walletAddress,
      investorId,
      from,
      to,
    });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString(), count: data.length },
    };
  }
}

@Controller('admin/projections')
export class ProjectionController {
  constructor(private readonly ownershipService: OwnershipService) {}

  @Post('rebuild')
  async rebuildProjection(@Body() body: RebuildProjectionDto) {
    const data = await this.ownershipService.rebuildProjection(body.fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
