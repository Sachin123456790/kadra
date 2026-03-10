import { AuditService } from '../audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError } from '../../../common/errors';

// Mock fs module
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const mockPrisma = () => ({
  fund: {
    findUnique: jest.fn(),
  },
  auditExport: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  investor: {
    findMany: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
  },
  documentHash: {
    findMany: jest.fn(),
  },
  transferRequest: {
    findMany: jest.fn(),
  },
  tokenPosition: {
    findMany: jest.fn(),
  },
  distributionRun: {
    findMany: jest.fn(),
  },
  systemEventLog: {
    findMany: jest.fn(),
  },
});

describe('AuditService', () => {
  let service: AuditService;
  let prisma: ReturnType<typeof mockPrisma>;

  const fundId = 'fund-1';
  const exportId = 'export-1';
  const mockFund = { id: fundId, name: 'Kadra Demo Fund I', status: 'ACTIVE' };

  beforeEach(() => {
    prisma = mockPrisma();
    const mockEventLog = {
      log: jest.fn().mockResolvedValue({}),
    } as unknown as EventLogService;
    service = new AuditService(
      prisma as unknown as PrismaService,
      mockEventLog,
    );
  });

  describe('requestExport', () => {
    it('creates export and builds artifacts', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.auditExport.create.mockResolvedValue({
        id: exportId,
        fundId,
        status: 'QUEUED',
      });
      prisma.auditExport.findUniqueOrThrow.mockResolvedValue({
        id: exportId,
        fundId,
        status: 'QUEUED',
      });
      prisma.auditExport.update.mockResolvedValue({
        id: exportId,
        status: 'READY',
      });

      // Mock data gathering calls
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.investor.findMany.mockResolvedValue([]);
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.document.findMany.mockResolvedValue([]);
      prisma.documentHash.findMany.mockResolvedValue([]);
      prisma.transferRequest.findMany.mockResolvedValue([]);
      prisma.tokenPosition.findMany.mockResolvedValue([]);
      prisma.distributionRun.findMany.mockResolvedValue([]);

      const result = await service.requestExport(fundId, {});

      expect(result.auditExportId).toBe(exportId);
      expect(result.status).toBe('READY');
      expect(prisma.auditExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fundId,
            exportType: 'AUDIT_PACKET',
            status: 'QUEUED',
          }),
        }),
      );
      // Verify buildExport set status to BUILDING then READY
      expect(prisma.auditExport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: exportId },
          data: expect.objectContaining({ status: 'BUILDING' }),
        }),
      );
      expect(prisma.auditExport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: exportId },
          data: expect.objectContaining({ status: 'READY' }),
        }),
      );
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(service.requestExport('nonexistent', {})).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getExportStatus', () => {
    it('returns correct status for READY export', async () => {
      const requestedAt = new Date('2025-01-01T00:00:00Z');
      const completedAt = new Date('2025-01-01T00:01:00Z');

      prisma.auditExport.findUnique.mockResolvedValue({
        id: exportId,
        status: 'READY',
        exportType: 'AUDIT_PACKET',
        artifactStorageProvider: 'LOCAL_FS',
        artifactPath: '/tmp/exports/export-1',
        checksumSha256: 'abc123',
        requestedAt,
        completedAt,
      });

      const result = await service.getExportStatus(exportId);

      expect(result.auditExportId).toBe(exportId);
      expect(result.status).toBe('READY');
      expect(result.exportType).toBe('AUDIT_PACKET');
      expect(result.artifact).toEqual({
        storageProvider: 'LOCAL_FS',
        path: '/tmp/exports/export-1',
        checksumSha256: 'abc123',
      });
      expect(result.requestedAt).toBe(requestedAt.toISOString());
      expect(result.completedAt).toBe(completedAt.toISOString());
    });

    it('returns null artifact for non-READY export', async () => {
      prisma.auditExport.findUnique.mockResolvedValue({
        id: exportId,
        status: 'BUILDING',
        exportType: 'AUDIT_PACKET',
        artifactStorageProvider: 'LOCAL_FS',
        artifactPath: null,
        checksumSha256: null,
        requestedAt: new Date('2025-01-01T00:00:00Z'),
        completedAt: null,
      });

      const result = await service.getExportStatus(exportId);

      expect(result.auditExportId).toBe(exportId);
      expect(result.status).toBe('BUILDING');
      expect(result.artifact).toBeNull();
      expect(result.completedAt).toBeNull();
    });

    it('throws NotFoundError for missing export', async () => {
      prisma.auditExport.findUnique.mockResolvedValue(null);

      await expect(service.getExportStatus('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getEventLog', () => {
    it('returns events in chronological order', async () => {
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-01-02T00:00:00Z');
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.systemEventLog.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          eventId: 'evt-1',
          eventType: 'DOCUMENT_UPLOADED',
          aggregateType: 'DOCUMENT',
          aggregateId: 'doc-1',
          payloadJson: { filename: 'lpa.pdf' },
          metadataJson: {},
          occurredAt: t1,
          txHash: null,
        },
        {
          id: BigInt(2),
          eventId: 'evt-2',
          eventType: 'SETTLEMENT_COMPLETED',
          aggregateType: 'SETTLEMENT',
          aggregateId: 'settle-1',
          payloadJson: {},
          metadataJson: {},
          occurredAt: t2,
          txHash: '0xabc',
        },
      ]);

      const result = await service.getEventLog(fundId, {
        limit: 100,
        offset: 0,
      });

      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('DOCUMENT_UPLOADED');
      expect(result[1].eventType).toBe('SETTLEMENT_COMPLETED');
      expect(prisma.systemEventLog.findMany).toHaveBeenCalledWith({
        where: { fundId },
        orderBy: { occurredAt: 'asc' },
        take: 100,
        skip: 0,
      });
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(
        service.getEventLog('nonexistent', { limit: 100, offset: 0 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getDocumentProvenance', () => {
    it('returns documents with hash info', async () => {
      prisma.fund.findUnique.mockResolvedValue(mockFund);
      prisma.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          originalFilename: 'lpa.pdf',
          documentType: 'MASTER_LPA',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          hashes: [
            {
              hashHex: 'a'.repeat(64),
              hashAlgorithm: 'SHA256',
              anchorTxHash: '0xdef',
              anchorBlockNumber: BigInt(100),
              anchorConfirmedAt: new Date('2026-01-01T01:00:00Z'),
            },
          ],
        },
        {
          id: 'doc-2',
          originalFilename: 'wire.pdf',
          documentType: 'WIRE_CONFIRMATION',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          hashes: [],
        },
      ]);

      const result = await service.getDocumentProvenance(fundId);

      expect(result).toHaveLength(2);
      expect(result[0].hash).toBe('a'.repeat(64));
      expect(result[0].anchorTxHash).toBe('0xdef');
      expect(result[0].anchorBlockNumber).toBe(100);
      expect(result[1].hash).toBeNull();
      expect(result[1].anchorTxHash).toBeNull();
    });

    it('throws NotFoundError for missing fund', async () => {
      prisma.fund.findUnique.mockResolvedValue(null);

      await expect(
        service.getDocumentProvenance('nonexistent'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
