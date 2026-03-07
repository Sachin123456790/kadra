import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { AuditService } from './audit.service';
import { randomUUID } from 'crypto';

@Controller('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('funds/:fundId/audit-exports')
  async requestExport(
    @Param('fundId') fundId: string,
    @Body()
    body: {
      exportType?: string;
      asOfTimestamp?: string;
      includeDocuments?: boolean;
      includeDistributionRuns?: boolean;
    },
  ) {
    const data = await this.auditService.requestExport(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('audit-exports/:auditExportId')
  async getExportStatus(
    @Param('auditExportId') auditExportId: string,
  ) {
    const data = await this.auditService.getExportStatus(auditExportId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
