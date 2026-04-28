import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';
import { computeOnboardingStage } from './onboarding-stage';

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async createInvestor(input: {
    legalName: string;
    taxId?: string;
    email?: string;
    verificationStatus?: string;
  }) {
    const verificationStatus = input.verificationStatus ?? 'UNKNOWN';
    const now = new Date();

    const investor = await this.prisma.investor.create({
      data: {
        legalName: input.legalName,
        email: input.email ?? null,
        verificationStatus,
        verifiedAt: verificationStatus === 'VERIFIED' ? now : null,
        metadata: input.taxId ? { taxId: input.taxId } : {},
      },
    });

    await this.eventLog.log({
      eventType: 'INVESTOR_CREATED',
      aggregateType: 'INVESTOR',
      aggregateId: investor.id,
      payload: {
        legalName: investor.legalName,
        verificationStatus,
        email: input.email,
      },
    });

    return {
      investorId: investor.id,
      legalName: investor.legalName,
      verificationStatus: investor.verificationStatus,
    };
  }

  async updateVerification(
    investorId: string,
    input: {
      verificationStatus?: string;
      kycStatus?: string;
      accreditationStatus?: string;
      reason?: string;
    },
    actorUserId?: string,
  ) {
    const investor = await this.prisma.investor.findUnique({
      where: { id: investorId },
    });
    if (!investor) throw new NotFoundError('Investor', investorId);

    const now = new Date();

    const oldValues = {
      verificationStatus: investor.verificationStatus,
      kycStatus: investor.kycStatus,
      accreditationStatus: investor.accreditationStatus,
    };

    const nextVerificationStatus =
      input.verificationStatus ?? investor.verificationStatus;
    const nextKycStatus = input.kycStatus ?? investor.kycStatus;
    const nextAccreditationStatus =
      input.accreditationStatus ?? investor.accreditationStatus;

    const updated = await this.prisma.investor.update({
      where: { id: investorId },
      data: {
        verificationStatus: nextVerificationStatus,
        kycStatus: nextKycStatus,
        accreditationStatus: nextAccreditationStatus,
        verifiedAt:
          input.verificationStatus === 'VERIFIED'
            ? now
            : input.verificationStatus === 'REVOKED'
              ? null
              : investor.verifiedAt,
        updatedBy: actorUserId,
        updatedAt: now,
      },
    });

    await this.eventLog.log({
      eventType: 'INVESTOR_VERIFICATION_UPDATED',
      aggregateType: 'INVESTOR',
      aggregateId: investor.id,
      payload: {
        actorUserId,
        reason: input.reason,
        old: oldValues,
        new: {
          verificationStatus: updated.verificationStatus,
          kycStatus: updated.kycStatus,
          accreditationStatus: updated.accreditationStatus,
        },
      },
    });

    return {
      investorId: updated.id,
      legalName: updated.legalName,
      email: updated.email,
      verificationStatus: updated.verificationStatus,
      kycStatus: updated.kycStatus,
      accreditationStatus: updated.accreditationStatus,
    };
  }

  async linkWallet(
    investorId: string,
    input: {
      chainId: number;
      address: string;
      label?: string;
      isPrimary?: boolean;
    },
  ) {
    const investor = await this.prisma.investor.findUnique({
      where: { id: investorId },
    });
    if (!investor) throw new NotFoundError('Investor', investorId);

    const addressNorm = input.address.toLowerCase();

    const wallet = await this.prisma.wallet.create({
      data: {
        investorId,
        chainId: input.chainId,
        address: input.address,
        addressNorm,
        label: input.label ?? null,
        isPrimary: input.isPrimary ?? false,
        walletStatus: 'ACTIVE',
        // When an admin links a wallet on behalf of an investor (via the
        // Investors > Add Wallet modal), the address came from the investor
        // out-of-band — so it represents real investor custody. Mark it
        // IMPORTED so the onboarding stepper accepts it. SYSTEM_GENERATED is
        // reserved for wallets actually generated server-side (e.g. seeds).
        walletSource: 'IMPORTED',
      },
    });

    await this.eventLog.log({
      eventType: 'WALLET_LINKED',
      aggregateType: 'WALLET',
      aggregateId: wallet.id,
      payload: { investorId, chainId: input.chainId, address: input.address },
    });

    return {
      walletId: wallet.id,
      investorId: wallet.investorId,
      chainId: wallet.chainId,
      address: wallet.address,
    };
  }

  async listInvestors(
    fundId: string,
    filters?: {
      eligibilityStatus?: string;
      verificationStatus?: string;
      search?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const investors = await this.prisma.investor.findMany({
      where: {
        deletedAt: null,
        ...(filters?.verificationStatus
          ? { verificationStatus: filters.verificationStatus }
          : {}),
        ...(filters?.search
          ? {
              legalName: {
                contains: filters.search,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      include: {
        wallets: { where: { deletedAt: null } },
        eligibilities: {
          where: { fundId, deletedAt: null },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let results = investors.map((inv) => ({
      investorId: inv.id,
      legalName: inv.legalName,
      email: inv.email,
      createdAt: inv.createdAt.toISOString(),
      verificationStatus: inv.verificationStatus,
      kycStatus: inv.kycStatus,
      accreditationStatus: inv.accreditationStatus,
      wallets: inv.wallets.map((w) => ({
        walletId: w.id,
        address: w.address,
        chainId: w.chainId,
        isPrimary: w.isPrimary,
        status: w.walletStatus,
      })),
      fundEligibility: inv.eligibilities[0]
        ? {
            eligibilityId: inv.eligibilities[0].id,
            status: inv.eligibilities[0].eligibilityStatus,
            effectiveAt:
              inv.eligibilities[0].effectiveAt?.toISOString() ?? null,
          }
        : null,
      onboarding: computeOnboardingStage({
        investor: inv,
        wallets: inv.wallets,
        eligibilities: inv.eligibilities,
      }),
    }));

    if (filters?.eligibilityStatus) {
      results = results.filter((r) =>
        filters.eligibilityStatus === 'NOT_SET'
          ? !r.fundEligibility
          : r.fundEligibility?.status === filters.eligibilityStatus,
      );
    }

    return results;
  }

  async getInvestorDetail(investorId: string, fundId: string) {
    const inv = await this.prisma.investor.findFirst({
      where: { id: investorId, deletedAt: null },
      include: {
        wallets: { where: { deletedAt: null } },
        eligibilities: { where: { fundId, deletedAt: null } },
      },
    });
    if (!inv) throw new NotFoundError('Investor', investorId);

    return {
      investorId: inv.id,
      legalName: inv.legalName,
      email: inv.email,
      verificationStatus: inv.verificationStatus,
      kycStatus: inv.kycStatus,
      accreditationStatus: inv.accreditationStatus,
      metadata: inv.metadata,
      wallets: inv.wallets.map((w) => ({
        walletId: w.id,
        address: w.address,
        chainId: w.chainId,
        isPrimary: w.isPrimary,
        status: w.walletStatus,
        walletSource: w.walletSource,
      })),
      fundEligibility: inv.eligibilities[0]
        ? {
            eligibilityId: inv.eligibilities[0].id,
            status: inv.eligibilities[0].eligibilityStatus,
            effectiveAt:
              inv.eligibilities[0].effectiveAt?.toISOString() ?? null,
            walletId: inv.eligibilities[0].walletId,
          }
        : null,
      onboarding: computeOnboardingStage({
        investor: inv,
        wallets: inv.wallets,
        eligibilities: inv.eligibilities,
      }),
    };
  }

  async upsertEligibility(
    fundId: string,
    input: {
      investorId: string;
      walletId: string;
      status: string;
      reason?: string;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const investor = await this.prisma.investor.findUnique({
      where: { id: input.investorId },
    });
    if (!investor) throw new NotFoundError('Investor', input.investorId);
    const canGrantEligibility =
      investor.kycStatus === 'APPROVED' &&
      investor.accreditationStatus === 'APPROVED';
    if (input.status === 'ELIGIBLE' && !canGrantEligibility) {
      throw new ConflictError(
        'INVESTOR_NOT_APPROVED',
        'Investor must have approved KYC and accreditation before granting eligibility',
      );
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: input.walletId },
    });
    if (!wallet) throw new NotFoundError('Wallet', input.walletId);
    if (wallet.investorId !== input.investorId) {
      throw new ConflictError(
        'WALLET_NOT_LINKED',
        'Wallet does not belong to this investor',
      );
    }

    const existing = await this.prisma.investorFundEligibility.findFirst({
      where: { fundId, walletId: input.walletId, deletedAt: null },
    });

    const now = new Date();
    let eligibility;

    if (existing) {
      eligibility = await this.prisma.investorFundEligibility.update({
        where: { id: existing.id },
        data: {
          eligibilityStatus: input.status,
          effectiveAt: input.status === 'ELIGIBLE' ? now : existing.effectiveAt,
          revokedAt: input.status === 'REVOKED' ? now : null,
          reason: input.reason,
          updatedAt: now,
        },
      });
    } else {
      eligibility = await this.prisma.investorFundEligibility.create({
        data: {
          fundId,
          investorId: input.investorId,
          walletId: input.walletId,
          eligibilityStatus: input.status,
          effectiveAt: input.status === 'ELIGIBLE' ? now : null,
          revokedAt: input.status === 'REVOKED' ? now : null,
          reason: input.reason,
          source: 'MANUAL',
          metadata: {},
        },
      });
    }

    await this.eventLog.log({
      eventType: 'ELIGIBILITY_UPDATED',
      aggregateType: 'INVESTOR_FUND_ELIGIBILITY',
      aggregateId: eligibility.id,
      fundId,
      payload: {
        investorId: input.investorId,
        walletId: input.walletId,
        status: input.status,
        reason: input.reason,
      },
    });

    return {
      eligibilityId: eligibility.id,
      fundId,
      investorId: input.investorId,
      walletId: input.walletId,
      status: eligibility.eligibilityStatus,
      effectiveAt: eligibility.effectiveAt?.toISOString() ?? null,
    };
  }
}
