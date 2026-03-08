import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

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
}
