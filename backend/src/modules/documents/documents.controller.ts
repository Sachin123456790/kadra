import { Controller, Post, Get, Param, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';

@Controller()
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('admin/funds/:fundId/documents/master-lpa')
  async uploadMasterLpa(@Param('fundId') fundIdOrCode: string, @Req() req: FastifyRequest) {
    const data = await req.file();
    if (!data) {
      return {
        error: { code: 'VALIDATION_ERROR', message: 'No file provided' },
        meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
      };
    }

    const buffer = await data.toBuffer();
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const result = await this.documentsService.uploadMasterLpa(
      fundId,
      buffer,
      data.filename,
      data.mimetype,
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
}
