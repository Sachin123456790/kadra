import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../common/errors';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async listInvestors(fundId: string, filters?: { eligibilityStatus?: string; verificationStatus?: string; search?: string }) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const investors = await this.prisma.investor.findMany({
      where: {
        deletedAt: null,
        ...(filters?.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
        ...(filters?.search ? { legalName: { contains: filters.search, mode: 'insensitive' as const } } : {}),
      },
      include: {
        wallets: { where: { deletedAt: null } },
        eligibilities: {
          where: { fundId, deletedAt: null },
        },
      },
    });

    let results = investors.map((inv) => ({
      investorId: inv.id,
      legalName: inv.legalName,
      email: inv.email,
      verificationStatus: inv.verificationStatus,
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
            effectiveAt: inv.eligibilities[0].effectiveAt?.toISOString() ?? null,
          }
        : null,
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

  async upsertEligibility(fundId: string, input: { investorId: string; walletId: string; status: string; reason?: string }) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const investor = await this.prisma.investor.findUnique({ where: { id: input.investorId } });
    if (!investor) throw new NotFoundError('Investor', input.investorId);
    if (investor.verificationStatus !== 'VERIFIED') {
      throw new ConflictError('INVESTOR_NOT_VERIFIED', 'Investor must be VERIFIED before granting eligibility');
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { id: input.walletId } });
    if (!wallet) throw new NotFoundError('Wallet', input.walletId);
    if (wallet.investorId !== input.investorId) {
      throw new ConflictError('WALLET_NOT_LINKED', 'Wallet does not belong to this investor');
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
