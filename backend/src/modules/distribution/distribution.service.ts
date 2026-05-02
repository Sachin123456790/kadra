import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';

interface TierBreakdown {
  readonly returnOfCapital: string;
  readonly preferredReturn: string;
  readonly gpCatchUp: string;
  readonly carriedInterest: string;
}

export interface WaterfallLineItem {
  readonly investorId: string | null;
  readonly investorName: string | null;
  readonly walletAddress: string;
  readonly ownershipPctUsed: number;
  readonly grossAmount: string;
  readonly netAmount: string;
  readonly returnOfCapitalAmount: number;
  readonly prefAmount: number;
  readonly promoteAmount: number;
  readonly tierBreakdown: TierBreakdown;
}

export interface WaterfallConfig {
  readonly prefReturnPct: number | null;
  readonly gpPromotePct: number | null;
  readonly catchUpEnabled: boolean;
}

interface PositionWithInvestor {
  readonly walletAddress: string;
  readonly walletId: string | null;
  readonly settledTokenBalance: unknown;
  readonly wallet?: {
    readonly investor?: {
      readonly id: string;
      readonly legalName: string;
    } | null;
  } | null;
}

@Injectable()
export class DistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  /**
   * Apply tiered waterfall logic to a single LP position.
   *
   * Tiers (standard PE waterfall):
   *  1. Return of Capital — return LP's initial contribution first
   *  2. Preferred Return — prefReturnPct on the contribution
   *  3. GP Catch-up — if enabled, GP receives until their promote share is met
   *  4. Carried Interest — remaining split LP / GP per gpPromotePct
   */
  private computeWaterfallForPosition(
    position: PositionWithInvestor,
    totalSupply: number,
    grossAmount: number,
    config: WaterfallConfig,
    initialContribution: number,
  ): WaterfallLineItem {
    const ownershipPct =
      (Number(position.settledTokenBalance) / totalSupply) * 100;
    const lpGrossAllocation = (ownershipPct / 100) * grossAmount;

    const prefRate = config.prefReturnPct
      ? Number(config.prefReturnPct) / 100
      : 0;
    const gpPromoteRate = config.gpPromotePct
      ? Number(config.gpPromotePct) / 100
      : 0;

    // Use initial contribution if available, otherwise fall back to gross allocation
    const contribution =
      initialContribution > 0 ? initialContribution : lpGrossAllocation;

    // Tier 1: Return of Capital — up to the LP's contribution
    const returnOfCapital = Math.min(lpGrossAllocation, contribution);
    let remaining = Math.max(0, lpGrossAllocation - returnOfCapital);

    // Tier 2: Preferred Return — prefReturnPct applied to the contribution
    const preferredReturn = Math.min(remaining, contribution * prefRate);
    remaining = Math.max(0, remaining - preferredReturn);

    // Tier 3: GP Catch-up — if enabled, GP receives 100% until GP's total
    // equals gpPromoteRate of cumulative distributions (RoC + pref + catch-up)
    let gpCatchUp = 0;
    if (config.catchUpEnabled && gpPromoteRate > 0 && remaining > 0) {
      // GP needs to "catch up" so their total equals gpPromoteRate of total distributed so far.
      // After tiers 1+2, LP has received (returnOfCapital + preferredReturn).
      // GP catch-up amount = (lpReceived / (1 - gpPromoteRate)) * gpPromoteRate - 0 (GP has 0 so far)
      const lpReceivedSoFar = returnOfCapital + preferredReturn;
      const targetGpTotal =
        (lpReceivedSoFar / (1 - gpPromoteRate)) * gpPromoteRate;
      gpCatchUp = Math.min(remaining, targetGpTotal);
      remaining = Math.max(0, remaining - gpCatchUp);
    }

    // Tier 4: Carried Interest — split remaining between LP and GP
    const carriedInterestGp = remaining * gpPromoteRate;

    // Total GP take = catch-up + carried interest GP portion
    const totalPromote = gpCatchUp + carriedInterestGp;

    // Net to LP = gross allocation - total GP promote
    const netToLP = lpGrossAllocation - totalPromote;

    return {
      investorId: position.wallet?.investor?.id ?? null,
      investorName: position.wallet?.investor?.legalName ?? null,
      walletAddress: position.walletAddress,
      ownershipPctUsed: ownershipPct,
      grossAmount: lpGrossAllocation.toFixed(2),
      netAmount: netToLP.toFixed(2),
      returnOfCapitalAmount: returnOfCapital,
      prefAmount: preferredReturn,
      promoteAmount: totalPromote,
      tierBreakdown: {
        returnOfCapital: returnOfCapital.toFixed(2),
        preferredReturn: preferredReturn.toFixed(2),
        gpCatchUp: gpCatchUp.toFixed(2),
        carriedInterest: carriedInterestGp.toFixed(2),
      },
    };
  }

  /**
   * Fetch initial contribution for an investor's capital account.
   */
  private async getInitialContribution(
    fundId: string,
    investorId: string | null | undefined,
  ): Promise<number> {
    if (!investorId) return 0;
    const account = await this.prisma.capitalAccount.findFirst({
      where: { fundId, investorId, isCurrent: true, deletedAt: null },
    });
    return account ? Number(account.initialContribution) : 0;
  }

  /**
   * Read-only simulation of how a hypothetical distribution would be split for
   * a single LP. No DB writes. Uses the active waterfall config + the LP's
   * current settled token balance + their initial capital contribution.
   */
  async simulateForInvestor(
    fundId: string,
    investorId: string,
    totalAmount: number,
  ): Promise<{
    totalAmount: number;
    breakdown: WaterfallLineItem;
    waterfall: WaterfallConfig;
    fundOwnershipPct: number;
    contribution: number;
  }> {
    const config = await this.prisma.waterfallConfig.findFirst({
      where: { fundId, isActive: true, deletedAt: null },
    });
    if (!config) throw new NotFoundError('WaterfallConfig', fundId);

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

    const myPosition = positions.find(
      (p) => p.wallet?.investor?.id === investorId,
    );
    if (!myPosition) {
      throw new NotFoundError('TokenPosition', investorId);
    }

    const waterfallConfig: WaterfallConfig = {
      prefReturnPct: config.prefReturnPct ? Number(config.prefReturnPct) : null,
      gpPromotePct: config.gpPromotePct ? Number(config.gpPromotePct) : null,
      catchUpEnabled: config.catchUpEnabled,
    };
    const contribution = await this.getInitialContribution(fundId, investorId);
    const breakdown = this.computeWaterfallForPosition(
      myPosition,
      totalSupply,
      totalAmount,
      waterfallConfig,
      contribution,
    );

    return {
      totalAmount,
      breakdown,
      waterfall: waterfallConfig,
      fundOwnershipPct:
        (Number(myPosition.settledTokenBalance) / totalSupply) * 100,
      contribution,
    };
  }

  /**
   * Persist a simulated distribution for a single LP. Creates a
   * DistributionRun row marked chainStatus=SIMULATED with one
   * DistributionLineItem and a Distribution notice. Does NOT mutate
   * tokenPositions or fire any chain transaction.
   */
  async recordDemoForInvestor(
    fundId: string,
    investorId: string,
    totalAmount: number,
    notices: {
      generateNotice: (input: {
        fundId: string;
        type: string;
        recipientInvestorId: string;
        distributionRunId?: string;
      }) => Promise<unknown>;
    },
  ) {
    const sim = await this.simulateForInvestor(fundId, investorId, totalAmount);

    const config = await this.prisma.waterfallConfig.findFirst({
      where: { fundId, isActive: true, deletedAt: null },
    });
    if (!config) throw new NotFoundError('WaterfallConfig', fundId);

    const snapshot = await this.prisma.ownershipSnapshot.create({
      data: {
        fundId,
        snapshotType: 'RUN_START',
        asOfTimestamp: new Date(),
        source: 'INVESTOR_SIMULATION',
      },
    });

    const run = await this.prisma.distributionRun.create({
      data: {
        fundId,
        waterfallConfigId: config.id,
        ownershipSnapshotId: snapshot.id,
        runStatus: 'COMPLETED',
        chainStatus: 'SIMULATED',
        asOfTimestamp: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        totalGrossAmount: totalAmount,
        totalNetAmount: parseFloat(sim.breakdown.netAmount),
        currency: 'USD',
        triggeredBy: `investor:${investorId}`,
        metadata: {
          source: 'INVESTOR_SIMULATION',
          note: 'LP-initiated demo distribution. Off-chain, no GP approval, no batch wire.',
        },
      },
    });

    const wallet = await this.prisma.wallet.findFirst({
      where: { investorId, deletedAt: null },
    });
    const capitalAccount = await this.prisma.capitalAccount.findFirst({
      where: { fundId, investorId, isCurrent: true, deletedAt: null },
    });

    await this.prisma.distributionLineItem.create({
      data: {
        distributionRunId: run.id,
        investorId,
        walletId: wallet?.id,
        capitalAccountId: capitalAccount?.id,
        grossAmount: parseFloat(sim.breakdown.grossAmount),
        netAmount: parseFloat(sim.breakdown.netAmount),
        currency: 'USD',
        ownershipPctUsed: sim.breakdown.ownershipPctUsed,
        prefAmount: sim.breakdown.prefAmount,
        returnOfCapitalAmount: sim.breakdown.returnOfCapitalAmount,
        promoteAmount: sim.breakdown.promoteAmount,
        tierBreakdown: sim.breakdown.tierBreakdown as object,
      },
    });

    await this.eventLog.log({
      eventType: 'DISTRIBUTION_SIMULATED',
      aggregateType: 'DISTRIBUTION_RUN',
      aggregateId: run.id,
      fundId,
      payload: {
        investorId,
        totalAmount,
        ownershipPct: sim.fundOwnershipPct,
        netToLP: sim.breakdown.netAmount,
      },
    });

    try {
      await notices.generateNotice({
        fundId,
        type: 'DISTRIBUTION',
        recipientInvestorId: investorId,
        distributionRunId: run.id,
      });
    } catch {
      // Notice generation failure shouldn't break the demo flow.
    }

    return {
      runId: run.id,
      chainStatus: 'SIMULATED' as const,
      breakdown: sim.breakdown,
      totalAmount,
    };
  }

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

  async getDistributionRun(fundId: string, runId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const run = await this.prisma.distributionRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new NotFoundError('DistributionRun', runId);
    if (run.fundId !== fundId) {
      throw new ConflictError(
        'RUN_FUND_MISMATCH',
        'Distribution run does not belong to this fund',
      );
    }

    const lineItems = await this.prisma.distributionLineItem.findMany({
      where: { distributionRunId: runId },
      include: {
        investor: true,
        wallet: true,
      },
      orderBy: { grossAmount: 'desc' },
    });

    return {
      run: {
        distributionRunId: run.id,
        fundId: run.fundId,
        waterfallConfigId: run.waterfallConfigId,
        ownershipSnapshotId: run.ownershipSnapshotId,
        runStatus: run.runStatus,
        asOfTimestamp: run.asOfTimestamp.toISOString(),
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
        totalGrossAmount: run.totalGrossAmount
          ? Number(run.totalGrossAmount).toFixed(2)
          : null,
        totalNetAmount: run.totalNetAmount
          ? Number(run.totalNetAmount).toFixed(2)
          : null,
        currency: run.currency,
        failureReason: run.failureReason,
      },
      lineItems: lineItems.map((li) => ({
        lineItemId: li.id,
        investorId: li.investorId,
        investorName: li.investor?.legalName ?? null,
        walletId: li.walletId,
        walletAddress: li.wallet?.address ?? null,
        grossAmount: Number(li.grossAmount).toFixed(2),
        netAmount: Number(li.netAmount).toFixed(2),
        currency: li.currency,
        ownershipPctUsed: li.ownershipPctUsed
          ? Number(li.ownershipPctUsed)
          : null,
        prefAmount: Number(li.prefAmount).toFixed(2),
        returnOfCapitalAmount: Number(li.returnOfCapitalAmount).toFixed(2),
        promoteAmount: Number(li.promoteAmount).toFixed(2),
        tierBreakdown: li.tierBreakdown,
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
    if (!config)
      throw new NotFoundError('WaterfallConfig', input.waterfallConfigId);

    // Get current positions for ownership %
    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    let positions: PositionWithInvestor[] = contract
      ? await this.prisma.tokenPosition.findMany({
          where: { tokenContractId: contract.id },
          include: { wallet: { include: { investor: true } } },
        })
      : [];

    let totalSupply = positions.reduce(
      (sum, p) => sum + Number(p.settledTokenBalance),
      0,
    );

    // Fallback: build positions from SETTLED subscriptions if no token positions
    if (totalSupply === 0) {
      const settledSubs = await this.prisma.subscription.findMany({
        where: { fundId, status: 'SETTLED', deletedAt: null },
        include: { investor: true, wallet: true },
      });

      if (settledSubs.length === 0) {
        throw new ConflictError(
          'NO_SETTLED_OWNERSHIP',
          'No settled ownership found for distribution',
        );
      }

      positions = settledSubs.map((s) => ({
        walletAddress: s.wallet?.address ?? '',
        walletId: s.walletId,
        settledTokenBalance: s.committedAmount,
        wallet: s.wallet
          ? { investor: { id: s.investorId, legalName: s.investor.legalName } }
          : null,
      }));
      totalSupply = positions.reduce(
        (sum, p) => sum + Number(p.settledTokenBalance),
        0,
      );
    }

    const grossAmount = parseFloat(input.grossDistributableAmount);

    const waterfallConfig: WaterfallConfig = {
      prefReturnPct: config.prefReturnPct ? Number(config.prefReturnPct) : null,
      gpPromotePct: config.gpPromotePct ? Number(config.gpPromotePct) : null,
      catchUpEnabled: config.catchUpEnabled,
    };

    // Apply tiered waterfall calculation per LP position
    const lineItems: WaterfallLineItem[] = [];
    let totalNet = 0;

    for (const p of positions) {
      const contribution = await this.getInitialContribution(
        fundId,
        p.wallet?.investor?.id,
      );
      const item = this.computeWaterfallForPosition(
        p,
        totalSupply,
        grossAmount,
        waterfallConfig,
        contribution,
      );
      lineItems.push(item);
      totalNet += parseFloat(item.netAmount);
    }

    return {
      asOfTimestamp: input.asOfTimestamp,
      summary: {
        gross: input.grossDistributableAmount,
        net: totalNet.toFixed(2),
        totalPromote: (grossAmount - totalNet).toFixed(2),
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

    // Fetch waterfall config for tiered calculation
    const config = await this.prisma.waterfallConfig.findUnique({
      where: { id: input.waterfallConfigId },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
    });
    if (!config)
      throw new NotFoundError('WaterfallConfig', input.waterfallConfigId);

    const waterfallConfig: WaterfallConfig = {
      prefReturnPct: config.prefReturnPct ? Number(config.prefReturnPct) : null,
      gpPromotePct: config.gpPromotePct ? Number(config.gpPromotePct) : null,
      catchUpEnabled: config.catchUpEnabled,
    };

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
      let totalNet = 0;

      for (const p of positions) {
        // Find capital account for contribution data
        const capitalAccount = await this.prisma.capitalAccount.findFirst({
          where: {
            fundId,
            investorId: p.wallet?.investor?.id,
            isCurrent: true,
            deletedAt: null,
          },
        });

        const contribution = capitalAccount
          ? Number(capitalAccount.initialContribution)
          : 0;

        const item = this.computeWaterfallForPosition(
          p,
          totalSupply,
          grossAmount,
          waterfallConfig,
          contribution,
        );

        totalGross += parseFloat(item.grossAmount);
        totalNet += parseFloat(item.netAmount);

        await this.prisma.distributionLineItem.create({
          data: {
            distributionRunId: run.id,
            investorId: p.wallet?.investor?.id ?? '',
            walletId: p.walletId,
            capitalAccountId: capitalAccount?.id,
            grossAmount: parseFloat(item.grossAmount),
            netAmount: parseFloat(item.netAmount),
            currency: input.currency || 'USD',
            ownershipPctUsed: item.ownershipPctUsed,
            prefAmount: item.prefAmount,
            returnOfCapitalAmount: item.returnOfCapitalAmount,
            promoteAmount: item.promoteAmount,
            tierBreakdown: item.tierBreakdown as object,
          },
        });
      }

      await this.prisma.distributionRun.update({
        where: { id: run.id },
        data: {
          runStatus: 'COMPLETED',
          completedAt: new Date(),
          totalGrossAmount: totalGross,
          totalNetAmount: totalNet,
        },
      });

      await this.eventLog.log({
        eventType: 'DISTRIBUTION_COMPLETED',
        aggregateType: 'DISTRIBUTION_RUN',
        aggregateId: run.id,
        fundId,
        payload: {
          totalGross,
          totalNet,
          lineItemCount: positions.length,
          currency: input.currency || 'USD',
          waterfallConfigId: input.waterfallConfigId,
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
          failureReason: error instanceof Error ? error.message : 'unknown',
        },
      });
      throw error;
    }
  }
}
