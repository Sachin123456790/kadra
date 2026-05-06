import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async getCapitalAccounts(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const accounts = await this.prisma.capitalAccount.findMany({
      where: { fundId, isCurrent: true, deletedAt: null },
      include: { investor: true },
    });

    return accounts.map((a) => ({
      id: a.id,
      investorId: a.investorId,
      investorName: a.investor.legalName,
      openingBalance: a.openingBalance.toString(),
      initialContribution: a.initialContribution.toString(),
      capitalReturned: a.capitalReturned.toString(),
      accruedPreferredReturn: a.accruedPref.toString(),
      residualAllocation: a.residualAllocation.toString(),
      endingBalance: a.endingCapitalBalance.toString(),
      asOfDate: a.asOfDate.toISOString(),
    }));
  }

  async getCapTable(
    fundId: string,
    options?: { asOfTimestamp?: string; includePending?: boolean },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    // Settled positions from token_positions (one row per wallet on chain)
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

    type CapRow = {
      investorId: string | null;
      investorName: string | null;
      walletAddress: string;
      pendingAllocationPct: number;
      settledTokenBalance: string;
      ownershipPct: number;
      subscriptionCount: number;
    };

    // Group by investor: an investor with multiple subscriptions / wallets
    // collapses into ONE cap-table row whose values are the sums. This is
    // the fix for the demo bug where top-up subs caused double-counting.
    // Wallet address is rendered as the investor's primary wallet so the
    // table stays one-to-one with investors.
    const byInvestor = new Map<string, CapRow>();
    const orphanRows: CapRow[] = []; // positions whose wallet is not linked to an investor

    const upsert = (
      investorId: string | null,
      investorName: string | null,
      walletAddress: string,
      partial: Partial<CapRow>,
    ) => {
      if (!investorId) {
        orphanRows.push({
          investorId: null,
          investorName,
          walletAddress,
          pendingAllocationPct: 0,
          settledTokenBalance: '0',
          ownershipPct: 0,
          subscriptionCount: 0,
          ...partial,
        });
        return;
      }
      const existing = byInvestor.get(investorId);
      if (!existing) {
        byInvestor.set(investorId, {
          investorId,
          investorName,
          walletAddress,
          pendingAllocationPct: 0,
          settledTokenBalance: '0',
          ownershipPct: 0,
          subscriptionCount: 0,
          ...partial,
        });
      } else {
        const merged: CapRow = {
          ...existing,
          investorName: existing.investorName ?? investorName,
          walletAddress: existing.walletAddress || walletAddress,
          pendingAllocationPct:
            existing.pendingAllocationPct + (partial.pendingAllocationPct ?? 0),
          settledTokenBalance: (
            Number(existing.settledTokenBalance) +
            Number(partial.settledTokenBalance ?? 0)
          ).toString(),
          ownershipPct: existing.ownershipPct + (partial.ownershipPct ?? 0),
          subscriptionCount:
            existing.subscriptionCount + (partial.subscriptionCount ?? 0),
        };
        byInvestor.set(investorId, merged);
      }
    };

    if (positions.length > 0) {
      // On-chain path: balances drive ownership %.
      for (const p of positions) {
        const investorId = p.wallet?.investor?.id ?? null;
        const investorName = p.wallet?.investor?.legalName ?? null;
        const balance = Number(p.settledTokenBalance);
        const ownershipPct =
          totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
        upsert(investorId, investorName, p.walletAddress, {
          settledTokenBalance: balance.toString(),
          ownershipPct,
        });
      }

      if (options?.includePending !== false) {
        const pendingSubs = await this.prisma.subscription.findMany({
          where: { fundId, status: 'PENDING', deletedAt: null },
          include: { investor: true, wallet: true },
        });
        for (const sub of pendingSubs) {
          upsert(
            sub.investorId,
            sub.investor.legalName,
            sub.wallet?.address ?? '',
            {
              pendingAllocationPct: Number(sub.allocationPct),
              subscriptionCount: 1,
            },
          );
        }
      }
    } else {
      // Pre-mint fallback: build cap table from subscriptions.
      // includePending defaults to true; only SETTLED subs are fetched
      // when includePending is explicitly false.
      const includePending = options?.includePending !== false;
      const subs = await this.prisma.subscription.findMany({
        where: {
          fundId,
          deletedAt: null,
          status: includePending ? { in: ['SETTLED', 'PENDING'] } : 'SETTLED',
        },
        include: { investor: true, wallet: true },
      });

      for (const sub of subs) {
        const isSettled = sub.status === 'SETTLED';
        upsert(
          sub.investorId,
          sub.investor.legalName,
          sub.wallet?.address ?? '',
          {
            ownershipPct: isSettled ? Number(sub.allocationPct) : 0,
            pendingAllocationPct: isSettled ? 0 : Number(sub.allocationPct),
            settledTokenBalance: isSettled
              ? Number(sub.committedAmount).toString()
              : '0',
            subscriptionCount: 1,
          },
        );
      }
    }

    const rows: CapRow[] = [...byInvestor.values(), ...orphanRows];

    return {
      fundId,
      asOfTimestamp: new Date().toISOString(),
      rows,
    };
  }

  async getOwnershipHistory(
    fundId: string,
    filters?: {
      walletAddress?: string;
      investorId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const where: any = { fundId };
    if (filters?.walletAddress) {
      where.OR = [
        {
          fromWalletAddress: {
            equals: filters.walletAddress,
            mode: 'insensitive',
          },
        },
        {
          toWalletAddress: {
            equals: filters.walletAddress,
            mode: 'insensitive',
          },
        },
      ];
    }
    if (filters?.from)
      where.blockTimestamp = {
        ...where.blockTimestamp,
        gte: new Date(filters.from),
      };
    if (filters?.to)
      where.blockTimestamp = {
        ...where.blockTimestamp,
        lte: new Date(filters.to),
      };

    const events = await this.prisma.tokenPositionEvent.findMany({
      where,
      orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
      take: 200,
    });

    return events.map((e) => ({
      eventId: e.id,
      eventType: e.eventType,
      fromWalletAddress: e.fromWalletAddress,
      toWalletAddress: e.toWalletAddress,
      tokenDelta: Number(e.tokenAmount).toString(),
      txHash: e.txHash,
      blockNumber: e.blockNumber ? Number(e.blockNumber) : null,
      eventTimestamp: e.blockTimestamp.toISOString(),
    }));
  }

  async rebuildProjection(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    if (!contract) {
      return { positionsRebuilt: 0, snapshotId: null };
    }

    // Fetch all position events for the contract, ordered chronologically
    const events = await this.prisma.tokenPositionEvent.findMany({
      where: { tokenContractId: contract.id, ingestStatus: 'CONFIRMED' },
      orderBy: [{ blockNumber: 'asc' }, { logIndex: 'asc' }],
    });

    // Rebuild balances from events
    const balanceMap = new Map<
      string,
      {
        balance: number;
        lastEventId: string;
        blockNumber: bigint | null;
        blockTimestamp: Date;
      }
    >();

    for (const event of events) {
      const amount = Number(event.tokenAmount);

      if (event.fromWalletAddress) {
        const fromNorm = event.fromWalletAddress.toLowerCase();
        const existing = balanceMap.get(fromNorm) ?? {
          balance: 0,
          lastEventId: event.id,
          blockNumber: event.blockNumber,
          blockTimestamp: event.blockTimestamp,
        };
        existing.balance -= amount;
        existing.lastEventId = event.id;
        existing.blockNumber = event.blockNumber;
        existing.blockTimestamp = event.blockTimestamp;
        balanceMap.set(fromNorm, existing);
      }

      if (event.toWalletAddress) {
        const toNorm = event.toWalletAddress.toLowerCase();
        const existing = balanceMap.get(toNorm) ?? {
          balance: 0,
          lastEventId: event.id,
          blockNumber: event.blockNumber,
          blockTimestamp: event.blockTimestamp,
        };
        existing.balance += amount;
        existing.lastEventId = event.id;
        existing.blockNumber = event.blockNumber;
        existing.blockTimestamp = event.blockTimestamp;
        balanceMap.set(toNorm, existing);
      }
    }

    // Delete existing positions for this contract and recreate atomically
    let positionsRebuilt = 0;
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenPosition.deleteMany({
        where: { tokenContractId: contract.id },
      });

      for (const [walletAddressNorm, data] of balanceMap.entries()) {
        if (data.balance <= 0) continue;

        const wallet = await tx.wallet.findFirst({
          where: { addressNorm: walletAddressNorm },
        });

        await tx.tokenPosition.create({
          data: {
            fundId,
            tokenContractId: contract.id,
            walletId: wallet?.id ?? null,
            walletAddress: wallet?.address ?? walletAddressNorm,
            walletAddressNorm,
            settledTokenBalance: data.balance,
            lastEventId: data.lastEventId,
            asOfBlockNumber: data.blockNumber,
            asOfTimestamp: data.blockTimestamp,
          },
        });
        positionsRebuilt++;
      }
    });

    // Create a snapshot recording this rebuild
    const snapshot = await this.createSnapshot(fundId, 'ON_DEMAND');

    return {
      positionsRebuilt,
      snapshotId: snapshot.snapshotId,
    };
  }

  async createSnapshot(fundId: string, type: string = 'ON_DEMAND') {
    const capTable = await this.getCapTable(fundId);
    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    const snapshot = await this.prisma.ownershipSnapshot.create({
      data: {
        fundId,
        tokenContractId: contract?.id,
        snapshotType: type,
        asOfTimestamp: new Date(),
        source: 'EVENTS_REBUILD',
      },
    });

    for (const row of capTable.rows) {
      const wallet = await this.prisma.wallet.findFirst({
        where: { addressNorm: row.walletAddress.toLowerCase() },
      });

      await this.prisma.ownershipSnapshotRow.create({
        data: {
          snapshotId: snapshot.id,
          investorId: row.investorId,
          walletId: wallet?.id,
          walletAddress: row.walletAddress,
          settledTokenBalance: parseFloat(row.settledTokenBalance),
          ownershipPct: row.ownershipPct,
          pendingAllocationPct: row.pendingAllocationPct,
        },
      });
    }

    return { snapshotId: snapshot.id, rowCount: capTable.rows.length };
  }
}
