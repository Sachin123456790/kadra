import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InvestorPortalService } from './investor-portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { CreateChallengeDto, VerifyWalletDto } from './investor-portal.dto';

const DEFAULT_FUND_CODE = 'KADRA-DEMO-001';

@Controller('investor')
@UseGuards(SupabaseAuthGuard)
export class InvestorPortalController {
  constructor(
    private readonly portalService: InvestorPortalService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me/dashboard')
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getDashboard(investor.id, fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/subscriptions')
  async getMySubscriptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMySubscriptions(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/distributions')
  async getMyDistributions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMyDistributions(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/transfers')
  async getMyTransfers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMyTransfers(investor.id, fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.portalService.getMyProfile(user.email);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/wallets')
  async getMyWallets(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.portalService.listMyWallets(user.email);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/wallet-link/challenge')
  async createChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChallengeDto,
  ) {
    const data = await this.portalService.createWalletLinkChallenge(
      user.id,
      user.email,
      { address: dto.address, chainId: dto.chainId },
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/wallets/verify')
  async verifyWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyWalletDto,
  ) {
    const data = await this.portalService.verifyWalletLink(user.id, user.email, {
      challengeId: dto.challengeId,
      address: dto.address,
      chainId: dto.chainId,
      signature: dto.signature,
    });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('funds/:fundId/cap-table')
  async getCapTable(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.portalService.getCapTable(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
