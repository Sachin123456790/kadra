import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('funds/:fundId/subscriptions')
  async createSubscriptions(
    @Param('fundId') fundIdOrCode: string,
    @Body() body: { governingDocumentId: string; items: any[] },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.subscriptionsService.createSubscriptions(fundId, body.governingDocumentId, body.items);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('funds/:fundId/subscriptions')
  async listSubscriptions(
    @Param('fundId') fundIdOrCode: string,
    @Query('status') status?: string,
    @Query('investorId') investorId?: string,
    @Query('subscriptionRef') subscriptionRef?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.subscriptionsService.listSubscriptions(fundId, { status, investorId, subscriptionRef });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString(), count: data.length },
    };
  }
}
