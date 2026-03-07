import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { OwnershipService } from './ownership.service';
import { RebuildProjectionDto } from './ownership.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';

@Controller('admin/funds')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
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
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
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
