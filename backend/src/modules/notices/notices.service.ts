import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../common/event-log.service';
import { NotFoundError } from '../../common/errors';
import {
  AVAILABLE_TOKENS,
  getDefaultTemplate,
  resolveTokens,
} from './notice-templates';
import { renderMarkdownPdf } from './pdfmake-renderer';

const NOTICE_TYPE_LABELS: Record<string, string> = {
  CAPITAL_CALL: 'Capital Call Notice',
  CAPITAL_CALL_NOTICE: 'Capital Call Notice',
  DISTRIBUTION: 'Distribution Notice',
  DISTRIBUTION_NOTICE: 'Distribution Notice',
  TRANSFER: 'Transfer Notice',
  TRANSFER_NOTICE: 'Transfer Notice',
  GENERAL: 'General Notice',
  TOKEN_MINTED: 'Token Mint Notice',
};

interface GenerateNoticeInput {
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
}

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async generateNotice(input: GenerateNoticeInput) {
    let subject = input.subject;
    let bodyMarkdown = input.bodyMarkdown;
    let templateKey = input.templateKey;

    // If admin didn't pass a custom body, fall back to the default template
    // for this notice type, with tokens resolved against current DB state.
    if (!bodyMarkdown) {
      const ctx = await this.buildTokenContext({
        fundId: input.fundId,
        recipientInvestorId: input.recipientInvestorId,
        capitalCallId: input.capitalCallId,
        distributionRunId: input.distributionRunId,
        documentHash: input.documentHash,
        anchorTxHash: input.anchorTxHash,
      });
      const tpl = getDefaultTemplate(input.type, ctx);
      subject = subject ?? tpl.subject;
      bodyMarkdown = tpl.body;
      templateKey = templateKey ?? `${input.type}.default`;
    }

    const notice = await this.prisma.notice.create({
      data: {
        fundId: input.fundId,
        type: input.type,
        recipientInvestorId: input.recipientInvestorId,
        capitalCallId: input.capitalCallId,
        distributionRunId: input.distributionRunId,
        documentHash: input.documentHash,
        anchorTxHash: input.anchorTxHash,
        subject,
        bodyMarkdown,
        templateKey,
        deliveries: {
          create: { status: 'GENERATED' },
        },
      },
      include: { deliveries: true },
    });

    await this.eventLog.log({
      eventType: 'NOTICE_GENERATED',
      aggregateType: 'NOTICE',
      aggregateId: notice.id,
      fundId: input.fundId,
      payload: {
        type: input.type,
        recipientInvestorId: input.recipientInvestorId,
      },
    });

    return notice;
  }

  async listNotices(fundId: string) {
    return this.prisma.notice.findMany({
      where: { fundId, deletedAt: null },
      include: {
        deliveries: true,
        investor: { select: { id: true, legalName: true, email: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async listInvestorNotices(investorEmail: string) {
    const investor = await this.prisma.investor.findFirst({
      where: { email: investorEmail, deletedAt: null },
      select: { id: true },
    });

    if (!investor) {
      throw new NotFoundError('Investor', investorEmail);
    }

    return this.prisma.notice.findMany({
      where: { recipientInvestorId: investor.id, deletedAt: null },
      include: { deliveries: true },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async updateDeliveryStatus(deliveryId: string, status: string) {
    const delivery = await this.prisma.noticeDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundError('NoticeDelivery', deliveryId);
    }

    const timestampField = this.resolveTimestampField(status);

    return this.prisma.noticeDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });
  }

  async renderNoticePdf(input: {
    noticeId: string;
    investorEmail?: string;
  }): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const notice = await this.prisma.notice.findUnique({
      where: { id: input.noticeId },
      include: {
        investor: { select: { id: true, legalName: true, email: true } },
        fund: { select: { name: true, code: true } },
      },
    });
    if (!notice || notice.deletedAt) {
      throw new NotFoundError('Notice', input.noticeId);
    }
    if (input.investorEmail && notice.investor?.email !== input.investorEmail) {
      throw new NotFoundError('Notice', input.noticeId);
    }

    const label =
      NOTICE_TYPE_LABELS[notice.type] ?? notice.type.replace(/_/g, ' ');

    // Preferred path: notice has an admin-customized markdown body. Render
    // through pdfmake. Legacy notices (pre-migration, bodyMarkdown null) fall
    // through to the original pdf-lib metadata layout below.
    if (notice.bodyMarkdown) {
      const buffer = await renderMarkdownPdf({
        subject: notice.subject ?? label,
        bodyMarkdown: notice.bodyMarkdown,
        headerLine: notice.fund?.name ?? notice.fund?.code ?? undefined,
        footer: {
          documentHash: notice.documentHash,
          anchorTxHash: notice.anchorTxHash,
          generatedAt: notice.generatedAt.toISOString().slice(0, 19) + 'Z',
        },
      });
      return {
        buffer,
        filename: `${label.replace(/\s+/g, '-').toLowerCase()}-${notice.id.slice(0, 8)}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    const rows: Array<[string, string]> = [
      ['Type', label],
      ['Notice ID', notice.id],
      [
        'Recipient',
        notice.investor?.legalName ?? notice.investor?.email ?? '—',
      ],
      ['Fund', notice.fund?.name ?? notice.fund?.code ?? '—'],
      ['Generated at', notice.generatedAt.toISOString()],
    ];
    if (notice.capitalCallId)
      rows.push(['Capital Call ID', notice.capitalCallId]);
    if (notice.distributionRunId)
      rows.push(['Distribution Run ID', notice.distributionRunId]);
    if (notice.documentHash)
      rows.push(['Document Hash (SHA-256)', notice.documentHash]);
    if (notice.anchorTxHash)
      rows.push(['On-chain Anchor Tx', notice.anchorTxHash]);

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.1, 0.1, 0.12);
    const muted = rgb(0.4, 0.4, 0.45);

    page.drawText(label, {
      x: 50,
      y: 742,
      size: 20,
      font: helvBold,
      color: ink,
    });
    page.drawText(
      `${notice.fund?.name ?? notice.fund?.code ?? 'Fund'} — ${notice.generatedAt.toISOString().slice(0, 10)}`,
      { x: 50, y: 720, size: 11, font: helv, color: muted },
    );
    page.drawLine({
      start: { x: 50, y: 700 },
      end: { x: 562, y: 700 },
      thickness: 0.75,
      color: muted,
    });

    let y = 670;
    for (const [k, v] of rows) {
      page.drawText(k, { x: 50, y, size: 10, font: helvBold, color: ink });
      const wrapped = String(v).match(/.{1,72}/g) ?? [String(v)];
      let ly = y;
      for (const line of wrapped) {
        page.drawText(line, {
          x: 220,
          y: ly,
          size: 10,
          font: helv,
          color: ink,
        });
        ly -= 14;
      }
      y = ly - 8;
      if (y < 80) break;
    }

    page.drawText(
      'Generated by Angainor. Verify the document hash on-chain via the Anchor Tx.',
      { x: 50, y: 50, size: 8, font: helv, color: muted },
    );

    const bytes = await pdf.save();
    return {
      buffer: Buffer.from(bytes),
      filename: `${label.replace(/\s+/g, '-').toLowerCase()}-${notice.id.slice(0, 8)}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async getNotice(noticeId: string) {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
      include: {
        deliveries: true,
        investor: { select: { id: true, legalName: true, email: true } },
      },
    });

    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    return notice;
  }

  /**
   * Build the token context used to substitute {{...}} in template bodies.
   * Pulls from existing rows where available; missing fields stay blank so
   * unresolved tokens are visible to the admin in the editor.
   */
  async buildTokenContext(input: {
    fundId: string;
    recipientInvestorId: string;
    capitalCallId?: string;
    distributionRunId?: string;
    documentHash?: string;
    anchorTxHash?: string;
  }): Promise<Record<string, string | number | null | undefined>> {
    const [fund, investor, capitalCall, distributionRun] = await Promise.all([
      this.prisma.fund.findUnique({
        where: { id: input.fundId },
        select: { name: true, code: true, createdAt: true },
      }),
      this.prisma.investor.findUnique({
        where: { id: input.recipientInvestorId },
        select: { legalName: true, email: true },
      }),
      input.capitalCallId
        ? this.prisma.capitalCall.findUnique({
            where: { id: input.capitalCallId },
            select: {
              callNumber: true,
              dueDate: true,
              amountDue: true,
            },
          })
        : Promise.resolve(null),
      input.distributionRunId
        ? this.prisma.distributionRun.findUnique({
            where: { id: input.distributionRunId },
            select: {
              asOfTimestamp: true,
              totalNetAmount: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      'fund.name': fund?.name ?? '',
      'fund.code': fund?.code ?? '',
      'fund.lpaDate': fund?.createdAt?.toISOString().slice(0, 10) ?? '',
      'investor.legalName': investor?.legalName ?? '',
      'investor.email': investor?.email ?? '',
      'investor.ownershipPct': '',
      generatedAt: new Date().toISOString().slice(0, 10),
      'capitalCall.callNumber': capitalCall?.callNumber ?? '',
      'capitalCall.amountDue': capitalCall?.amountDue
        ? `$${Number(capitalCall.amountDue).toLocaleString()}`
        : '',
      'capitalCall.dueDate':
        capitalCall?.dueDate?.toISOString().slice(0, 10) ?? '',
      'distribution.amount': distributionRun?.totalNetAmount
        ? `$${Number(distributionRun.totalNetAmount).toLocaleString()}`
        : '',
      'distribution.date':
        distributionRun?.asOfTimestamp?.toISOString().slice(0, 10) ?? '',
      'distribution.source': '',
      documentHash: input.documentHash ?? '',
      anchorTxHash: input.anchorTxHash ?? '',
    };
  }

  /**
   * Returns the resolved default template for a given notice type, used by
   * the Generate Notice modal to pre-fill the editor.
   */
  async getTemplateForType(input: {
    fundId: string;
    type: string;
    recipientInvestorId?: string;
    capitalCallId?: string;
    distributionRunId?: string;
  }): Promise<{
    subject: string;
    body: string;
    templateKey: string;
    availableTokens: readonly string[];
  }> {
    const ctx = input.recipientInvestorId
      ? await this.buildTokenContext({
          fundId: input.fundId,
          recipientInvestorId: input.recipientInvestorId,
          capitalCallId: input.capitalCallId,
          distributionRunId: input.distributionRunId,
        })
      : { 'fund.name': '', generatedAt: new Date().toISOString().slice(0, 10) };

    const tpl = getDefaultTemplate(input.type, ctx);
    return {
      subject: tpl.subject,
      body: tpl.body,
      templateKey: `${input.type}.default`,
      availableTokens: AVAILABLE_TOKENS,
    };
  }

  private resolveTimestampField(
    status: string,
  ): 'sentAt' | 'openedAt' | 'downloadedAt' | null {
    switch (status) {
      case 'SENT':
        return 'sentAt';
      case 'VIEWED':
        return 'openedAt';
      case 'DOWNLOADED':
        return 'downloadedAt';
      default:
        return null;
    }
  }
}
