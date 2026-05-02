import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { InvestorPortalService } from './investor-portal.service';
import { DocumentsService } from '../documents/documents.service';
import { DistributionService } from '../distribution/distribution.service';
import { NoticesService } from '../notices/notices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { CreateChallengeDto, VerifyWalletDto } from './investor-portal.dto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function buildTaxPackagePdf(input: {
  readonly investorName: string;
  readonly fundName: string;
  readonly taxYear: number;
  readonly rows: ReadonlyArray<readonly [string, string]>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter, portrait
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);

  page.drawText('Tax Package', {
    x: 50,
    y: 742,
    size: 20,
    font: helvBold,
    color: ink,
  });
  page.drawText(`${input.fundName} — Tax Year ${input.taxYear}`, {
    x: 50,
    y: 720,
    size: 11,
    font: helv,
    color: muted,
  });
  page.drawText(`Prepared for: ${input.investorName}`, {
    x: 50,
    y: 702,
    size: 11,
    font: helv,
    color: muted,
  });
  page.drawLine({
    start: { x: 50, y: 690 },
    end: { x: 562, y: 690 },
    thickness: 0.75,
    color: muted,
  });

  let y = 660;
  const labelX = 50;
  const valueX = 320;
  for (const [label, value] of input.rows) {
    if (label === 'Field' && value === 'Value') continue; // skip CSV header
    page.drawText(label, {
      x: labelX,
      y,
      size: 11,
      font: helvBold,
      color: ink,
    });
    page.drawText(String(value ?? '—'), {
      x: valueX,
      y,
      size: 11,
      font: helv,
      color: ink,
    });
    y -= 22;
    if (y < 80) break;
  }

  page.drawText('This document is informational. Consult your tax advisor.', {
    x: 50,
    y: 50,
    size: 9,
    font: helv,
    color: muted,
  });

  return pdf.save();
}

const DEFAULT_FUND_CODE = 'ANGAINOR-DEMO-001';

