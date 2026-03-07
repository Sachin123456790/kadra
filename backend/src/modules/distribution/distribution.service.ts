import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';

@Injectable()
export class DistributionService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveWaterfallConfig(fundId: string) {
    const config = await this.prisma.waterfallConfig.findFirst({
      where: { fundId, isActive: true, deletedAt: null },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
    });
    if (!config) throw new NotFoundError('WaterfallConfig', fundId);

    return {
      waterfallConfigId: config.id,
      version: config.version,
      calculationBasis: config.calculationBasis,
      distributionFrequency: config.distributionFrequency,
      catchUpEnabled: config.catchUpEnabled,
      gpPromotePct: config.gpPromotePct ? Number(config.gpPromotePct) : null,
      prefReturnPct: config.prefReturnPct ? Number(config.prefReturnPct) : null,
      rules: config.rulesJson,
      tiers: config.tiers.map((t) => ({
        tierOrder: t.tierOrder,
        tierName: t.tierName,
        hurdleType: t.hurdleType,
        hurdleValue: t.hurdleValue ? Number(t.hurdleValue) : null,
        lpSharePct: Number(t.lpSharePct),
        gpSharePct: Number(t.gpSharePct),
        catchUp: t.catchUp,
      })),
    };
  }

  async previewDistribution(
    fundId: string,
    input: {
      waterfallConfigId: string;
      asOfTimestamp: string;
      grossDistributableAmount: string;
      currency?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const config = await this.prisma.waterfallConfig.findUnique({
      where: { id: input.waterfallConfigId },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
    });
    if (!config) throw new NotFoundError('WaterfallConfig', input.waterfallConfigId);

    // Get current positions for ownership %
    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    const positions = contract
      ? await this.prisma.tokenPosition.findMany({
          where: { tokenContractId: contract.id },
          include: { wallet: { include: { investor: true } } },
        })
      : [];

    const totalSupply = positions.reduce(
      (sum, p) => sum + Number(p.settledTokenBalance),
      0,
    );
    if (totalSupply === 0) {
      throw new ConflictError(
        'NO_SETTLED_OWNERSHIP',
        'No settled ownership found for distribution',
      );
    }

    const grossAmount = parseFloat(input.grossDistributableAmount);

    // Simple pro-rata distribution (simplified waterfall for MVP)
    const lineItems = positions.map((p) => {
      const ownershipPct = (Number(p.settledTokenBalance) / totalSupply) * 100;
      const grossAllocation = (ownershipPct / 100) * grossAmount;

      return {
        investorId: p.wallet?.investor?.id ?? null,
        investorName: p.wallet?.investor?.legalName ?? null,
        walletAddress: p.walletAddress,
        ownershipPctUsed: ownershipPct,
        grossAmount: grossAllocation.toFixed(2),
        netAmount: grossAllocation.toFixed(2), // No fees in MVP
        tierBreakdown: {},
      };
    });

    return {
      asOfTimestamp: input.asOfTimestamp,
      summary: {
        gross: input.grossDistributableAmount,
        currency: input.currency || 'USD',
      },
      lineItems,
    };
  }

  async executeDistributionRun(
    fundId: string,
    input: {
      waterfallConfigId: string;
      asOfTimestamp: string;
      grossDistributableAmount: string;
      currency?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    // Create ownership snapshot first
    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    const positions = contract
      ? await this.prisma.tokenPosition.findMany({
          where: { tokenContractId: contract.id },
          include: { wallet: { include: { investor: true } } },
        })
      : [];

    const totalSupply = positions.reduce(
      (sum, p) => sum + Number(p.settledTokenBalance),
      0,
    );
    if (totalSupply === 0) {
      throw new ConflictError(
        'NO_SETTLED_OWNERSHIP',
        'No settled ownership for distribution',
      );
    }

    // Create snapshot
    const snapshot = await this.prisma.ownershipSnapshot.create({
      data: {
        fundId,
        tokenContractId: contract?.id,
        snapshotType: 'RUN_START',
        asOfTimestamp: new Date(input.asOfTimestamp),
        source: 'DISTRIBUTION_RUN',
      },
    });

    for (const p of positions) {
      const wallet = await this.prisma.wallet.findFirst({
        where: { addressNorm: p.walletAddress.toLowerCase() },
      });
      await this.prisma.ownershipSnapshotRow.create({
        data: {
          snapshotId: snapshot.id,
          investorId: p.wallet?.investor?.id,
          walletId: wallet?.id,
          walletAddress: p.walletAddress,
          settledTokenBalance: Number(p.settledTokenBalance),
          ownershipPct: (Number(p.settledTokenBalance) / totalSupply) * 100,
        },
      });
    }

    const grossAmount = parseFloat(input.grossDistributableAmount);

    // Create distribution run
    const run = await this.prisma.distributionRun.create({
      data: {
        fundId,
        waterfallConfigId: input.waterfallConfigId,
        ownershipSnapshotId: snapshot.id,
        runStatus: 'RUNNING',
        asOfTimestamp: new Date(input.asOfTimestamp),
        startedAt: new Date(),
        currency: input.currency || 'USD',
        metadata: {},
      },
    });

    try {
      let totalGross = 0;
      for (const p of positions) {
        const ownershipPct =
          (Number(p.settledTokenBalance) / totalSupply) * 100;
        const allocation = (ownershipPct / 100) * grossAmount;
        totalGross += allocation;

        // Find capital account
        const capitalAccount = await this.prisma.capitalAccount.findFirst({
          where: {
            fundId,
            investorId: p.wallet?.investor?.id,
            isCurrent: true,
            deletedAt: null,
          },
        });

        await this.prisma.distributionLineItem.create({
          data: {
            distributionRunId: run.id,
            investorId: p.wallet?.investor?.id ?? '',
            walletId: p.walletId,
            capitalAccountId: capitalAccount?.id,
            grossAmount: allocation,
            netAmount: allocation,
            currency: input.currency || 'USD',
            ownershipPctUsed: ownershipPct,
            prefAmount: 0,
            returnOfCapitalAmount: 0,
            promoteAmount: 0,
            tierBreakdown: {},
          },
        });
      }

      await this.prisma.distributionRun.update({
        where: { id: run.id },
        data: {
          runStatus: 'COMPLETED',
          completedAt: new Date(),
          totalGrossAmount: totalGross,
          totalNetAmount: totalGross,
        },
      });

      return {
        distributionRunId: run.id,
        runStatus: 'COMPLETED',
        lineItemCount: positions.length,
      };
    } catch (error) {
      await this.prisma.distributionRun.update({
        where: { id: run.id },
        data: {
          runStatus: 'FAILED',
          failureReason:
            error instanceof Error ? error.message : 'unknown',
        },
      });
      throw error;
    }
  }
}
