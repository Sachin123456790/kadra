import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DocumentStorageAdapter } from '../../adapters/storage/storage.adapter';
import { STORAGE_ADAPTER } from '../../adapters/storage/storage.adapter';
import type { HashProvider } from '../../adapters/hash/hash.provider';
import { HASH_PROVIDER } from '../../adapters/hash/hash.provider';
import type { DocumentParserAdapter } from '../../adapters/parser/parser.adapter';
import { PARSER_ADAPTER } from '../../adapters/parser/parser.adapter';
import { NotFoundError, ValidationError } from '../../common/errors';
import { randomUUID } from 'crypto';
import { AddManualExtractedFieldsDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: DocumentStorageAdapter,
    @Inject(HASH_PROVIDER) private readonly hashProvider: HashProvider,
    @Inject(PARSER_ADAPTER) private readonly parser: DocumentParserAdapter,
  ) {}

  async uploadMasterLpa(fundId: string, file: Buffer, filename: string, mimeType: string, uploadedBy?: string) {
    if (mimeType !== 'application/pdf') {
      throw new ValidationError('Invalid file type. Only PDF files are accepted.', { field: 'file', issue: 'invalid_mime_type' });
    }

    // Verify fund exists
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const storageKey = `funds/${fundId}/lpa/${randomUUID()}-${filename}`;
    await this.storage.save(storageKey, file, mimeType);

    // Compute hash
    const hashHex = this.hashProvider.hash(file);

    // Create document + hash in transaction
    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          fundId,
          documentType: 'MASTER_LPA',
          storageProvider: 'LOCAL_FS',
          storageKey,
          originalFilename: filename,
          mimeType,
          byteSize: BigInt(file.length),
          uploadedBy,
          parseStatus: 'QUEUED',
          metadata: {},
        },
      });

      await tx.documentHash.create({
        data: {
          documentId: doc.id,
          hashAlgorithm: 'SHA256',
          hashHex,
          isPrimary: true,
        },
      });

      return doc;
    });

    // Run parse synchronously for MVP (small files)
    await this.parseDocument(document.id);

    return {
      documentId: document.id,
      parseStatus: 'COMPLETED',
      hashStatus: 'COMPLETED',
    };
  }

  private async parseDocument(documentId: string) {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { parseStatus: 'PROCESSING' },
    });

    try {
      const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } });
      const fileData = await this.storage.read(doc.storageKey);
      const fields = await this.parser.parse(fileData, doc.documentType);
      const runRef = `parse-${randomUUID()}`;

      await this.prisma.$transaction(async (tx) => {
        for (const field of fields) {
          await tx.extractedDocumentField.create({
            data: {
              documentId,
              extractionRunRef: runRef,
              fieldName: field.fieldName,
              fieldValueText: field.fieldValueText,
              fieldValueNumeric: field.fieldValueNumeric != null ? field.fieldValueNumeric : undefined,
              confidence: field.confidence,
              sourcePage: field.sourcePage,
            },
          });
        }

        await tx.document.update({
          where: { id: documentId },
          data: { parseStatus: 'COMPLETED' },
        });
      });
    } catch (error) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { parseStatus: 'FAILED' },
      });
      throw error;
    }
  }

  async getParseStatus(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { extractedFields: true },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    const lowConfidenceCount = doc.extractedFields.filter(
      (f) => f.confidence != null && Number(f.confidence) < 0.9,
    ).length;

    return {
      documentId: doc.id,
      parseStatus: doc.parseStatus,
      hashStatus: 'COMPLETED',
      extractionSummary: {
        fieldsExtracted: doc.extractedFields.length,
        lowConfidenceFields: lowConfidenceCount,
      },
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async getHashes(documentId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundError('Document', documentId);

    const hashes = await this.prisma.documentHash.findMany({
      where: { documentId },
    });

    return hashes.map((h) => ({
      hashId: h.id,
      algorithm: h.hashAlgorithm,
      hashHex: h.hashHex,
      anchoredOnchain: h.anchoredOnchain,
      anchor: h.anchorTxHash
        ? { chainId: h.anchorChainId, txHash: h.anchorTxHash, blockNumber: h.anchorBlockNumber ? Number(h.anchorBlockNumber) : null }
        : null,
    }));
  }

  async addManualExtractedFields(
    documentId: string,
    input: AddManualExtractedFieldsDto,
    addedBy?: string,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    if (!input.fields || input.fields.length === 0) {
      throw new ValidationError('At least one field is required');
    }

    const runRef = `manual-${randomUUID()}`;
    const created = await this.prisma.$transaction(async (tx) => {
      const rows: string[] = [];
      for (const field of input.fields) {
        if (!field.fieldName?.trim()) continue;
        const row = await tx.extractedDocumentField.create({
          data: {
            documentId,
            extractionRunRef: runRef,
            fieldName: field.fieldName.trim(),
            fieldValueText: field.fieldValueText?.trim(),
            fieldValueNumeric: field.fieldValueNumeric,
            confidence:
              field.confidence != null
                ? Math.max(0, Math.min(1, field.confidence))
                : 1,
            sourcePage:
              field.sourcePage != null ? Math.floor(field.sourcePage) : null,
            fieldValueJson: addedBy
              ? { source: 'MANUAL_OVERRIDE', addedBy }
              : { source: 'MANUAL_OVERRIDE' },
          },
        });
        rows.push(row.id);
      }

      await tx.document.update({
        where: { id: documentId },
        data: { parseStatus: 'COMPLETED' },
      });

      return rows;
    });

    return {
      documentId,
      extractionRunRef: runRef,
      fieldsAdded: created.length,
    };
  }
}
