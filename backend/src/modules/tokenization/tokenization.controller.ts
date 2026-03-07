import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { TokenizationService } from './tokenization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class TokenizationController {
  constructor(
    private readonly tokenizationService: TokenizationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('admin/subscriptions/:subscriptionId/token-mint')
  @Roles(...ADMIN_ROLES)
  async mintTokens(@Param('subscriptionId') subscriptionId: string) {
    const data =
      await this.tokenizationService.mintForSubscription(subscriptionId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('investor/funds/:fundId/transfers')
  @Roles('investor', ...ADMIN_ROLES)
  async initiateTransfer(
    @Param('fundId') fundIdOrCode: string,
    @Body()
    body: {
      fromWalletAddress: string;
      toWalletAddress: string;
      tokenAmount: string;
      reason?: string;
    },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.tokenizationService.initiateTransfer(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('transfers/:transferRequestId/validation')
  @Roles('investor', ...ADMIN_ROLES)
  async getTransferValidation(
    @Param('transferRequestId') transferRequestId: string,
  ) {
    const data =
      await this.tokenizationService.getTransferValidation(transferRequestId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('admin/funds/:fundId/transfers/failed')
  @Roles(...ADMIN_ROLES)
  async getFailedTransfers(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.tokenizationService.getFailedTransfers(fundId);
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }

  @Get('admin/funds/:fundId/transfers/successful')
  @Roles(...ADMIN_ROLES)
  async getSuccessfulTransfers(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.tokenizationService.getSuccessfulTransfers(fundId);
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }
}
