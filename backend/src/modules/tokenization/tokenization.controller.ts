import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { TokenizationService } from './tokenization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post('admin/funds/:fundId/mint-all-settled')
  @Roles(...ADMIN_ROLES)
  async mintAllSettled(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const settled = await this.prisma.subscription.findMany({
      where: { fundId, status: 'SETTLED', deletedAt: null },
    });

    const results: Array<{
      subscriptionId: string;
      status: string;
      txHash?: string;
      error?: string;
    }> = [];
    for (const sub of settled) {
      try {
        const result = await this.tokenizationService.mintForSubscription(
          sub.id,
        );
        results.push({
          subscriptionId: sub.id,
          status: 'MINTED',
          txHash: result.txHash,
        });
      } catch (e: any) {
        results.push({
          subscriptionId: sub.id,
          status: 'SKIPPED',
          error: e?.message,
        });
      }
    }

    return {
      data: {
        mintedCount: results.filter((r) => r.status === 'MINTED').length,
        results,
      },
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('investor/funds/:fundId/transfers/validate')
  @Roles('investor', ...ADMIN_ROLES)
  async validateTransfer(
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
    const data = await this.tokenizationService.validateTransfer(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('investor/transfers/:transferRequestId/confirm')
  @Roles('investor', ...ADMIN_ROLES)
  async confirmTransfer(
    @Param('transferRequestId') transferRequestId: string,
    @Body() body: { txHash: string },
  ) {
    const data = await this.tokenizationService.confirmTransfer(
      transferRequestId,
      body.txHash,
    );
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
