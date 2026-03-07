import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { CreateInvestorDto, LinkWalletDto } from './identity.dto';
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
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':fundId/investors')
  async listInvestors(
    @Param('fundId') fundIdOrCode: string,
    @Query('eligibilityStatus') eligibilityStatus?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('search') search?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.identityService.listInvestors(fundId, { eligibilityStatus, verificationStatus, search });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString(), count: data.length },
    };
  }

  @Put(':fundId/eligibility')
  async updateEligibility(
    @Param('fundId') fundIdOrCode: string,
    @Body() body: { investorId: string; walletId: string; status: string; reason?: string },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.identityService.upsertEligibility(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}

@Controller('admin/investors')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class InvestorController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  async createInvestor(@Body() body: CreateInvestorDto) {
    const data = await this.identityService.createInvestor(body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':investorId/wallets')
  async linkWallet(
    @Param('investorId') investorId: string,
    @Body() body: LinkWalletDto,
  ) {
    const data = await this.identityService.linkWallet(investorId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
