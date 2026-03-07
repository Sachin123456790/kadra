import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async getCapTable(fundId: string, options?: { asOfTimestamp?: string; includePending?: boolean }) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const contract = await this.prisma.tokenContract.findFirst({
      where: { fundId, deploymentStatus: 'DEPLOYED', deletedAt: null },
    });

    // Get settled positions from token_positions
    const positions = contract
      ? await this.prisma.tokenPosition.findMany({
          where: { tokenContractId: contract.id },
          include: { wallet: { include: { investor: true } } },
        })
      : [];

    // Calculate total supply for ownership %
    const totalSupply = positions.reduce((sum, p) => sum + Number(p.settledTokenBalance), 0);

    // Get pending subscriptions if requested
    let pendingSubs: any[] = [];
    if (options?.includePending !== false) {
      pendingSubs = await this.prisma.subscription.findMany({
        where: { fundId, status: 'PENDING', deletedAt: null },
        include: { investor: true, wallet: true },
      });
    }

    const rows = positions.map((p) => ({
      investorId: p.wallet?.investor?.id ?? null,
      investorName: p.wallet?.investor?.legalName ?? null,
      walletAddress: p.walletAddress,
      pendingAllocationPct: 0,
      settledTokenBalance: Number(p.settledTokenBalance).toString(),
      ownershipPct: totalSupply > 0 ? (Number(p.settledTokenBalance) / totalSupply) * 100 : 0,
    }));

    // Add pending entries
    for (const sub of pendingSubs) {
      const existingRow = rows.find(
        (r) => r.walletAddress.toLowerCase() === sub.wallet.address.toLowerCase(),
      );
      if (existingRow) {
        existingRow.pendingAllocationPct = Number(sub.allocationPct);
      } else {
        rows.push({
          investorId: sub.investorId,
          investorName: sub.investor.legalName,
          walletAddress: sub.wallet.address,
          pendingAllocationPct: Number(sub.allocationPct),
          settledTokenBalance: '0',
          ownershipPct: 0,
        });
      }
    }

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
        { fromWalletAddress: { equals: filters.walletAddress, mode: 'insensitive' } },
        { toWalletAddress: { equals: filters.walletAddress, mode: 'insensitive' } },
      ];
    }
    if (filters?.from)
      where.blockTimestamp = { ...where.blockTimestamp, gte: new Date(filters.from) };
    if (filters?.to)
      where.blockTimestamp = { ...where.blockTimestamp, lte: new Date(filters.to) };

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
    const balanceMap = new Map<string, { balance: number; lastEventId: string; blockNumber: bigint | null; blockTimestamp: Date }>();

    for (const event of events) {
      const amount = Number(event.tokenAmount);

      if (event.fromWalletAddress) {
        const fromNorm = event.fromWalletAddress.toLowerCase();
        const existing = balanceMap.get(fromNorm) ?? { balance: 0, lastEventId: event.id, blockNumber: event.blockNumber, blockTimestamp: event.blockTimestamp };
        existing.balance -= amount;
        existing.lastEventId = event.id;
        existing.blockNumber = event.blockNumber;
        existing.blockTimestamp = event.blockTimestamp;
        balanceMap.set(fromNorm, existing);
      }

      if (event.toWalletAddress) {
        const toNorm = event.toWalletAddress.toLowerCase();
        const existing = balanceMap.get(toNorm) ?? { balance: 0, lastEventId: event.id, blockNumber: event.blockNumber, blockTimestamp: event.blockTimestamp };
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
