import { InvestorPortalService } from '../investor-portal.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SignatureVerificationService } from '../signature-verification.service';

const mockPrisma = () => ({
  investor: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  wallet: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  transferRequest: {
    findMany: jest.fn(),
  },
  systemEventLog: {
    findMany: jest.fn(),
  },
  taxReport: {
    findFirst: jest.fn(),
  },
  waterfallConfig: {
    findFirst: jest.fn(),
  },
  distributionRun: {
    findFirst: jest.fn(),
  },
  distributionLineItem: {
    findFirst: jest.fn(),
  },
});

describe('InvestorPortalService', () => {
  let service: InvestorPortalService;
  let prisma: ReturnType<typeof mockPrisma>;

  const investorId = 'inv-1';
  const fundId = 'fund-1';

  beforeEach(() => {
    prisma = mockPrisma();
    const mockSignatureService = {} as SignatureVerificationService;
    service = new InvestorPortalService(
      prisma as unknown as PrismaService,
      mockSignatureService,
    );
  });

  describe('getMyDocuments', () => {
    it('returns documents from subscriptions and linked docs', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { governingDocumentId: 'doc-1' },
        { governingDocumentId: 'doc-2' },
      ]);
      prisma.document.findMany
        .mockResolvedValueOnce([
          // linked docs (INVESTOR)
          {
            id: 'doc-3',
            originalFilename: 'wire.pdf',
            documentType: 'WIRE_CONFIRMATION',
            createdAt: new Date('2026-01-02T00:00:00Z'),
            parseStatus: 'COMPLETED',
          },
        ])
        .mockResolvedValueOnce([
          // governing docs (first call is linked, but order is: linked first in service)
        ]);

      // Actually the service calls linked docs first, then governing docs.
      // Let me re-mock based on the actual call order:
      prisma.document.findMany.mockReset();
      // First call: linked docs (linkedEntityType: INVESTOR)
      prisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-3',
          originalFilename: 'wire.pdf',
          documentType: 'WIRE_CONFIRMATION',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          parseStatus: 'COMPLETED',
        },
      ]);
      // Second call: governing docs (id: { in: [...] })
      prisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          originalFilename: 'lpa.pdf',
          documentType: 'MASTER_LPA',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          parseStatus: 'COMPLETED',
        },
      ]);

      const result = await service.getMyDocuments(investorId, fundId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('lpa.pdf');
      expect(result[1].name).toBe('wire.pdf');
    });
  });

  describe('getMyActivityFeed', () => {
    it('returns filtered events for investor', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ id: 'sub-1' }]);
      prisma.wallet.findMany.mockResolvedValue([{ id: 'wallet-1' }]);
      prisma.transferRequest.findMany.mockResolvedValue([{ id: 'transfer-1' }]);
      prisma.systemEventLog.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          eventId: 'evt-1',
          eventType: 'SUBSCRIPTION_CREATED',
          aggregateType: 'SUBSCRIPTION',
          aggregateId: 'sub-1',
          payloadJson: {},
          occurredAt: new Date('2026-01-01T00:00:00Z'),
          txHash: null,
        },
      ]);

      const result = await service.getMyActivityFeed(investorId, fundId, 50);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('SUBSCRIPTION_CREATED');
      expect(prisma.systemEventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fundId,
            aggregateId: { in: ['sub-1', 'transfer-1', investorId] },
          },
        }),
      );
    });
  });

  describe('getTaxReport', () => {
    it('returns tax report when found', async () => {
      prisma.taxReport.findFirst.mockResolvedValue({
        taxYear: 2025,
        taxEntityName: 'Alpine Capital Partners',
        ordinaryIncome: { toString: () => '50000.00' },
        returnOfCapital: { toString: () => '10000.00' },
        ltcg: { toString: () => '25000.00' },
        stcg: { toString: () => '5000.00' },
        totalDistributions: { toString: () => '90000.00' },
        generatedAt: new Date('2026-02-01T00:00:00Z'),
      });

      const result = await service.getTaxReport(investorId, fundId, 2025);

      expect(result).not.toBeNull();
      expect(result!.taxYear).toBe(2025);
      expect(result!.taxEntityName).toBe('Alpine Capital Partners');
      expect(result!.ordinaryIncome).toBe('50000.00');
    });

    it('returns null when no tax report exists', async () => {
      prisma.taxReport.findFirst.mockResolvedValue(null);

      const result = await service.getTaxReport(investorId, fundId, 2025);

      expect(result).toBeNull();
    });
  });

  describe('getWaterfallBreakdown', () => {
    it('returns config and line item when distribution run exists', async () => {
      prisma.waterfallConfig.findFirst.mockResolvedValue({
        id: 'wc-1',
        version: 'v1',
        calculationBasis: 'IRR',
        distributionFrequency: 'QUARTERLY',
        catchUpEnabled: false,
        gpPromotePct: { toString: () => '20' },
        prefReturnPct: { toString: () => '8' },
        rulesJson: { tiers: [] },
      });
      prisma.distributionRun.findFirst.mockResolvedValue({
        id: 'run-1',
        runStatus: 'COMPLETED',
        asOfTimestamp: new Date('2026-01-01T00:00:00Z'),
        completedAt: new Date('2026-01-01T01:00:00Z'),
      });
      prisma.distributionLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        grossAmount: { toString: () => '100000.00' },
        netAmount: { toString: () => '80000.00' },
        currency: 'USD',
        ownershipPctUsed: { toString: () => '20' },
        prefAmount: { toString: () => '16000.00' },
        returnOfCapitalAmount: { toString: () => '0.00' },
        promoteAmount: { toString: () => '4000.00' },
        tierBreakdown: { tier1: '80000' },
      });

      const result = await service.getWaterfallBreakdown(investorId, fundId);

      expect(result.waterfallConfig).not.toBeNull();
      expect(result.waterfallConfig!.calculationBasis).toBe('IRR');
      expect(result.distributionRun).not.toBeNull();
      expect(result.lineItem).not.toBeNull();
      expect(result.lineItem!.grossAmount).toBe('100000.00');
    });

    it('returns config only when no distribution run exists', async () => {
      prisma.waterfallConfig.findFirst.mockResolvedValue({
        id: 'wc-1',
        version: 'v1',
        calculationBasis: 'IRR',
        distributionFrequency: 'QUARTERLY',
        catchUpEnabled: false,
        gpPromotePct: null,
        prefReturnPct: null,
        rulesJson: {},
      });
      prisma.distributionRun.findFirst.mockResolvedValue(null);

      const result = await service.getWaterfallBreakdown(investorId, fundId);

      expect(result.waterfallConfig).not.toBeNull();
      expect(result.distributionRun).toBeNull();
      expect(result.lineItem).toBeNull();
    });
  });

  describe('assertInvestorCanAccessDocument', () => {
    const documentId = 'doc-xyz';

    it('allows access to documents directly linked to the investor', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: documentId,
        fundId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: investorId,
        deletedAt: null,
      });

      await expect(
        service.assertInvestorCanAccessDocument(investorId, fundId, documentId),
      ).resolves.toBeUndefined();
    });

    it('allows access to governing documents of investor subscriptions', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: documentId,
        fundId,
        linkedEntityType: null,
        linkedEntityId: null,
        deletedAt: null,
      });
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

      await expect(
        service.assertInvestorCanAccessDocument(investorId, fundId, documentId),
      ).resolves.toBeUndefined();
    });

    it('throws when document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(
        service.assertInvestorCanAccessDocument(investorId, fundId, documentId),
      ).rejects.toThrow();
    });

    it('throws when document belongs to a different fund', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: documentId,
        fundId: 'other-fund',
        linkedEntityType: 'INVESTOR',
        linkedEntityId: investorId,
        deletedAt: null,
      });

      await expect(
        service.assertInvestorCanAccessDocument(investorId, fundId, documentId),
      ).rejects.toThrow();
    });

    it('throws when document is linked to a different investor with no matching subscription', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: documentId,
        fundId,
        linkedEntityType: 'INVESTOR',
        linkedEntityId: 'other-investor',
        deletedAt: null,
      });
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.assertInvestorCanAccessDocument(investorId, fundId, documentId),
      ).rejects.toThrow();
    });
  });
});
