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

const FUND_ALLOCATION_CAP_PCT = 100;
const PER_INVESTOR_ALLOCATION_CAP_PCT = 100;

// Floating-point tolerance so 33.333333 + 33.333333 + 33.333334 = 100 still passes.
const ALLOCATION_EPSILON = 0.000001;

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

    // Validate allocations against existing subscriptions in the fund.
    // This is the cross-subscription check that makes top-ups safe:
    // - Per investor: existing total + new request <= 100% (no investor over-allocated)
    // - Per fund:    existing total + new request <= 100% (no over-subscription)
    // Settled and pending subs both count toward existing total.
    const existingSubs = await this.prisma.subscription.findMany({
      where: {
        fundId,
        deletedAt: null,
        status: { in: ['PENDING', 'SETTLED'] },
      },
      select: { investorId: true, allocationPct: true },
    });

    const existingByInvestor = new Map<string, number>();
    let existingFundTotal = 0;
    for (const sub of existingSubs) {
      const pct = Number(sub.allocationPct);
      existingFundTotal += pct;
      existingByInvestor.set(
        sub.investorId,
        (existingByInvestor.get(sub.investorId) ?? 0) + pct,
      );
    }

    const newByInvestor = new Map<string, number>();
    let newRequestTotal = 0;
    for (const item of items) {
      newRequestTotal += item.allocationPct;
      newByInvestor.set(
        item.investorId,
        (newByInvestor.get(item.investorId) ?? 0) + item.allocationPct,
      );
    }

    // Per-investor cap check.
    for (const [investorId, additional] of newByInvestor.entries()) {
      const existing = existingByInvestor.get(investorId) ?? 0;
      const investorTotal = existing + additional;
      if (
        investorTotal >
        PER_INVESTOR_ALLOCATION_CAP_PCT + ALLOCATION_EPSILON
      ) {
        throw new ConflictError(
          'INVESTOR_ALLOCATION_EXCEEDED',
          `Investor ${investorId} would have ${investorTotal.toFixed(4)}% allocation (existing ${existing.toFixed(4)}% + new ${additional.toFixed(4)}%), which exceeds 100%.`,
        );
      }
    }

    // Fund-level cap check.
    const fundTotal = existingFundTotal + newRequestTotal;
    if (fundTotal > FUND_ALLOCATION_CAP_PCT + ALLOCATION_EPSILON) {
      throw new ConflictError(
        'FUND_ALLOCATION_EXCEEDED',
        `Fund total allocation would be ${fundTotal.toFixed(4)}%, which exceeds 100% (existing ${existingFundTotal.toFixed(4)}% + new ${newRequestTotal.toFixed(4)}%). Upload an LPA Amendment to expand the fund before adding more capital.`,
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
        tokenPositionEvents: {
          where: { eventType: 'MINT', ingestStatus: 'CONFIRMED' },
          orderBy: [{ blockTimestamp: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
        investor: { select: { legalName: true } },
        governingHash: { select: { hashHex: true } },
      },
    });

    return subscriptions.map((s) => {
      const latest = s.settlementRecords[0];
      const latestMint = s.tokenPositionEvents[0];
      const latestSettlement = latest
        ? {
            id: latest.id,
            status: latest.status,
            validation: {
              checks: [
                { name: 'Amount', passed: latest.checkAmountMatch },
                { name: 'Identity', passed: latest.checkInvestorMatch },
                { name: 'Reference', passed: latest.checkReferenceMatch },
              ],
              failureReasonCode: latest.failureReasonCode ?? null,
            },
          }
        : null;
      return {
        subscriptionId: s.id,
        subscriptionRef: s.subscriptionRef,
        investorId: s.investorId,
        walletId: s.walletId,
        allocationPct: Number(s.allocationPct),
        committedAmount: s.committedAmount.toString(),
        status: s.status,
        settledAt: s.settledAt?.toISOString() ?? null,
        latestSettlementStatus: latest?.status ?? null,
        latestSettlement,
        investorName: s.investor?.legalName ?? null,
        governingHashHex: s.governingHash?.hashHex ?? null,
        mintTxHash: latestMint?.txHash ?? null,
        mintedAt: latestMint?.blockTimestamp?.toISOString() ?? null,
        mintEventId: latestMint?.id ?? null,
      };
    });
  }

  /**
   * Returns the fund's allocation headroom plus a per-investor breakdown.
   * Used by the admin UI to render "remaining headroom" + "top-up vs. new"
   * states on the Subscriptions page before the admin saves anything.
   */
  async getFundAllocation(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const subs = await this.prisma.subscription.findMany({
      where: {
        fundId,
        deletedAt: null,
        status: { in: ['PENDING', 'SETTLED'] },
      },
      select: {
        investorId: true,
        allocationPct: true,
        status: true,
        committedAmount: true,
        investor: { select: { legalName: true, email: true } },
      },
    });

    const byInvestor = new Map<
      string,
      {
        investorId: string;
        investorName: string | null;
        investorEmail: string | null;
        totalAllocationPct: number;
        totalCommitted: number;
        settledAllocationPct: number;
        pendingAllocationPct: number;
        subscriptionCount: number;
      }
    >();
    let totalAllocationPct = 0;

    for (const sub of subs) {
      const pct = Number(sub.allocationPct);
      const amt = Number(sub.committedAmount);
      totalAllocationPct += pct;
      const existing = byInvestor.get(sub.investorId) ?? {
        investorId: sub.investorId,
        investorName: sub.investor?.legalName ?? null,
        investorEmail: sub.investor?.email ?? null,
        totalAllocationPct: 0,
        totalCommitted: 0,
        settledAllocationPct: 0,
        pendingAllocationPct: 0,
        subscriptionCount: 0,
      };
      existing.totalAllocationPct += pct;
      existing.totalCommitted += amt;
      existing.subscriptionCount += 1;
      if (sub.status === 'SETTLED') existing.settledAllocationPct += pct;
      else existing.pendingAllocationPct += pct;
      byInvestor.set(sub.investorId, existing);
    }

    return {
      fundId,
      fundCapPct: FUND_ALLOCATION_CAP_PCT,
      perInvestorCapPct: PER_INVESTOR_ALLOCATION_CAP_PCT,
      totalAllocationPct,
      remainingHeadroomPct: Math.max(
        0,
        FUND_ALLOCATION_CAP_PCT - totalAllocationPct,
      ),
      investors: Array.from(byInvestor.values()).sort(
        (a, b) => b.totalAllocationPct - a.totalAllocationPct,
      ),
    };
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
