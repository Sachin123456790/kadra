import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from '../documents.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_ADAPTER } from '../../../adapters/storage/storage.adapter';
import { HASH_PROVIDER } from '../../../adapters/hash/hash.provider';
import { PARSER_ADAPTER } from '../../../adapters/parser/parser.adapter';
import { DOCUMENT_REGISTRY_ADAPTER } from '../../../adapters/blockchain/viem-document-registry.adapter';
import { FUND_TERMS_REGISTRY_ADAPTER } from '../../../adapters/blockchain/viem-fund-terms-registry.adapter';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError, ValidationError } from '../../../common/errors';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockFund = { id: 'fund-1', name: 'Test Fund' };
  const mockDocId = 'doc-123';
  const mockHashHex = 'a'.repeat(64);

  const mockPrisma = {
    fund: {
      findUnique: jest.fn(),
    },
    document: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    documentHash: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    extractedDocumentField: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStorage = {
    save: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
    exists: jest.fn().mockResolvedValue(true),
  };

  const mockHashProvider = {
    hash: jest.fn().mockReturnValue(mockHashHex),
  };

  const mockDocumentRegistry = {
    registerDocument: jest.fn().mockResolvedValue({
      txHash: '0x' + 'ab'.repeat(32),
      blockNumber: 100,
    }),
    documentExists: jest.fn().mockResolvedValue(false),
  };

  const mockFundTermsRegistry = {
    writeExtractedFields: jest.fn().mockResolvedValue({
      txHashes: ['0x' + 'cd'.repeat(32)],
      fieldsWritten: 3,
    }),
    setStringTerm: jest
      .fn()
      .mockResolvedValue({ txHash: '0x' + 'cd'.repeat(32) }),
    setUintTerm: jest
      .fn()
      .mockResolvedValue({ txHash: '0x' + 'cd'.repeat(32) }),
  };

  const mockParser = {
    parse: jest.fn().mockResolvedValue([
      {
        fieldName: 'fund_name',
        fieldValueText: 'Kadra Demo Fund I',
        confidence: 0.98,
        sourcePage: 1,
      },
      {
        fieldName: 'total_commitment',
        fieldValueNumeric: 5000000,
        confidence: 0.92,
        sourcePage: 2,
      },
      {
        fieldName: 'preferred_return',
        fieldValueNumeric: 8,
        confidence: 0.85,
        sourcePage: 4,
      },
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STORAGE_ADAPTER, useValue: mockStorage },
        { provide: HASH_PROVIDER, useValue: mockHashProvider },
        { provide: PARSER_ADAPTER, useValue: mockParser },
        { provide: DOCUMENT_REGISTRY_ADAPTER, useValue: mockDocumentRegistry },
        {
          provide: FUND_TERMS_REGISTRY_ADAPTER,
          useValue: mockFundTermsRegistry,
        },
        {
          provide: EventLogService,
          useValue: { log: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('uploadMasterLpa', () => {
    const pdfBuffer = Buffer.from('fake-pdf-content');

    it('should upload a valid PDF and return completed status', async () => {
      mockPrisma.fund.findUnique.mockResolvedValue(mockFund);

      const createdDoc = {
        id: mockDocId,
        fundId: 'fund-1',
        documentType: 'MASTER_LPA',
        storageKey: 'funds/fund-1/lpa/test.pdf',
        parseStatus: 'QUEUED',
      };

      // $transaction for document + hash creation
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            document: {
              create: jest.fn().mockResolvedValue(createdDoc),
              update: jest
                .fn()
                .mockResolvedValue({ ...createdDoc, parseStatus: 'COMPLETED' }),
            },
            documentHash: {
              create: jest.fn().mockResolvedValue({ id: 'hash-1' }),
            },
            extractedDocumentField: {
              create: jest.fn().mockResolvedValue({}),
            },
          });
        }
        return fn;
      });

      // For the parseDocument call
      mockPrisma.document.update.mockResolvedValue({
        ...createdDoc,
        parseStatus: 'PROCESSING',
      });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue(createdDoc);

      const result = await service.uploadMasterLpa(
        'fund-1',
        pdfBuffer,
        'test.pdf',
        'application/pdf',
        'admin',
      );

      expect(result.documentId).toBe(mockDocId);
      expect(result.parseStatus).toBe('COMPLETED');
      expect(result.hashStatus).toBe('PENDING');
      expect(mockStorage.save).toHaveBeenCalledTimes(1);
      expect(mockHashProvider.hash).toHaveBeenCalledWith(pdfBuffer);
      expect(mockPrisma.fund.findUnique).toHaveBeenCalledWith({
        where: { id: 'fund-1' },
      });
    });

    it('should reject non-PDF mime types', async () => {
      await expect(
        service.uploadMasterLpa(
          'fund-1',
          pdfBuffer,
          'doc.docx',
          'application/msword',
          'admin',
        ),
      ).rejects.toThrow(ValidationError);

      expect(mockPrisma.fund.findUnique).not.toHaveBeenCalled();
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent fund', async () => {
      mockPrisma.fund.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadMasterLpa(
          'nonexistent',
          pdfBuffer,
          'test.pdf',
          'application/pdf',
          'admin',
        ),
      ).rejects.toThrow(NotFoundError);

      expect(mockStorage.save).not.toHaveBeenCalled();
    });
  });

  describe('getParseStatus', () => {
    it('should return parse status with extraction summary', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: mockDocId,
        parseStatus: 'COMPLETED',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        extractedFields: [
          { fieldName: 'fund_name', confidence: 0.98 },
          { fieldName: 'total_commitment', confidence: 0.92 },
          { fieldName: 'preferred_return', confidence: 0.85 },
        ],
        hashes: [{ anchoredOnchain: true }],
      });

      const result = await service.getParseStatus(mockDocId);

      expect(result.documentId).toBe(mockDocId);
      expect(result.parseStatus).toBe('COMPLETED');
      expect(result.hashStatus).toBe('ANCHORED');
      expect(result.extractionSummary.fieldsExtracted).toBe(3);
      expect(result.extractionSummary.lowConfidenceFields).toBe(1); // 0.85 < 0.9
    });

    it('should throw NotFoundError for non-existent document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(service.getParseStatus('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getHashes', () => {
    it('should return hashes for a document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: mockDocId });
      mockPrisma.documentHash.findMany.mockResolvedValue([
        {
          id: 'hash-1',
          documentId: mockDocId,
          hashAlgorithm: 'SHA256',
          hashHex: mockHashHex,
          isPrimary: true,
          anchoredOnchain: false,
          anchorChainId: null,
          anchorTxHash: null,
          anchorBlockNumber: null,
        },
      ]);

      const result = await service.getHashes(mockDocId);

      expect(result).toHaveLength(1);
      expect(result[0].hashId).toBe('hash-1');
      expect(result[0].algorithm).toBe('SHA256');
      expect(result[0].hashHex).toBe(mockHashHex);
      expect(result[0].anchoredOnchain).toBe(false);
      expect(result[0].anchor).toBeNull();
    });

    it('should return anchor info when hash is anchored on-chain', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: mockDocId });
      mockPrisma.documentHash.findMany.mockResolvedValue([
        {
          id: 'hash-2',
          documentId: mockDocId,
          hashAlgorithm: 'SHA256',
          hashHex: mockHashHex,
          isPrimary: true,
          anchoredOnchain: true,
          anchorChainId: 11155111,
          anchorTxHash: '0xabc123',
          anchorBlockNumber: BigInt(12345),
        },
      ]);

      const result = await service.getHashes(mockDocId);

      expect(result[0].anchoredOnchain).toBe(true);
      expect(result[0].anchor).toEqual({
        chainId: 11155111,
        txHash: '0xabc123',
        blockNumber: 12345,
      });
    });

    it('should throw NotFoundError for non-existent document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(service.getHashes('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
