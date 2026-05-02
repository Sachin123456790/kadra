import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { SignatureVerificationService } from './signature-verification.service';
import { computeOnboardingStage } from '../identity/onboarding-stage';

@Injectable()
export class InvestorPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: SignatureVerificationService,
  ) {}

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

  private formatMoney(value: number) {
    return value.toFixed(2);
  }

  private getYearBounds(taxYear: number) {
    return {
      start: new Date(`${taxYear}-01-01T00:00:00.000Z`),
      end: new Date(`${taxYear + 1}-01-01T00:00:00.000Z`),
    };
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
        latestSettlementStatus: s.settlementRecords[0]?.status ?? null,
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
        tokenPositionEvents: {
          where: { eventType: 'MINT', ingestStatus: 'CONFIRMED' },
          orderBy: [{ blockTimestamp: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
        governingDocument: {
          select: { id: true, originalFilename: true, documentType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s) => {
      const latestMint = s.tokenPositionEvents[0];
      return {
        id: s.id,
        subscriptionRef: s.subscriptionRef,
        allocationPct: Number(s.allocationPct),
        committedAmount: s.committedAmount.toString(),
        currency: s.currency,
        status: s.status,
        settledAt: s.settledAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        latestSettlementStatus: s.settlementRecords[0]?.status ?? null,
        mintTxHash: latestMint?.txHash ?? null,
        mintedAt: latestMint?.blockTimestamp?.toISOString() ?? null,
        mintEventId: latestMint?.id ?? null,
        governingDocument: s.governingDocument
          ? {
              id: s.governingDocument.id,
              originalFilename: s.governingDocument.originalFilename,
              documentType: s.governingDocument.documentType,
            }
          : null,
      };
    });
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
          r.walletAddress.toLowerCase() === sub.wallet.address.toLowerCase(),
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
            chainStatus: true,
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
        chainStatus: li.distributionRun.chainStatus,
        asOfTimestamp: li.distributionRun.asOfTimestamp.toISOString(),
        completedAt: li.distributionRun.completedAt?.toISOString() ?? null,
        totalGrossAmount:
          li.distributionRun.totalGrossAmount?.toString() ?? null,
        totalNetAmount: li.distributionRun.totalNetAmount?.toString() ?? null,
        currency: li.distributionRun.currency,
      },
    }));
  }

  /**
   * Derived onboarding stage for the current investor. Uses the default fund
   * (looked up by caller) for the eligibility check.
   */
  async getOnboardingForInvestor(investorId: string, fundId: string) {
    const inv = await this.prisma.investor.findFirst({
      where: { id: investorId, deletedAt: null },
      include: {
        wallets: { where: { deletedAt: null } },
        eligibilities: { where: { fundId, deletedAt: null } },
      },
    });
    if (!inv) throw new NotFoundError('Investor', investorId);

    return computeOnboardingStage({
      investor: inv,
      wallets: inv.wallets,
      eligibilities: inv.eligibilities,
    });
  }

  /**
   * Investor-driven profile step. Merges into metadata JSON — no new columns.
   */
  async updateMyProfile(
    email: string,
    input: {
      legalName?: string;
      country?: string;
      taxId?: string;
      sourceOfIncome?: string;
    },
  ) {
    const investor = await this.resolveInvestor(email);
    const existingMeta =
      (investor.metadata as Record<string, unknown> | null) ?? {};

    const nextMeta: Record<string, unknown> = {
      ...existingMeta,
      profileCompleted: true,
    };
    if (input.country !== undefined) nextMeta.country = input.country;
    if (input.taxId !== undefined) nextMeta.taxId = input.taxId;
    if (input.sourceOfIncome !== undefined)
      nextMeta.sourceOfIncome = input.sourceOfIncome;

    const updated = await this.prisma.investor.update({
      where: { id: investor.id },
      data: {
        legalName:
          input.legalName && input.legalName.trim().length > 0
            ? input.legalName.trim()
            : investor.legalName,
        metadata: nextMeta as any,
        updatedAt: new Date(),
      },
    });

    return {
      investorId: updated.id,
      legalName: updated.legalName,
      email: updated.email,
      metadata: updated.metadata,
    };
  }

  async getMyProfile(email: string) {
    const investor = await this.resolveInvestor(email);
    const walletCount = await this.prisma.wallet.count({
      where: { investorId: investor.id, deletedAt: null },
    });
    return {
      investorId: investor.id,
      legalName: investor.legalName,
      email: investor.email,
      verificationStatus: investor.verificationStatus,
      walletCount,
    };
  }

  async listMyWallets(email: string) {
    const investor = await this.resolveInvestor(email);
    const wallets = await this.prisma.wallet.findMany({
      where: { investorId: investor.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return wallets.map((w) => ({
      walletId: w.id,
      address: w.address,
      chainId: w.chainId,
      isPrimary: w.isPrimary,
      walletStatus: w.walletStatus,
      label: w.label,
    }));
  }

  async createWalletLinkChallenge(
    authUserId: string,
    email: string,
    input: { address: string; chainId: number },
  ) {
    const investor = await this.resolveInvestor(email);
    const addressNorm = input.address.toLowerCase();

    const nonce = this.signatureService.generateNonce();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    const message = this.signatureService.buildChallengeMessage({
      appName: 'Angainor',
      authUserId,
      walletAddress: input.address,
      chainId: input.chainId,
      nonce,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const challenge = await this.prisma.walletLinkChallenge.create({
      data: {
        authUserId,
        investorId: investor.id,
        chainId: input.chainId,
        walletAddress: input.address,
        walletAddressNorm: addressNorm,
        nonce,
        message,
        expiresAt,
      },
    });

    return {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      message: challenge.message,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }

  async verifyWalletLink(
    authUserId: string,
    email: string,
    input: {
      challengeId: string;
      address: string;
      chainId: number;
      signature: string;
      walletSource?: string;
    },
  ) {
    const investor = await this.resolveInvestor(email);

    const challenge = await this.prisma.walletLinkChallenge.findUnique({
      where: { id: input.challengeId },
    });

    if (!challenge) {
      throw new BadRequestException('Challenge not found');
    }
    if (challenge.authUserId !== authUserId) {
      throw new BadRequestException(
        'Challenge does not belong to this account',
      );
    }
    if (challenge.usedAt) {
      throw new BadRequestException('Challenge has already been used');
    }
    if (new Date() > challenge.expiresAt) {
      throw new BadRequestException(
        'Challenge has expired. Please request a new one.',
      );
    }
    if (challenge.walletAddressNorm !== input.address.toLowerCase()) {
      throw new BadRequestException('Address does not match challenge');
    }
    if (challenge.chainId !== input.chainId) {
      throw new BadRequestException('Chain ID does not match challenge');
    }

    // Verify signature
    const isValid = this.signatureService.isValidSignature(
      challenge.message,
      input.signature,
      input.address,
    );
    if (!isValid) {
      throw new BadRequestException(
        'Signature verification failed. The recovered address does not match.',
      );
    }

    // Mark challenge as used and create/update wallet in a transaction
    const addressNorm = input.address.toLowerCase();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.walletLinkChallenge.update({
        where: { id: challenge.id },
        data: { usedAt: new Date() },
      });

      // Check if wallet already exists for this investor
      const existingWallet = await tx.wallet.findFirst({
        where: {
          addressNorm,
          chainId: input.chainId,
          investorId: investor.id,
          deletedAt: null,
        },
      });

      if (existingWallet) {
        return existingWallet;
      }

      // Determine if this should be primary (first wallet = primary)
      const walletCount = await tx.wallet.count({
        where: { investorId: investor.id, deletedAt: null },
      });

      return tx.wallet.create({
        data: {
          investorId: investor.id,
          chainId: input.chainId,
          address: input.address,
          addressNorm,
          isPrimary: walletCount === 0,
          walletStatus: 'ACTIVE',
          walletSource: input.walletSource || 'METAMASK',
          label: walletCount === 0 ? 'Primary' : null,
        },
      });
    });

    return {
      walletId: result.id,
      investorId: investor.id,
      address: result.address,
      chainId: result.chainId,
      walletStatus: result.walletStatus,
    };
  }

  /**
   * List documents related to this investor in a fund.
   */
  async getMyDocuments(investorId: string, fundId: string) {
    // Get subscriptions for this investor to find governing documents
    const subscriptions = await this.prisma.subscription.findMany({
      where: { fundId, investorId, deletedAt: null },
      select: { governingDocumentId: true },
    });

    const governingDocIds = subscriptions
      .map((s) => s.governingDocumentId)
      .filter((id): id is string => id !== null);

    // Get documents linked to this investor (wire confirmations, etc.)
    const linkedDocs = await this.prisma.document.findMany({
      where: {
        fundId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: investorId,
        deletedAt: null,
      },
    });

    // Get governing documents
    const governingDocs =
      governingDocIds.length > 0
        ? await this.prisma.document.findMany({
            where: { id: { in: governingDocIds }, deletedAt: null },
          })
        : [];

    const allDocs = [...governingDocs, ...linkedDocs];

    // Deduplicate by id
    const seen = new Set<string>();
    const uniqueDocs = allDocs.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    return uniqueDocs.map((d) => ({
      id: d.id,
      name: d.originalFilename,
      type: d.documentType,
      createdAt: d.createdAt.toISOString(),
      status: d.parseStatus,
      downloadable: d.parseStatus === 'COMPLETED',
    }));
  }

  /**
   * Verify that an investor has access to a given document.
   * Access is granted if the document is:
   *  - Linked directly to this investor (wire confirmations, notices, etc.)
   *  - The governing document of a subscription the investor holds
   * Returns true if access is granted; throws NotFoundError otherwise (to avoid
   * leaking document existence to unauthorized callers).
   */
  async assertInvestorCanAccessDocument(
    investorId: string,
    fundId: string,
    documentId: string,
  ): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fundId: true,
        linkedEntityType: true,
        linkedEntityId: true,
        deletedAt: true,
      },
    });
    if (!doc || doc.deletedAt || doc.fundId !== fundId) {
      throw new NotFoundError('Document', documentId);
    }

    // Directly linked to this investor
    if (
      doc.linkedEntityType === 'INVESTOR' &&
      doc.linkedEntityId === investorId
    ) {
      return;
    }

    // Governing document on one of this investor's subscriptions
    const sub = await this.prisma.subscription.findFirst({
      where: {
        fundId,
        investorId,
        governingDocumentId: documentId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (sub) return;

    throw new NotFoundError('Document', documentId);
  }

  /**
   * Activity feed for this investor in a fund.
   */
  async getMyActivityFeed(investorId: string, fundId: string, limit: number) {
    // Get this investor's subscription and transfer IDs for filtering
    const subscriptions = await this.prisma.subscription.findMany({
      where: { fundId, investorId, deletedAt: null },
      select: { id: true },
    });
    const subIds = subscriptions.map((s) => s.id);

    const wallets = await this.prisma.wallet.findMany({
      where: { investorId, deletedAt: null },
      select: { id: true },
    });
    const walletIds = wallets.map((w) => w.id);

    const notices = await this.prisma.notice.findMany({
      where: {
        fundId,
        recipientInvestorId: investorId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const noticeIds = notices.map((n) => n.id);

    const transfers =
      walletIds.length > 0
        ? await this.prisma.transferRequest.findMany({
            where: {
              fundId,
              deletedAt: null,
              OR: [
                { fromWalletId: { in: walletIds } },
                { toWalletId: { in: walletIds } },
              ],
            },
            select: { id: true },
          })
        : [];
    const transferIds = transfers.map((t) => t.id);

    const aggregateIds = [
      ...subIds,
      ...transferIds,
      ...walletIds,
      ...noticeIds,
      investorId,
    ];

    const events = await this.prisma.systemEventLog.findMany({
      where: {
        OR: [
          {
            fundId,
            aggregateId: { in: aggregateIds },
          },
          {
            fundId: null,
            aggregateId: { in: [investorId, ...walletIds] },
          },
        ],
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: Number(e.id),
      eventId: e.eventId,
      eventType: e.eventType,
      aggregateType: e.aggregateType,
      aggregateId: e.aggregateId,
      payload: e.payloadJson,
      occurredAt: e.occurredAt.toISOString(),
      txHash: e.txHash,
    }));
  }

  /**
   * Fetch capital account statement for an investor within a fund.
   * Returns null if none exists.
   */
  async getCapitalAccountStatement(investorId: string, fundId: string) {
    const account = await this.prisma.capitalAccount.findFirst({
      where: { investorId, fundId, isCurrent: true, deletedAt: null },
    });
    if (!account) return null;
    return {
      openingBalance: account.openingBalance.toString(),
      initialContribution: account.initialContribution.toString(),
      capitalReturned: account.capitalReturned.toString(),
      accruedPreferredReturn: account.accruedPref.toString(),
      residualAllocation: account.residualAllocation.toString(),
      endingBalance: account.endingCapitalBalance.toString(),
      asOfDate: account.asOfDate.toISOString(),
    };
  }

  /**
   * Fetch a fund record with its name for CSV filenames etc.
   */
  async getFundMeta(fundId: string) {
    const fund = await this.prisma.fund.findUnique({
      where: { id: fundId },
      select: { id: true, name: true, code: true },
    });
    if (!fund) throw new NotFoundError('Fund', fundId);
    return fund;
  }

  /**
   * List GP reports visible to this investor within a fund.
   * Scoped by investor's fund membership (subscription existence).
   */
  async listGpReportsForInvestor(investorId: string, fundId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { fundId, investorId, deletedAt: null },
      select: { id: true },
    });
    if (!sub) return [];

    const docs = await this.prisma.document.findMany({
      where: {
        fundId,
        documentType: 'GP_REPORT',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => {
      const meta = (d.metadata as Record<string, unknown>) ?? {};
      return {
        documentId: d.id,
        title: (meta.title as string) ?? d.originalFilename,
        period: (meta.period as string) ?? null,
        fileName: d.originalFilename,
        byteSize: Number(d.byteSize),
        uploadedAt: d.createdAt.toISOString(),
      };
    });
  }

  /**
   * List GP reports for an admin view of a fund.
   */
  async listGpReportsForFund(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const docs = await this.prisma.document.findMany({
      where: { fundId, documentType: 'GP_REPORT', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => {
      const meta = (d.metadata as Record<string, unknown>) ?? {};
      return {
        documentId: d.id,
        title: (meta.title as string) ?? d.originalFilename,
        period: (meta.period as string) ?? null,
        fileName: d.originalFilename,
        mimeType: d.mimeType,
        byteSize: Number(d.byteSize),
        uploadedAt: d.createdAt.toISOString(),
        uploadedBy: d.uploadedBy,
      };
    });
  }

  /**
   * Tax report for this investor in a fund for a given year.
   */
  async getTaxReport(investorId: string, fundId: string, taxYear: number) {
    const report = await this.prisma.taxReport.findFirst({
      where: { investorId, fundId, taxYear },
    });

    if (report) {
      return {
        taxYear: report.taxYear,
        taxEntityName: report.taxEntityName,
        ordinaryIncome: report.ordinaryIncome.toString(),
        returnOfCapital: report.returnOfCapital.toString(),
        ltcg: report.ltcg.toString(),
        stcg: report.stcg.toString(),
        totalDistributions: report.totalDistributions.toString(),
        generatedAt: report.generatedAt.toISOString(),
        source: 'TAX_REPORT' as const,
      };
    }

    const { start, end } = this.getYearBounds(taxYear);
    const [fund, capitalAccount, settledSubscriptions, distributionItems] =
      await Promise.all([
        this.prisma.fund.findUnique({
          where: { id: fundId },
          select: { name: true, code: true },
        }),
        this.prisma.capitalAccount.findFirst({
          where: { investorId, fundId, deletedAt: null, isCurrent: true },
          select: { id: true, asOfDate: true },
        }),
        this.prisma.subscription.findMany({
          where: {
            investorId,
            fundId,
            deletedAt: null,
            status: 'SETTLED',
            settledAt: { gte: start, lt: end },
          },
          select: { id: true },
        }),
        this.prisma.distributionLineItem.findMany({
          where: {
            investorId,
            distributionRun: {
              fundId,
              runStatus: 'COMPLETED',
              asOfTimestamp: { gte: start, lt: end },
            },
          },
          select: {
            netAmount: true,
            returnOfCapitalAmount: true,
          },
        }),
      ]);

    const hasFundActivity =
      settledSubscriptions.length > 0 ||
      distributionItems.length > 0 ||
      Boolean(capitalAccount && capitalAccount.asOfDate >= start);

    if (!hasFundActivity) {
      return null;
    }

    const totalDistributions = distributionItems.reduce(
      (sum, item) => sum + Number(item.netAmount),
      0,
    );
    const returnOfCapital = distributionItems.reduce(
      (sum, item) => sum + Number(item.returnOfCapitalAmount),
      0,
    );

    return {
      taxYear,
      taxEntityName: fund?.name ?? fund?.code ?? null,
      ordinaryIncome: this.formatMoney(0),
      returnOfCapital: this.formatMoney(returnOfCapital),
      ltcg: this.formatMoney(0),
      stcg: this.formatMoney(0),
      totalDistributions: this.formatMoney(totalDistributions),
      generatedAt: new Date().toISOString(),
      source: 'DERIVED_LEDGER_PREVIEW' as const,
    };
  }

  /**
   * Waterfall breakdown for this investor in a fund.
   */
  async getWaterfallBreakdown(investorId: string, fundId: string) {
    // Get active waterfall config
    const waterfallConfig = await this.prisma.waterfallConfig.findFirst({
      where: { fundId, isActive: true },
    });

    // Get latest completed distribution run
    const distributionRun = await this.prisma.distributionRun.findFirst({
      where: { fundId, runStatus: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    let lineItem: Record<string, unknown> | null = null;
    if (distributionRun) {
      const item = await this.prisma.distributionLineItem.findFirst({
        where: { distributionRunId: distributionRun.id, investorId },
      });
      if (item) {
        lineItem = {
          id: item.id,
          grossAmount: item.grossAmount.toString(),
          netAmount: item.netAmount.toString(),
          currency: item.currency,
          ownershipPctUsed: item.ownershipPctUsed
            ? Number(item.ownershipPctUsed)
            : null,
          prefAmount: item.prefAmount.toString(),
          returnOfCapitalAmount: item.returnOfCapitalAmount.toString(),
          promoteAmount: item.promoteAmount.toString(),
          tierBreakdown: item.tierBreakdown,
        };
      }
    }

    return {
      waterfallConfig: waterfallConfig
        ? {
            id: waterfallConfig.id,
            version: waterfallConfig.version,
            calculationBasis: waterfallConfig.calculationBasis,
            distributionFrequency: waterfallConfig.distributionFrequency,
            catchUpEnabled: waterfallConfig.catchUpEnabled,
            gpPromotePct: waterfallConfig.gpPromotePct
              ? Number(waterfallConfig.gpPromotePct)
              : null,
            prefReturnPct: waterfallConfig.prefReturnPct
              ? Number(waterfallConfig.prefReturnPct)
              : null,
            rulesJson: waterfallConfig.rulesJson,
          }
        : null,
      distributionRun: distributionRun
        ? {
            id: distributionRun.id,
            runStatus: distributionRun.runStatus,
            asOfTimestamp: distributionRun.asOfTimestamp.toISOString(),
            completedAt: distributionRun.completedAt?.toISOString() ?? null,
          }
        : null,
      lineItem,
    };
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
