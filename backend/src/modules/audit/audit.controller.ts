import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
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
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('funds/:fundId/event-log')
  async getEventLog(
    @Param('fundId') fundIdOrCode: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.auditService.getEventLog(fundId, {
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }

  @Get('funds/:fundId/document-provenance')
  async getDocumentProvenance(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.auditService.getDocumentProvenance(fundId);
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }

  @Post('funds/:fundId/audit-exports')
  async requestExport(
    @Param('fundId') fundIdOrCode: string,
    @Body()
    body: {
      exportType?: string;
      asOfTimestamp?: string;
      includeDocuments?: boolean;
      includeDistributionRuns?: boolean;
    },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.auditService.requestExport(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('audit-exports/:auditExportId')
  async getExportStatus(@Param('auditExportId') auditExportId: string) {
    const data = await this.auditService.getExportStatus(auditExportId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('audit-exports/:auditExportId/download')
  async downloadExport(@Param('auditExportId') auditExportId: string) {
    const data = await this.auditService.getExportDownload(auditExportId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('funds/:fundId/reset-demo')
  async resetDemo(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.auditService.resetDemoFund(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('funds/:fundId/gp-admin-export.pdf')
  async getGpAdminExportPdf(
    @Param('fundId') fundIdOrCode: string,
    @Query('asOf') asOfParam: string | undefined,
    @Res() res: any,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    const result = await this.auditService.renderGpAdminExportPdf(fundId, asOf);
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
