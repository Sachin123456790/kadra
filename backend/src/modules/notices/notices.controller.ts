import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { NoticesService } from './notices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
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
      subject?: string;
      bodyMarkdown?: string;
      templateKey?: string;
    },
  ) {
    const fundId = await resolveFundId(this.prisma, body.fundId);
    const data = await this.noticesService.generateNotice({
      ...body,
      fundId,
    });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('notice-templates/:type')
  async getNoticeTemplate(
    @Param('type') type: string,
    @Query('fundId') fundIdOrCode: string,
    @Query('recipientInvestorId') recipientInvestorId?: string,
    @Query('capitalCallId') capitalCallId?: string,
    @Query('distributionRunId') distributionRunId?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.noticesService.getTemplateForType({
      fundId,
      type,
      recipientInvestorId,
      capitalCallId,
      distributionRunId,
    });
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

  @Get('notices/:noticeId/pdf')
  async getNoticePdf(@Param('noticeId') noticeId: string, @Res() res: any) {
    const result = await this.noticesService.renderNoticePdf({ noticeId });
    sendBinary(res, result);
  }
}

function sendBinary(
  res: any,
  result: { buffer: Buffer; filename: string; mimeType: string },
): void {
  const disposition = `inline; filename="${result.filename.replace(/"/g, '')}"`;
  if (typeof res.header === 'function' && typeof res.send === 'function') {
    res.header('Content-Type', result.mimeType);
    res.header('Content-Disposition', disposition);
    res.header('Content-Length', String(result.buffer.length));
    res.send(result.buffer);
    return;
  }
  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Content-Length', String(result.buffer.length));
  res.end(result.buffer);
}

@Controller('investor')
@UseGuards(JwtAuthGuard)
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

  @Get('me/notices/:noticeId/pdf')
  async getMyNoticePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noticeId') noticeId: string,
    @Res() res: any,
  ) {
    const result = await this.noticesService.renderNoticePdf({
      noticeId,
      investorEmail: user.email,
    });
    sendBinary(res, result);
  }
}
