import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { NoticesService } from './notices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class NoticesAdminController {
  constructor(
    private readonly noticesService: NoticesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('notices')
  async generateNotice(
    @Body()
    body: {
      fundId: string;
      type: string;
      recipientInvestorId: string;
      capitalCallId?: string;
      distributionRunId?: string;
      documentHash?: string;
      anchorTxHash?: string;
    },
  ) {
    const data = await this.noticesService.generateNotice(body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('funds/:fundId/notices')
  async listNotices(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.noticesService.listNotices(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Put('notices/:noticeId/delivery')
  async updateDeliveryStatus(
    @Param('noticeId') noticeId: string,
    @Body() body: { deliveryId: string; status: string },
  ) {
    const data = await this.noticesService.updateDeliveryStatus(
      body.deliveryId,
      body.status,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}

@Controller('investor')
@UseGuards(SupabaseAuthGuard)
export class NoticesInvestorController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get('me/notices')
  async getMyNotices(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.noticesService.listInvestorNotices(user.email);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
