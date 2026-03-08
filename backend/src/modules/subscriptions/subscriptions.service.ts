import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';

interface SubscriptionItem {
  investorId: string;
  walletId: string;
  allocationPct: number;
  committedAmount: string;
  currency?: string;
  subscriptionRef: string;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async createSubscriptions(
    fundId: string,
    governingDocumentId: string,
    items: SubscriptionItem[],
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    // Verify governing document exists and has a hash
    const doc = await this.prisma.document.findUnique({
      where: { id: governingDocumentId },
      include: { hashes: { where: { isPrimary: true } } },
    });
    if (!doc) throw new NotFoundError('GoverningDocument', governingDocumentId);
    if (doc.hashes.length === 0)
      throw new ConflictError(
        'DOCUMENT_NOT_HASHED',
        'Governing document has no hash',
      );

    const governingHashId = doc.hashes[0].id;

    // Validate all investors are eligible
    for (const item of items) {
      const eligibility = await this.prisma.investorFundEligibility.findFirst({
        where: {
          fundId,
          investorId: item.investorId,
          walletId: item.walletId,
          eligibilityStatus: 'ELIGIBLE',
          deletedAt: null,
        },
      });
      if (!eligibility) {
        throw new ConflictError(
          'INVESTOR_NOT_ELIGIBLE',
          `Investor ${item.investorId} is not eligible for this fund`,
        );
      }
    }

    // Validate allocation total
    const totalAllocation = items.reduce((sum, i) => sum + i.allocationPct, 0);
    if (totalAllocation > 100) {
      throw new ConflictError(
        'INVALID_ALLOCATION_TOTAL',
        `Total allocation ${totalAllocation}% exceeds 100%`,
      );
    }

    // Create subscriptions in transaction
    const subscriptions = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const item of items) {
        const sub = await tx.subscription.create({
          data: {
            subscriptionRef: item.subscriptionRef,
            fundId,
            investorId: item.investorId,
            walletId: item.walletId,
            governingDocumentId,
            governingHashId,
            allocationPct: item.allocationPct,
            committedAmount: item.committedAmount,
            currency: item.currency || 'USD',
            status: 'PENDING',
            metadata: {},
          },
        });
        results.push(sub);
      }
      return results;
    });

    for (const sub of subscriptions) {
      await this.eventLog.log({
        eventType: 'SUBSCRIPTION_CREATED',
        aggregateType: 'SUBSCRIPTION',
        aggregateId: sub.id,
        fundId,
        payload: {
          subscriptionRef: sub.subscriptionRef,
          investorId: sub.investorId,
          walletId: sub.walletId,
          allocationPct: Number(sub.allocationPct),
        },
      });
    }

    return {
      createdCount: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        subscriptionId: s.id,
        status: s.status,
        subscriptionRef: s.subscriptionRef,
      })),
    };
  }

  async listSubscriptions(
    fundId: string,
    filters?: {
      status?: string;
      investorId?: string;
      subscriptionRef?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        fundId,
        deletedAt: null,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.investorId ? { investorId: filters.investorId } : {}),
        ...(filters?.subscriptionRef
          ? { subscriptionRef: filters.subscriptionRef }
          : {}),
      },
      include: {
        settlementRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
        investor: { select: { legalName: true } },
        governingHash: { select: { hashHex: true } },
      },
    });

    return subscriptions.map((s) => ({
      subscriptionId: s.id,
      subscriptionRef: s.subscriptionRef,
      investorId: s.investorId,
      walletId: s.walletId,
      allocationPct: Number(s.allocationPct),
      committedAmount: s.committedAmount.toString(),
      status: s.status,
      settledAt: s.settledAt?.toISOString() ?? null,
      latestSettlementStatus: s.settlementRecords[0]?.status ?? null,
      investorName: s.investor?.legalName ?? null,
      governingHashHex: s.governingHash?.hashHex ?? null,
    }));
  }

  async getSubscription(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        investor: true,
        wallet: true,
        governingDocument: {
          include: { hashes: { where: { isPrimary: true } } },
        },
        settlementRecords: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!sub) throw new NotFoundError('Subscription', subscriptionId);
    return sub;
  }
}
