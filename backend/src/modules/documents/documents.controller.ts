import { Controller, Post, Get, Param, Req, UseGuards, Body } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { AddManualExtractedFieldsDto } from './documents.dto';

/** Extract file buffer, filename, and mimetype from either Fastify or Express request */
async function extractFile(req: any): Promise<{ buffer: Buffer; filename: string; mimetype: string } | null> {
  // Express + multer: file is on req.file
  if (req.file && req.file.buffer) {
    return {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    };
  }

  // Fastify + @fastify/multipart: file() is an async method
  if (typeof req.file === 'function') {
    const data = await req.file();
    if (!data) return null;
    return {
      buffer: await data.toBuffer(),
      filename: data.filename,
      mimetype: data.mimetype,
    };
  }

  return null;
}

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('admin/funds/:fundId/documents/master-lpa')
  async uploadMasterLpa(@Param('fundId') fundIdOrCode: string, @Req() req: any) {
    const file = await extractFile(req);
    if (!file) {
      return {
        error: { code: 'VALIDATION_ERROR', message: 'No file provided' },
        meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
      };
    }

    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const result = await this.documentsService.uploadMasterLpa(
      fundId,
      file.buffer,
      file.filename,
      file.mimetype,
      'admin',
    );

    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('admin/documents/:documentId/parse-status')
  async getParseStatus(@Param('documentId') documentId: string) {
    const result = await this.documentsService.getParseStatus(documentId);
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('admin/documents/:documentId/hashes')
  async getHashes(@Param('documentId') documentId: string) {
    const result = await this.documentsService.getHashes(documentId);
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('admin/documents/:documentId/extracted-fields/manual')
  async addManualExtractedFields(
    @Param('documentId') documentId: string,
    @Body() body: AddManualExtractedFieldsDto,
  ) {
    const result = await this.documentsService.addManualExtractedFields(
      documentId,
      body,
      'admin',
    );
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
