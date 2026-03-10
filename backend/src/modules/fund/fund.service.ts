import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';

@Injectable()
export class FundService {
  constructor(private readonly prisma: PrismaService) {}

  async createFund(input: {
    code: string;
    name: string;
    legalForm?: string;
    jurisdictionCode?: string;
    baseCurrency?: string;
  }) {
    const fund = await this.prisma.fund.create({
      data: {
        code: input.code,
        name: input.name,
        legalForm: input.legalForm ?? 'LP',
        jurisdictionCode: input.jurisdictionCode ?? null,
        baseCurrency: input.baseCurrency ?? 'USD',
        status: 'ACTIVE',
        metadata: {},
      },
    });

    return {
      fundId: fund.id,
      code: fund.code,
      status: fund.status,
    };
  }

  async getFundDetails(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    return {
      fundId: fund.id,
      code: fund.code,
      name: fund.name,
      legalForm: fund.legalForm,
      jurisdictionCode: fund.jurisdictionCode,
      baseCurrency: fund.baseCurrency,
      status: fund.status,
      metadata: fund.metadata,
      createdAt: fund.createdAt.toISOString(),
      updatedAt: fund.updatedAt.toISOString(),
    };
  }

  async getActivityFeed(
    fundId: string,
    options: { limit: number; offset: number },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const events = await this.prisma.systemEventLog.findMany({
      where: { fundId },
      orderBy: { occurredAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });

    return events.map((e) => ({
      id: Number(e.id),
      eventId: e.eventId,
      eventType: e.eventType,
      aggregateType: e.aggregateType,
      aggregateId: e.aggregateId,
      payload: e.payloadJson,
      metadata: e.metadataJson,
      occurredAt: e.occurredAt.toISOString(),
      txHash: e.txHash,
      blockNumber: e.blockNumber ? Number(e.blockNumber) : null,
    }));
  }

  async getFundOverview(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const [lpCount, eligibleWalletCount, pendingSubs, settledSubs, contract] =
      await Promise.all([
        this.prisma.investor.count({
          where: { verificationStatus: 'VERIFIED', deletedAt: null },
        }),
        this.prisma.investorFundEligibility.count({
          where: { fundId, eligibilityStatus: 'ELIGIBLE', deletedAt: null },
        }),
        this.prisma.subscription.count({
          where: { fundId, status: 'PENDING', deletedAt: null },
        }),
        this.prisma.subscription.count({
          where: { fundId, status: 'SETTLED', deletedAt: null },
        }),
        this.prisma.tokenContract.findFirst({
          where: { fundId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const committedAgg = await this.prisma.subscription.aggregate({
      where: { fundId, deletedAt: null },
      _sum: { committedAmount: true },
    });

    const settledAgg = await this.prisma.subscription.aggregate({
      where: { fundId, status: 'SETTLED', deletedAt: null },
      _sum: { committedAmount: true },
    });

    return {
      fundId: fund.id,
      fundName: fund.name,
      status: fund.status,
      lpCount,
      eligibleWalletCount,
      pendingSubscriptions: pendingSubs,
      settledSubscriptions: settledSubs,
      totalCommittedAmount:
        committedAgg._sum.committedAmount?.toString() ?? '0.00',
      totalSettledAmount: settledAgg._sum.committedAmount?.toString() ?? '0.00',
      tokenContract: contract
        ? {
            chainId: contract.chainId,
            contractAddress: contract.contractAddress,
            deploymentStatus: contract.deploymentStatus,
          }
        : null,
    };
  }
}
