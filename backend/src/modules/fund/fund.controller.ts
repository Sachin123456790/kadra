import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FundService } from './fund.service';
import { CreateFundDto } from './fund.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('admin/funds')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class FundController {
  constructor(
    private readonly fundService: FundService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createFund(@Body() body: CreateFundDto) {
    const data = await this.fundService.createFund(body);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }

  @Get(':fundId')
  async getFundDetails(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.fundService.getFundDetails(fundId);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }

  @Get(':fundId/overview')
  async getOverview(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.fundService.getFundOverview(fundId);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }
}
