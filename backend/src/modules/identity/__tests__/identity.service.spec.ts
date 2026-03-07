import { IdentityService } from '../identity.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../../common/errors';

const mockPrisma = () => ({
  fund: { findUnique: jest.fn() },
  investor: { findMany: jest.fn(), findUnique: jest.fn() },
  wallet: { findUnique: jest.fn() },
  investorFundEligibility: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

describe('IdentityService', () => {
  let service: IdentityService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new IdentityService(prisma as unknown as PrismaService);
  });

  describe('listInvestors', () => {
    it('returns investors with wallets and eligibility', async () => {
      const fundId = 'fund-1';
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          legalName: 'Alice Corp',
          email: 'alice@example.com',
          verificationStatus: 'VERIFIED',
          wallets: [
            { id: 'w-1', address: '0xabc', chainId: 1, isPrimary: true, walletStatus: 'ACTIVE' },
          ],
          eligibilities: [
            { id: 'elig-1', eligibilityStatus: 'ELIGIBLE', effectiveAt: new Date('2024-01-01T00:00:00Z') },
          ],
        },
      ]);

      const result = await service.listInvestors(fundId);

      expect(result).toHaveLength(1);
      expect(result[0].investorId).toBe('inv-1');
      expect(result[0].legalName).toBe('Alice Corp');
      expect(result[0].wallets).toHaveLength(1);
      expect(result[0].wallets[0].walletId).toBe('w-1');
      expect(result[0].fundEligibility).not.toBeNull();
      expect(result[0].fundEligibility!.status).toBe('ELIGIBLE');
    });

    it('throws NotFoundError when fund does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);
      await expect(service.listInvestors('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('filters by eligibilityStatus NOT_SET', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: 'fund-1' });
      prisma.investor.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          legalName: 'Alice',
          email: null,
          verificationStatus: 'VERIFIED',
          wallets: [],
          eligibilities: [],
        },
        {
          id: 'inv-2',
          legalName: 'Bob',
          email: null,
          verificationStatus: 'VERIFIED',
          wallets: [],
          eligibilities: [{ id: 'e-1', eligibilityStatus: 'ELIGIBLE', effectiveAt: new Date() }],
        },
      ]);

      const result = await service.listInvestors('fund-1', { eligibilityStatus: 'NOT_SET' });
      expect(result).toHaveLength(1);
      expect(result[0].investorId).toBe('inv-1');
    });
  });

  describe('upsertEligibility', () => {
    const fundId = 'fund-1';
    const input = { investorId: 'inv-1', walletId: 'w-1', status: 'ELIGIBLE' };

    it('grants eligibility for verified investor (create path)', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv-1', verificationStatus: 'VERIFIED' });
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w-1', investorId: 'inv-1' });
      prisma.investorFundEligibility.findFirst.mockResolvedValue(null);
      prisma.investorFundEligibility.create.mockResolvedValue({
        id: 'elig-new',
        eligibilityStatus: 'ELIGIBLE',
        effectiveAt: new Date('2024-06-01T00:00:00Z'),
      });

      const result = await service.upsertEligibility(fundId, input);

      expect(result.eligibilityId).toBe('elig-new');
      expect(result.status).toBe('ELIGIBLE');
      expect(prisma.investorFundEligibility.create).toHaveBeenCalledTimes(1);
    });

    it('updates existing eligibility (update path)', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv-1', verificationStatus: 'VERIFIED' });
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w-1', investorId: 'inv-1' });
      prisma.investorFundEligibility.findFirst.mockResolvedValue({
        id: 'elig-existing',
        effectiveAt: new Date('2024-01-01'),
      });
      prisma.investorFundEligibility.update.mockResolvedValue({
        id: 'elig-existing',
        eligibilityStatus: 'REVOKED',
        effectiveAt: new Date('2024-01-01'),
      });

      const result = await service.upsertEligibility(fundId, { ...input, status: 'REVOKED', reason: 'Non-compliant' });

      expect(result.eligibilityId).toBe('elig-existing');
      expect(result.status).toBe('REVOKED');
      expect(prisma.investorFundEligibility.update).toHaveBeenCalledTimes(1);
    });

    it('rejects unverified investor', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv-1', verificationStatus: 'UNKNOWN' });

      await expect(service.upsertEligibility(fundId, input)).rejects.toThrow(ConflictError);
      await expect(service.upsertEligibility(fundId, input)).rejects.toThrow('Investor must be VERIFIED');
    });

    it('rejects wallet not owned by investor', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv-1', verificationStatus: 'VERIFIED' });
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w-1', investorId: 'inv-other' });

      await expect(service.upsertEligibility(fundId, input)).rejects.toThrow(ConflictError);
      await expect(service.upsertEligibility(fundId, input)).rejects.toThrow('Wallet does not belong to this investor');
    });

    it('throws NotFoundError when fund does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);
      await expect(service.upsertEligibility('no-fund', input)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when investor does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findUnique.mockResolvedValue(null);
      await expect(service.upsertEligibility(fundId, input)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when wallet does not exist', async () => {
      prisma.fund.findUnique.mockResolvedValue({ id: fundId });
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv-1', verificationStatus: 'VERIFIED' });
      prisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.upsertEligibility(fundId, input)).rejects.toThrow(NotFoundError);
    });
  });
});
