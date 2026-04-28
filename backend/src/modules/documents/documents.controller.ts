import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import {
  AddManualExtractedFieldsDto,
  ApproveDocumentDto,
  UpdateExtractedFieldsDto,
} from './documents.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Extract file buffer, filename, and mimetype from either Fastify or Express request */
async function extractFile(
  req: any,
): Promise<{ buffer: Buffer; filename: string; mimetype: string } | null> {
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('admin/funds/:fundId/documents/master-lpa')
  async uploadMasterLpa(
    @Param('fundId') fundIdOrCode: string,
    @Req() req: any,
  ) {
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

  @Get('admin/documents/:documentId/content')
  async getDocumentContent(
    @Param('documentId') documentId: string,
    @Res() res: any,
  ) {
    const file = await this.documentsService.getDocumentContent(documentId);
    const encodedName = encodeURIComponent(file.filename);
    const mime = file.mimeType || 'application/octet-stream';
    const disposition = `inline; filename="${file.filename.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`;

    // Fastify reply
    if (typeof res.header === 'function' && typeof res.send === 'function') {
      res.header('Content-Type', mime);
      res.header('Content-Disposition', disposition);
      res.header('Content-Length', String(file.buffer.length));
      res.header('X-Content-Type-Options', 'nosniff');
      return res.send(file.buffer);
    }

    // Express response
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(file.buffer);
  }

  @Get('admin/documents/:documentId/parse-status')
  async getParseStatus(@Param('documentId') documentId: string) {
    const result = await this.documentsService.getParseStatus(documentId);
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('admin/documents/:documentId/verify')
  async verifyDocument(@Param('documentId') documentId: string) {
    const result = await this.documentsService.verifyDocument(documentId);
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

  @Post('admin/funds/:fundId/investors/:investorId/documents/wire-confirmation')
  async uploadWireConfirmation(
    @Param('fundId') fundIdOrCode: string,
    @Param('investorId') investorId: string,
    @Req() req: any,
  ) {
    const file = await extractFile(req);
    if (!file) {
      return {
        error: { code: 'VALIDATION_ERROR', message: 'No file provided' },
        meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
      };
    }

    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const result = await this.documentsService.uploadWireConfirmation(
      fundId,
      investorId,
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

  @Get('admin/funds/:fundId/documents')
  async listDocuments(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const result = await this.documentsService.listDocumentsForFund(fundId);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: result.length,
      },
    };
  }

  @Get('admin/documents/:documentId/extracted-fields')
  async getExtractedFields(@Param('documentId') documentId: string) {
    const result = await this.documentsService.getExtractedFields(documentId);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: result.length,
      },
    };
  }

  @Put('admin/documents/:documentId/extracted-fields')
  async updateExtractedFields(
    @Param('documentId') documentId: string,
    @Body() body: UpdateExtractedFieldsDto,
  ) {
    const result = await this.documentsService.updateExtractedFields(
      documentId,
      body.fieldUpdates,
    );
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('admin/documents/anchor-pending')
  async retryPendingAnchors() {
    const result = await this.documentsService.retryPendingAnchors();
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('admin/documents/:documentId/approve')
  async approveDocument(
    @Param('documentId') documentId: string,
    @Body() body: ApproveDocumentDto,
  ) {
    // 1. Validate, apply field edits, anchor on-chain, and approve
    await this.documentsService.approveDocument(documentId, {
      notes: body.notes,
      fieldUpdates: body.fieldUpdates,
    });

    // 2. Create subscriptions from the approved document
    const fundId = await resolveFundId(this.prisma, body.fundId);
    const subscriptionItems = body.subscriptionItems.map((item, index) => ({
      ...item,
      committedAmount: String(item.committedAmount),
      subscriptionRef: `SUB-${documentId.slice(0, 8)}-${String(index + 1).padStart(3, '0')}`,
    }));

    const subscriptionResult =
      await this.subscriptionsService.createSubscriptions(
        fundId,
        documentId,
        subscriptionItems,
      );

    return {
      data: {
        documentId,
        approved: true,
        subscriptions: subscriptionResult,
      },
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
