import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { randomUUID } from 'crypto';

@Controller('admin')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('funds/:fundId/subscriptions')
  async createSubscriptions(
    @Param('fundId') fundId: string,
    @Body() body: { governingDocumentId: string; items: any[] },
  ) {
    const data = await this.subscriptionsService.createSubscriptions(fundId, body.governingDocumentId, body.items);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('funds/:fundId/subscriptions')
  async listSubscriptions(
    @Param('fundId') fundId: string,
    @Query('status') status?: string,
    @Query('investorId') investorId?: string,
    @Query('subscriptionRef') subscriptionRef?: string,
  ) {
    const data = await this.subscriptionsService.listSubscriptions(fundId, { status, investorId, subscriptionRef });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString(), count: data.length },
    };
  }
}
