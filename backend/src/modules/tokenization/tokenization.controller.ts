import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { TokenizationService } from './tokenization.service';
import { randomUUID } from 'crypto';

@Controller()
export class TokenizationController {
  constructor(private readonly tokenizationService: TokenizationService) {}

  @Post('admin/subscriptions/:subscriptionId/token-mint')
  async mintTokens(@Param('subscriptionId') subscriptionId: string) {
    const data =
      await this.tokenizationService.mintForSubscription(subscriptionId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('investor/funds/:fundId/transfers')
  async initiateTransfer(
    @Param('fundId') fundId: string,
    @Body()
    body: {
      fromWalletAddress: string;
      toWalletAddress: string;
      tokenAmount: string;
      reason?: string;
    },
  ) {
    const data = await this.tokenizationService.initiateTransfer(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('transfers/:transferRequestId/validation')
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
  async getFailedTransfers(@Param('fundId') fundId: string) {
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
  async getSuccessfulTransfers(@Param('fundId') fundId: string) {
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