/** Extract file buffer, filename, and mimetype from either Fastify or Express request */
async function extractFile(
  req: any,
): Promise<{ buffer: Buffer; filename: string; mimetype: string } | null> {
  if (req.file && req.file.buffer) {
    return {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    };
  }
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

/** Write a CSV download reply onto a Fastify/Express response object. */
function sendCsvReply(res: any, csv: string, filename: string): void {
  const encoded = encodeURIComponent(filename);
  const disposition = `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`;
  const body = Buffer.from(csv, 'utf8');

  if (typeof res.header === 'function' && typeof res.send === 'function') {
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', disposition);
    res.header('Content-Length', String(body.length));
    res.header('X-Content-Type-Options', 'nosniff');
    res.send(body);
    return;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Content-Length', String(body.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

/** Escape a CSV cell — quotes, commas, newlines, and leading injection characters. */
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const needsQuoting = /[",\n\r]/.test(s) || /^[=+\-@]/.test(s);
  const escaped = s.replace(/"/g, '""');
  // Prefix with single quote to neutralize CSV injection
  const safe = /^[=+\-@]/.test(s) ? `'${escaped}` : escaped;
  return needsQuoting ? `"${safe}"` : safe;
}

function buildCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

@Controller('investor')
@UseGuards(JwtAuthGuard)
export class InvestorPortalController {
  constructor(
    private readonly portalService: InvestorPortalService,
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly distributionService: DistributionService,
    private readonly noticesService: NoticesService,
  ) {}

  @Get('me/dashboard')
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getDashboard(investor.id, fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/subscriptions')
  async getMySubscriptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMySubscriptions(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/distributions')
  async getMyDistributions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMyDistributions(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/distributions/simulate')
  async simulateMyDistribution(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { totalAmount?: number | string; fundId?: string },
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      body.fundId || DEFAULT_FUND_CODE,
    );
    const amount = Number(body.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('totalAmount must be a positive number');
    }
    const data = await this.distributionService.simulateForInvestor(
      fundId,
      investor.id,
      amount,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/distributions/record-demo')
  async recordMyDemoDistribution(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { totalAmount?: number | string; fundId?: string },
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      body.fundId || DEFAULT_FUND_CODE,
    );
    const amount = Number(body.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('totalAmount must be a positive number');
    }
    const data = await this.distributionService.recordDemoForInvestor(
      fundId,
      investor.id,
      amount,
      this.noticesService,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/transfers')
  async getMyTransfers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMyTransfers(investor.id, fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.portalService.getMyProfile(user.email);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/onboarding')
  async getMyOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getOnboardingForInvestor(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/profile')
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      legalName?: string;
      country?: string;
      taxId?: string;
      sourceOfIncome?: string;
    },
  ) {
    const data = await this.portalService.updateMyProfile(user.email, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/wallets')
  async getMyWallets(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.portalService.listMyWallets(user.email);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/wallet-link/challenge')
  async createChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChallengeDto,
  ) {
    const data = await this.portalService.createWalletLinkChallenge(
      user.id,
      user.email,
      { address: dto.address, chainId: dto.chainId },
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/wallets/verify')
  async verifyWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyWalletDto,
  ) {
    const data = await this.portalService.verifyWalletLink(
      user.id,
      user.email,
      {
        challengeId: dto.challengeId,
        address: dto.address,
        chainId: dto.chainId,
        signature: dto.signature,
        walletSource: dto.walletSource,
      },
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/documents')
  async getMyDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMyDocuments(investor.id, fundId);
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }

  @Get('me/documents/:documentId/content')
  async getMyDocumentContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Query('fundId') fundIdOrCode: string | undefined,
    @Res() res: any,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    await this.portalService.assertInvestorCanAccessDocument(
      investor.id,
      fundId,
      documentId,
    );
    const file = await this.documentsService.getDocumentContent(documentId);
    const encodedName = encodeURIComponent(file.filename);
    const mime = file.mimeType || 'application/octet-stream';
    const disposition = `inline; filename="${file.filename.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`;

    if (typeof res.header === 'function' && typeof res.send === 'function') {
      res.header('Content-Type', mime);
      res.header('Content-Disposition', disposition);
      res.header('Content-Length', String(file.buffer.length));
      res.header('X-Content-Type-Options', 'nosniff');
      return res.send(file.buffer);
    }

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(file.buffer);
  }

  @Get('me/activity-feed')
  async getMyActivityFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
    @Query('limit') limit?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getMyActivityFeed(
      investor.id,
      fundId,
      limit ? parseInt(limit, 10) : 50,
    );
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }

  @Get('me/tax-report')
  async getTaxReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
    @Query('taxYear') taxYear?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const year = taxYear ? parseInt(taxYear, 10) : new Date().getFullYear();
    const data = await this.portalService.getTaxReport(
      investor.id,
      fundId,
      year,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/waterfall-breakdown')
  async getWaterfallBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.getWaterfallBreakdown(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/capital-account')
  async getMyCapitalAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const capitalAccount = await this.prisma.capitalAccount.findFirst({
      where: {
        investorId: investor.id,
        fundId,
        isCurrent: true,
        deletedAt: null,
      },
    });
    const data = capitalAccount
      ? {
          id: capitalAccount.id,
          openingBalance: capitalAccount.openingBalance.toString(),
          initialContribution: capitalAccount.initialContribution.toString(),
          capitalReturned: capitalAccount.capitalReturned.toString(),
          accruedPreferredReturn: capitalAccount.accruedPref.toString(),
          residualAllocation: capitalAccount.residualAllocation.toString(),
          endingBalance: capitalAccount.endingCapitalBalance.toString(),
          asOfDate: capitalAccount.asOfDate.toISOString(),
        }
      : null;
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('funds/:fundId/cap-table')
  async getCapTable(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.portalService.getCapTable(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post('me/documents/upload')
  async uploadInvestorDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode: string | undefined,
    @Req() req: any,
  ) {
    const file = await extractFile(req);
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const result = await this.documentsService.uploadGenericDocument({
      fundId,
      documentType: 'INVESTOR_UPLOAD',
      storageKeyPrefix: `investors/${investor.id}/uploads`,
      file: file.buffer,
      filename: file.filename,
      mimeType: file.mimetype,
      uploadedBy: user.email,
      linkedEntityType: 'INVESTOR',
      linkedEntityId: investor.id,
    });
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/capital-account/export')
  async exportCapitalAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const fmt = (format ?? 'csv').toLowerCase();
    if (fmt !== 'csv') {
      return res.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only format=csv is supported',
        },
      });
    }
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const account = await this.portalService.getCapitalAccountStatement(
      investor.id,
      fundId,
    );

    const rows: Array<[string, string]> = [
      ['Field', 'Value'],
      ['Investor', investor.legalName ?? investor.email ?? ''],
      ['Fund', fundId],
      ['Opening Balance', account?.openingBalance ?? ''],
      ['Initial Contribution', account?.initialContribution ?? ''],
      ['Capital Returned', account?.capitalReturned ?? ''],
      ['Accrued Preferred Return', account?.accruedPreferredReturn ?? ''],
      ['Residual Allocation', account?.residualAllocation ?? ''],
      ['Ending Balance', account?.endingBalance ?? ''],
      ['As Of Date', account?.asOfDate ?? ''],
    ];
    const csv = buildCsv(rows);
    const filename = `capital-account-${fundId}-${Date.now()}.csv`;
    sendCsvReply(res, csv, filename);
  }

  @Get('me/tax-package/preview')
  async previewTaxPackage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
    @Query('taxYear') taxYearRaw?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const taxYear = taxYearRaw
      ? parseInt(taxYearRaw, 10)
      : new Date().getFullYear();
    const report = await this.portalService.getTaxReport(
      investor.id,
      fundId,
      taxYear,
    );
    const data = report
      ? { available: true, taxYear, report }
      : { available: false, taxYear, reason: 'No data for this year' };
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('me/tax-package/export')
  async exportTaxPackage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode: string | undefined,
    @Query('taxYear') taxYearRaw: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const fmt = (format ?? 'csv').toLowerCase();
    if (fmt !== 'csv' && fmt !== 'pdf') {
      return res.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Supported formats: csv, pdf',
        },
      });
    }
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const taxYear = taxYearRaw
      ? parseInt(taxYearRaw, 10)
      : new Date().getFullYear();
    const report = await this.portalService.getTaxReport(
      investor.id,
      fundId,
      taxYear,
    );
    const fund = await this.portalService.getFundMeta(fundId);

    const rows: Array<[string, string]> = [
      ['Field', 'Value'],
      ['Investor', investor.legalName ?? investor.email ?? ''],
      ['Fund', fund.name ?? fund.code ?? fundId],
      ['Tax Year', String(taxYear)],
      ['Ordinary Income', report?.ordinaryIncome ?? ''],
      ['Return of Capital', report?.returnOfCapital ?? ''],
      ['Long-Term Capital Gains', report?.ltcg ?? ''],
      ['Short-Term Capital Gains', report?.stcg ?? ''],
      ['Total Distributions', report?.totalDistributions ?? ''],
      ['Generated At', report?.generatedAt ?? ''],
    ];

    if (fmt === 'pdf') {
      const pdfBytes = await buildTaxPackagePdf({
        investorName: investor.legalName ?? investor.email ?? '—',
        fundName: fund.name ?? fund.code ?? fundId,
        taxYear,
        rows,
      });
      const filename = `tax-package-${fundId}-${taxYear}.pdf`;
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(pdfBytes));
    }

    const csv = buildCsv(rows);
    const filename = `tax-package-${fundId}-${taxYear}.csv`;
    sendCsvReply(res, csv, filename);
  }

  @Get('me/gp-reports')
  async getInvestorGpReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fundId') fundIdOrCode?: string,
  ) {
    const investor = await this.portalService.resolveInvestor(user.email);
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || DEFAULT_FUND_CODE,
    );
    const data = await this.portalService.listGpReportsForInvestor(
      investor.id,
      fundId,
    );
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }
}

/**
 * Admin-side controller for uploading/listing GP reports.
 * Lives in the investor-portal module because the service + data shape
 * are shared with the investor-facing GP report listing.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminReportingDocumentsController {
  constructor(
    private readonly portalService: InvestorPortalService,
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post('admin/funds/:fundId/reporting-documents')
  async uploadReportingDocument(
    @Param('fundId') fundIdOrCode: string,
    @Req() req: any,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);

    // Fastify multipart: fields come alongside the file in parts()
    let file: { buffer: Buffer; filename: string; mimetype: string } | null =
      null;
    const fields: Record<string, string> = {};

    if (typeof req.parts === 'function') {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          file = {
            buffer: await part.toBuffer(),
            filename: part.filename,
            mimetype: part.mimetype,
          };
        } else if (part.type === 'field') {
          fields[part.fieldname] = String(part.value ?? '');
        }
      }
    } else {
      file = await extractFile(req);
      if (req.body && typeof req.body === 'object') {
        for (const [k, v] of Object.entries(
          req.body as Record<string, unknown>,
        )) {
          if (typeof v === 'string') fields[k] = v;
        }
      }
    }

    if (!file) {
      return {
        error: { code: 'VALIDATION_ERROR', message: 'No file provided' },
        meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
      };
    }

    const result = await this.documentsService.uploadGenericDocument({
      fundId,
      documentType: 'GP_REPORT',
      storageKeyPrefix: `funds/${fundId}/reports`,
      file: file.buffer,
      filename: file.filename,
      mimeType: file.mimetype,
      uploadedBy: 'admin',
      metadata: {
        title: fields.title ?? file.filename,
        period: fields.period ?? null,
        reportType: fields.reportType ?? 'GP_REPORT',
      },
    });
    return {
      data: result,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get('admin/funds/:fundId/reporting-documents')
  async listReportingDocuments(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.portalService.listGpReportsForFund(fundId);
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }
}
