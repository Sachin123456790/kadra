import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../common/event-log.service';
import { NotFoundError } from '../../common/errors';

interface GenerateNoticeInput {
  fundId: string;
  type: string;
  recipientInvestorId: string;
  capitalCallId?: string;
  distributionRunId?: string;
  documentHash?: string;
  anchorTxHash?: string;
}

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async generateNotice(input: GenerateNoticeInput) {
    const notice = await this.prisma.notice.create({
      data: {
        fundId: input.fundId,
        type: input.type,
        recipientInvestorId: input.recipientInvestorId,
        capitalCallId: input.capitalCallId,
        distributionRunId: input.distributionRunId,
        documentHash: input.documentHash,
        anchorTxHash: input.anchorTxHash,
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
