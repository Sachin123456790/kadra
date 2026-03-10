import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
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
}
