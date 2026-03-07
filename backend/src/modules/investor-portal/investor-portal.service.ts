import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';

@Injectable()
export class InvestorPortalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve an investor record from the authenticated user's email.
   * Returns investor with wallets.
   */
  async resolveInvestor(email: string) {
    const investor = await this.prisma.investor.findFirst({
      where: { email, deletedAt: null },
      include: { wallets: { where: { deletedAt: null } } },
    });
    if (!investor) {
      throw new NotFoundError('Investor', email);
    }
    return investor;
  }

  /**
   * Aggregated dashboard view for a single investor within a fund.
   */
  async getDashboard(investorId: string, fundId: string) {
    // Investor info + wallets
    const investor = await this.prisma.investor.findUnique({
      where: { id: investorId },
      include: { wallets: { where: { deletedAt: null } } },
    });
    if (!investor) throw new NotFoundError('Investor', investorId);

    // Fund eligibility
    const eligibility = await this.prisma.investorFundEligibility.findMany({
      where: { fundId, investorId, deletedAt: null },
    });

    // Subscriptions with latest settlement record status
    const subscriptions = await this.prisma.subscription.findMany({
      where: { fundId, investorId, deletedAt: null },
      include: {
        settlementRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Token positions for this investor's wallets
    const walletIds = investor.wallets.map((w) => w.id);
    const positions = await this.prisma.tokenPosition.findMany({
      where: { fundId, walletId: { in: walletIds } },
    });

    // Calculate total supply from ALL positions for this fund's token contract
    let totalSupply = 0;
    if (positions.length > 0) {
      const contractId = positions[0].tokenContractId;
      const allPositions = await this.prisma.tokenPosition.findMany({
        where: { tokenContractId: contractId },
      });
      totalSupply = allPositions.reduce(
        (sum, p) => sum + Number(p.settledTokenBalance),
        0,
      );
    }

    const tokenPositions = positions.map((p) => ({
      id: p.id,
      walletAddress: p.walletAddress,
      settledTokenBalance: p.settledTokenBalance.toString(),
      ownershipPct:
        totalSupply > 0
          ? (Number(p.settledTokenBalance) / totalSupply) * 100
          : 0,
      asOfBlockNumber: p.asOfBlockNumber ? Number(p.asOfBlockNumber) : null,
      asOfTimestamp: p.asOfTimestamp?.toISOString() ?? null,
    }));

    // Capital account (current)
    const capitalAccount = await this.prisma.capitalAccount.findFirst({
      where: { fundId, investorId, isCurrent: true, deletedAt: null },
    });

    // Summary calculations
    const totalCommitted = subscriptions.reduce(
      (sum, s) => sum + Number(s.committedAmount),
      0,
    );
    const totalSettled = subscriptions
      .filter((s) => s.status === 'SETTLED')
      .reduce((sum, s) => sum + Number(s.committedAmount), 0);
    const tokenBalance = positions.reduce(
      (sum, p) => sum + Number(p.settledTokenBalance),
      0,
    );
    const ownershipPct =
      totalSupply > 0 ? (tokenBalance / totalSupply) * 100 : 0;

    return {
      investor: {
        id: investor.id,
        legalName: investor.legalName,
        email: investor.email,
        verificationStatus: investor.verificationStatus,
      },
      wallets: investor.wallets.map((w) => ({
        id: w.id,
        address: w.address,
        chainId: w.chainId,
        isPrimary: w.isPrimary,
        walletStatus: w.walletStatus,
      })),
      eligibility: eligibility.map((e) => ({
        id: e.id,
        eligibilityStatus: e.eligibilityStatus,
        effectiveAt: e.effectiveAt?.toISOString() ?? null,
        revokedAt: e.revokedAt?.toISOString() ?? null,
      })),
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        subscriptionRef: s.subscriptionRef,
        allocationPct: Number(s.allocationPct),
        committedAmount: s.committedAmount.toString(),
        currency: s.currency,
        status: s.status,
        settledAt: s.settledAt?.toISOString() ?? null,
        latestSettlementStatus:
          s.settlementRecords[0]?.status ?? null,
      })),
      tokenPositions,
      capitalAccount: capitalAccount
        ? {
            id: capitalAccount.id,
            openingBalance: capitalAccount.openingBalance.toString(),
            initialContribution: capitalAccount.initialContribution.toString(),
            capitalReturned: capitalAccount.capitalReturned.toString(),
            accruedPref: capitalAccount.accruedPref.toString(),
            residualAllocation: capitalAccount.residualAllocation.toString(),
            endingCapitalBalance:
              capitalAccount.endingCapitalBalance.toString(),
            asOfDate: capitalAccount.asOfDate.toISOString(),
          }
        : null,
      summary: {
        totalCommitted: totalCommitted.toString(),
        totalSettled: totalSettled.toString(),
        tokenBalance: tokenBalance.toString(),
        ownershipPct,
      },
    };
  }

  /**
   * List subscriptions for this investor in a fund.
   */
  async getMySubscriptions(investorId: string, fundId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { fundId, investorId, deletedAt: null },
      include: {
        settlementRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        governingDocument: {
          select: { id: true, originalFilename: true, documentType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s) => ({
      id: s.id,
      subscriptionRef: s.subscriptionRef,
      allocationPct: Number(s.allocationPct),
      committedAmount: s.committedAmount.toString(),
      currency: s.currency,
      status: s.status,
      settledAt: s.settledAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      latestSettlementStatus: s.settlementRecords[0]?.status ?? null,
      governingDocument: s.governingDocument
        ? {
            id: s.governingDocument.id,
            originalFilename: s.governingDocument.originalFilename,
            documentType: s.governingDocument.documentType,
          }
        : null,
    }));
  }

  /**
   * Read-only cap table for the fund. Visible to any authenticated investor.
   */
  async getCapTable(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

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

    // Also include pending subscriptions
    const pendingSubs = await this.prisma.subscription.findMany({
      where: { fundId, status: 'PENDING', deletedAt: null },
      include: { investor: true, wallet: true },
    });

    const rows = positions.map((p) => ({
      investorId: p.wallet?.investor?.id ?? null,
      investorName: p.wallet?.investor?.legalName ?? null,
      walletAddress: p.walletAddress,
      pendingAllocationPct: 0,
      settledTokenBalance: Number(p.settledTokenBalance).toString(),
      ownershipPct:
        totalSupply > 0
          ? (Number(p.settledTokenBalance) / totalSupply) * 100
          : 0,
    }));

    for (const sub of pendingSubs) {
      const existingRow = rows.find(
        (r) =>
          r.walletAddress.toLowerCase() ===
          sub.wallet.address.toLowerCase(),
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
      fundName: fund.name,
      asOfTimestamp: new Date().toISOString(),
      rows,
    };
  }

  /**
   * List distribution line items for this investor in a fund.
   */
  async getMyDistributions(investorId: string, fundId: string) {
    const lineItems = await this.prisma.distributionLineItem.findMany({
      where: {
        investorId,
        distributionRun: { fundId },
      },
      include: {
        distributionRun: {
          select: {
            id: true,
            fundId: true,
            runStatus: true,
            asOfTimestamp: true,
            completedAt: true,
            totalGrossAmount: true,
            totalNetAmount: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return lineItems.map((li) => ({
      id: li.id,
      grossAmount: li.grossAmount.toString(),
      netAmount: li.netAmount.toString(),
      currency: li.currency,
      ownershipPctUsed: li.ownershipPctUsed
        ? Number(li.ownershipPctUsed)
        : null,
      prefAmount: li.prefAmount.toString(),
      returnOfCapitalAmount: li.returnOfCapitalAmount.toString(),
      promoteAmount: li.promoteAmount.toString(),
      tierBreakdown: li.tierBreakdown,
      createdAt: li.createdAt.toISOString(),
      run: {
        id: li.distributionRun.id,
        runStatus: li.distributionRun.runStatus,
        asOfTimestamp: li.distributionRun.asOfTimestamp.toISOString(),
        completedAt: li.distributionRun.completedAt?.toISOString() ?? null,
        totalGrossAmount: li.distributionRun.totalGrossAmount?.toString() ?? null,
        totalNetAmount: li.distributionRun.totalNetAmount?.toString() ?? null,
        currency: li.distributionRun.currency,
      },
    }));
  }

  /**
   * List transfer requests involving this investor's wallets.
   */
  async getMyTransfers(investorId: string, fundId: string) {
    // Get all wallet IDs for this investor
    const wallets = await this.prisma.wallet.findMany({
      where: { investorId, deletedAt: null },
      select: { id: true },
    });
    const walletIds = wallets.map((w) => w.id);

    const transfers = await this.prisma.transferRequest.findMany({
      where: {
        fundId,
        deletedAt: null,
        OR: [
          { fromWalletId: { in: walletIds } },
          { toWalletId: { in: walletIds } },
        ],
      },
      include: {
        transferEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => ({
      id: t.id,
      fromWalletAddress: t.fromWalletAddress,
      toWalletAddress: t.toWalletAddress,
      tokenAmount: t.tokenAmount.toString(),
      requestStatus: t.requestStatus,
      precheckPassed: t.precheckPassed,
      precheckReasonCode: t.precheckReasonCode,
      precheckReasonText: t.precheckReasonText,
      submittedTxHash: t.submittedTxHash,
      submittedAt: t.submittedAt?.toISOString() ?? null,
      finalizedAt: t.finalizedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      events: t.transferEvents.map((e) => ({
        id: e.id,
        eventKind: e.eventKind,
        txHash: e.txHash,
        blockNumber: e.blockNumber ? Number(e.blockNumber) : null,
        reasonCode: e.reasonCode,
        reasonText: e.reasonText,
        createdAt: e.createdAt.toISOString(),
      })),
    }));
  }
}
