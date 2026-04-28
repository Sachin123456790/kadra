import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DocumentStorageAdapter } from '../../adapters/storage/storage.adapter';
import { STORAGE_ADAPTER } from '../../adapters/storage/storage.adapter';
import type { HashProvider } from '../../adapters/hash/hash.provider';
import { HASH_PROVIDER } from '../../adapters/hash/hash.provider';
import type { DocumentParserAdapter } from '../../adapters/parser/parser.adapter';
import { PARSER_ADAPTER } from '../../adapters/parser/parser.adapter';
import { NotFoundError, ValidationError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';
import { randomUUID } from 'crypto';
import { AddManualExtractedFieldsDto } from './documents.dto';
import type { DocumentRegistryAdapter } from '../../adapters/blockchain/viem-document-registry.adapter';
import { DOCUMENT_REGISTRY_ADAPTER } from '../../adapters/blockchain/viem-document-registry.adapter';
import type { FundTermsRegistryAdapter } from '../../adapters/blockchain/viem-fund-terms-registry.adapter';
import { FUND_TERMS_REGISTRY_ADAPTER } from '../../adapters/blockchain/viem-fund-terms-registry.adapter';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: DocumentStorageAdapter,
    @Inject(HASH_PROVIDER) private readonly hashProvider: HashProvider,
    @Inject(PARSER_ADAPTER) private readonly parser: DocumentParserAdapter,
    @Inject(DOCUMENT_REGISTRY_ADAPTER)
    private readonly documentRegistry: DocumentRegistryAdapter,
    @Inject(FUND_TERMS_REGISTRY_ADAPTER)
    private readonly fundTermsRegistry: FundTermsRegistryAdapter,
    private readonly eventLog: EventLogService,
  ) {}

  async uploadMasterLpa(
    fundId: string,
    file: Buffer,
    filename: string,
    mimeType: string,
    uploadedBy?: string,
  ) {
    if (mimeType !== 'application/pdf') {
      throw new ValidationError(
        'Invalid file type. Only PDF files are accepted.',
        { field: 'file', issue: 'invalid_mime_type' },
      );
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
          storageProvider: process.env.SUPABASE_URL ? 'SUPABASE' : 'LOCAL_FS',
          storageKey,
          originalFilename: filename,
          mimeType,
          byteSize: BigInt(file.length),
          uploadedBy,
          parseStatus: 'QUEUED',
          metadata: {},
        },
      });

      await tx.documentHash.upsert({
        where: {
          hashAlgorithm_hashHex: {
            hashAlgorithm: 'SHA256',
            hashHex,
          },
        },
        update: { documentId: doc.id },
        create: {
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

    await this.eventLog.log({
      eventType: 'DOCUMENT_UPLOADED',
      aggregateType: 'DOCUMENT',
      aggregateId: document.id,
      fundId,
      payload: {
        filename,
        mimeType,
        hashHex,
        documentType: 'MASTER_LPA',
        uploadedBy,
      },
    });

    return {
      documentId: document.id,
      parseStatus: 'COMPLETED',
      hashStatus: 'PENDING',
    };
  }

  /**
   * Generic document upload used for investor uploads and GP reports.
   * Stores file, hashes it, creates Document + DocumentHash rows.
   * No on-chain anchoring.
   */
  async uploadGenericDocument(params: {
    fundId: string;
    documentType: string;
    storageKeyPrefix: string;
    file: Buffer;
    filename: string;
    mimeType: string;
    uploadedBy?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const fund = await this.prisma.fund.findUnique({
      where: { id: params.fundId },
    });
    if (!fund) throw new NotFoundError('Fund', params.fundId);

    const storageKey = `${params.storageKeyPrefix}/${randomUUID()}-${params.filename}`;
    await this.storage.save(storageKey, params.file, params.mimeType);
    const hashHex = this.hashProvider.hash(params.file);

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          fundId: params.fundId,
          documentType: params.documentType,
          storageProvider: process.env.SUPABASE_URL ? 'SUPABASE' : 'LOCAL_FS',
          storageKey,
          originalFilename: params.filename,
          mimeType: params.mimeType,
          byteSize: BigInt(params.file.length),
          uploadedBy: params.uploadedBy,
          parseStatus: 'COMPLETED',
          linkedEntityType: params.linkedEntityType ?? null,
          linkedEntityId: params.linkedEntityId ?? null,
          metadata: { hashHex, ...(params.metadata ?? {}) },
        },
      });

      const existingHash = await tx.documentHash.findUnique({
        where: {
          hashAlgorithm_hashHex: { hashAlgorithm: 'SHA256', hashHex },
        },
      });
      if (!existingHash) {
        await tx.documentHash.create({
          data: {
            documentId: doc.id,
            hashAlgorithm: 'SHA256',
            hashHex,
            isPrimary: true,
          },
        });
      }

      return doc;
    });

    await this.eventLog.log({
      eventType: 'DOCUMENT_UPLOADED',
      aggregateType: 'DOCUMENT',
      aggregateId: document.id,
      fundId: params.fundId,
      payload: {
        filename: params.filename,
        mimeType: params.mimeType,
        hashHex,
        documentType: params.documentType,
        uploadedBy: params.uploadedBy,
      },
    });

    return {
      documentId: document.id,
      fileName: document.originalFilename,
      byteSize: Number(document.byteSize),
      uploadedAt: document.createdAt.toISOString(),
    };
  }

  async uploadWireConfirmation(
    fundId: string,
    investorId: string,
    file: Buffer,
    filename: string,
    mimeType: string,
    uploadedBy?: string,
  ) {
    if (mimeType !== 'application/pdf') {
      throw new ValidationError(
        'Invalid file type. Only PDF files are accepted.',
        { field: 'file', issue: 'invalid_mime_type' },
      );
    }

    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const investor = await this.prisma.investor.findUnique({
      where: { id: investorId },
    });
    if (!investor) throw new NotFoundError('Investor', investorId);

    const storageKey = `funds/${fundId}/wires/${randomUUID()}-${filename}`;
    await this.storage.save(storageKey, file, mimeType);

    const hashHex = this.hashProvider.hash(file);

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          fundId,
          documentType: 'WIRE_CONFIRMATION',
          storageProvider: process.env.SUPABASE_URL ? 'SUPABASE' : 'LOCAL_FS',
          storageKey,
          originalFilename: filename,
          mimeType,
          byteSize: BigInt(file.length),
          uploadedBy,
          parseStatus: 'COMPLETED',
          linkedEntityType: 'INVESTOR',
          linkedEntityId: investorId,
          metadata: { hashHex, investorId },
        },
      });

      // Check if hash already exists (same file uploaded as another doc)
      const existingHash = await tx.documentHash.findUnique({
        where: {
          hashAlgorithm_hashHex: {
            hashAlgorithm: 'SHA256',
            hashHex,
          },
        },
      });

      if (!existingHash) {
        await tx.documentHash.create({
          data: {
            documentId: doc.id,
            hashAlgorithm: 'SHA256',
            hashHex,
            isPrimary: true,
          },
        });
      }

      return doc;
    });

    // Anchor wire confirmation hash on-chain (non-blocking)
    this.anchorOnChain(document.id, hashHex, 'WIRE_CONFIRMATION').catch(
      () => {},
    );

    await this.eventLog.log({
      eventType: 'DOCUMENT_UPLOADED',
      aggregateType: 'DOCUMENT',
      aggregateId: document.id,
      fundId,
      payload: {
        filename,
        mimeType,
        hashHex,
        documentType: 'WIRE_CONFIRMATION',
        investorId,
        uploadedBy,
      },
    });

    return {
      documentId: document.id,
      hashHex,
    };
  }

  private async anchorOnChain(
    documentId: string,
    hashHex: string,
    docType: string = 'MASTER_LPA',
  ): Promise<void> {
    try {
      const docHash = `0x${hashHex}` as `0x${string}`;
      const result = await this.documentRegistry.registerDocument(
        docHash,
        docType,
      );

      const documentHash = await this.prisma.documentHash.findFirst({
        where: { documentId, isPrimary: true },
      });
      if (documentHash) {
        await this.prisma.documentHash.update({
          where: { id: documentHash.id },
          data: {
            anchoredOnchain: true,
            anchorTxHash: result.txHash,
            anchorBlockNumber: BigInt(result.blockNumber),
            anchorChainId: 11155111,
            anchorConfirmedAt: new Date(),
          },
        });
      }
    } catch (e) {
      // Non-fatal: anchoring failure should not block document upload
      console.warn('On-chain anchoring failed:', e);
    }
  }

  private async parseDocument(documentId: string) {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { parseStatus: 'PROCESSING' },
    });

    try {
      const doc = await this.prisma.document.findUniqueOrThrow({
        where: { id: documentId },
      });
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
              fieldValueNumeric:
                field.fieldValueNumeric != null
                  ? field.fieldValueNumeric
                  : undefined,
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

  async retryPendingAnchors(): Promise<{
    processed: number;
    anchored: number;
    failed: string[];
  }> {
    // Find all unanchored primary hashes
    const pendingHashes = await this.prisma.documentHash.findMany({
      where: { isPrimary: true, anchoredOnchain: false },
      include: { document: { select: { id: true, documentType: true } } },
    });

    let anchored = 0;
    const failed: string[] = [];

    for (const hash of pendingHashes) {
      try {
        const docHash = `0x${hash.hashHex}` as `0x${string}`;
        const result = await this.documentRegistry.registerDocument(
          docHash,
          hash.document.documentType,
        );

        await this.prisma.documentHash.update({
          where: { id: hash.id },
          data: {
            anchoredOnchain: true,
            anchorTxHash: result.txHash,
            anchorBlockNumber: BigInt(result.blockNumber),
            anchorChainId: 11155111,
            anchorConfirmedAt: new Date(),
          },
        });
        anchored++;
      } catch (e) {
        console.warn(`Anchoring failed for hash ${hash.id}:`, e);
        failed.push(hash.id);
      }
    }

    // Fix documents without hash records (e.g. wire confirmations sharing
    // the same SHA-256 as another doc). Store hashHex in metadata so
    // listDocumentsForFund can resolve the shared hash.
    const docsWithoutHash = await this.prisma.document.findMany({
      where: {
        hashes: { none: {} },
        deletedAt: null,
      },
      select: {
        id: true,
        storageKey: true,
        documentType: true,
        metadata: true,
      },
    });

    for (const doc of docsWithoutHash) {
      try {
        const meta = doc.metadata as Record<string, unknown> | null;
        if (meta?.hashHex) continue; // already has hashHex in metadata

        const fileData = await this.storage.read(doc.storageKey);
        const hashHex = this.hashProvider.hash(fileData);

        // Store hashHex in metadata for resolution
        await this.prisma.document.update({
          where: { id: doc.id },
          data: {
            metadata: { ...(meta ?? {}), hashHex },
          },
        });

        // Ensure the shared hash is anchored
        const existingHash = await this.prisma.documentHash.findFirst({
          where: { hashAlgorithm: 'SHA256', hashHex },
        });
        if (existingHash && !existingHash.anchoredOnchain) {
          await this.anchorOnChain(
            existingHash.documentId,
            hashHex,
            doc.documentType,
          );
          anchored++;
        }
      } catch (e) {
        console.warn(`Hash fix failed for doc ${doc.id}:`, e);
        failed.push(doc.id);
      }
    }

    return {
      processed: pendingHashes.length + docsWithoutHash.length,
      anchored,
      failed,
    };
  }

  async verifyDocument(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    const primaryHash = await this.prisma.documentHash.findFirst({
      where: { documentId, isPrimary: true },
    });

    if (!primaryHash) {
      return { verified: false, reason: 'NO_HASH_FOUND', documentId };
    }

    const verified = primaryHash.anchoredOnchain === true;

    return {
      verified,
      documentId,
      hashAlgorithm: primaryHash.hashAlgorithm,
      storedHash: primaryHash.hashHex,
      anchorTxHash: primaryHash.anchorTxHash,
      anchorBlockNumber: primaryHash.anchorBlockNumber
        ? Number(primaryHash.anchorBlockNumber)
        : null,
      anchoredAt: primaryHash.anchorConfirmedAt?.toISOString() ?? null,
    };
  }

  /**
   * Read document content (raw bytes) for viewing/downloading.
   * Returns buffer + metadata. Callers are responsible for access control.
   */
  async getDocumentContent(documentId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
    fundId: string;
    linkedEntityType: string | null;
    linkedEntityId: string | null;
  }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        originalFilename: true,
        fundId: true,
        linkedEntityType: true,
        linkedEntityId: true,
        deletedAt: true,
      },
    });
    if (!doc || doc.deletedAt) {
      throw new NotFoundError('Document', documentId);
    }
    const buffer = await this.storage.read(doc.storageKey);
    return {
      buffer,
      mimeType: doc.mimeType,
      filename: doc.originalFilename,
      fundId: doc.fundId,
      linkedEntityType: doc.linkedEntityType,
      linkedEntityId: doc.linkedEntityId,
    };
  }

  async getParseStatus(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extractedFields: true,
        hashes: { where: { isPrimary: true } },
      },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    let primaryHash: { anchoredOnchain: boolean } | null =
      doc.hashes[0] ?? null;
    // Fall back to looking up shared hash via metadata
    if (!primaryHash) {
      const meta = doc.metadata as Record<string, unknown> | null;
      const hex = meta?.hashHex as string | undefined;
      if (hex) {
        primaryHash = await this.prisma.documentHash.findFirst({
          where: { hashAlgorithm: 'SHA256', hashHex: hex },
        });
      }
    }
    const hashStatus = primaryHash?.anchoredOnchain ? 'ANCHORED' : 'PENDING';

    return {
      documentId: doc.id,
      parseStatus: doc.parseStatus,
      hashStatus,
      extractionSummary: {
        fieldsExtracted: doc.extractedFields.length,
      },
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async getHashes(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    let hashes = await this.prisma.documentHash.findMany({
      where: { documentId },
    });

    // Fall back to shared hash via metadata (for docs sharing the same file content)
    if (hashes.length === 0) {
      const meta = doc.metadata as Record<string, unknown> | null;
      const hex = meta?.hashHex as string | undefined;
      if (hex) {
        const shared = await this.prisma.documentHash.findMany({
          where: { hashAlgorithm: 'SHA256', hashHex: hex },
        });
        hashes = shared;
      }
    }

    return hashes.map((h) => ({
      hashId: h.id,
      algorithm: h.hashAlgorithm,
      hashHex: h.hashHex,
      anchoredOnchain: h.anchoredOnchain,
      anchor: h.anchorTxHash
        ? {
            chainId: h.anchorChainId,
            txHash: h.anchorTxHash,
            blockNumber: h.anchorBlockNumber
              ? Number(h.anchorBlockNumber)
              : null,
          }
        : null,
    }));
  }

  async listDocumentsForFund(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const documents = await this.prisma.document.findMany({
      where: { fundId, deletedAt: null },
      include: {
        hashes: { where: { isPrimary: true } },
        _count: { select: { extractedFields: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // For documents without a direct hash relation (e.g. wire confirmations
    // sharing the same file hash as another doc), look up by hashHex in metadata
    const hashHexesNeeded = documents
      .filter((doc) => doc.hashes.length === 0)
      .map((doc) => {
        const meta = doc.metadata as Record<string, unknown> | null;
        return meta?.hashHex as string | undefined;
      })
      .filter((h): h is string => !!h);

    const sharedHashes =
      hashHexesNeeded.length > 0
        ? await this.prisma.documentHash.findMany({
            where: {
              hashHex: { in: hashHexesNeeded },
              hashAlgorithm: 'SHA256',
            },
          })
        : [];
    const sharedHashMap = new Map(sharedHashes.map((h) => [h.hashHex, h]));

    return documents.map((doc) => {
      let hashInfo: {
        hashHex: string;
        hashAlgorithm: string;
        anchoredOnchain: boolean;
      } | null = doc.hashes[0] ?? null;
      if (!hashInfo) {
        const meta = doc.metadata as Record<string, unknown> | null;
        const hex = meta?.hashHex as string | undefined;
        if (hex) hashInfo = sharedHashMap.get(hex) ?? null;
      }

      return {
        documentId: doc.id,
        documentType: doc.documentType,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        byteSize: Number(doc.byteSize),
        parseStatus: doc.parseStatus,
        uploadedBy: doc.uploadedBy,
        linkedEntityType: doc.linkedEntityType,
        linkedEntityId: doc.linkedEntityId,
        hash: hashInfo
          ? {
              hashHex: hashInfo.hashHex,
              algorithm: hashInfo.hashAlgorithm,
              anchoredOnchain: hashInfo.anchoredOnchain,
            }
          : null,
        extractedFieldCount: doc._count.extractedFields,
        metadata: doc.metadata,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    });
  }

  async getExtractedFields(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    const fields = await this.prisma.extractedDocumentField.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
    });

    return fields.map((f) => ({
      fieldId: f.id,
      fieldName: f.fieldName,
      fieldValueText: f.fieldValueText,
      fieldValueNumeric:
        f.fieldValueNumeric != null ? Number(f.fieldValueNumeric) : null,
      fieldValueJson: f.fieldValueJson,
      sourcePage: f.sourcePage,
      extractionRunRef: f.extractionRunRef,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async approveDocument(
    documentId: string,
    options?: {
      notes?: string;
      fieldUpdates?: Array<{
        fieldId: string;
        fieldValueText?: string;
        fieldValueNumeric?: number;
      }>;
    },
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    if (doc.parseStatus !== 'COMPLETED') {
      throw new ValidationError(
        `Document parse status must be COMPLETED to approve, current status: ${doc.parseStatus}`,
        { field: 'parseStatus', issue: 'invalid_status' },
      );
    }

    // Apply field updates if provided
    if (options?.fieldUpdates && options.fieldUpdates.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const update of options.fieldUpdates!) {
          await tx.extractedDocumentField.update({
            where: { id: update.fieldId },
            data: {
              ...(update.fieldValueText !== undefined
                ? { fieldValueText: update.fieldValueText }
                : {}),
              ...(update.fieldValueNumeric !== undefined
                ? { fieldValueNumeric: update.fieldValueNumeric }
                : {}),
            },
          });
        }
      });
    }

    const existingMeta =
      typeof doc.metadata === 'object' && doc.metadata !== null
        ? doc.metadata
        : {};

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        metadata: {
          ...existingMeta,
          approved: true,
          approvedAt: new Date().toISOString(),
          ...(options?.notes ? { notes: options.notes } : {}),
        },
      },
    });

    // Anchor document hash on-chain now that admin has approved
    const primaryHash = await this.prisma.documentHash.findFirst({
      where: { documentId, isPrimary: true },
    });
    if (primaryHash) {
      await this.anchorOnChain(documentId, primaryHash.hashHex);

      // Write extracted fields on-chain via FundTermsRegistry
      const fields = await this.prisma.extractedDocumentField.findMany({
        where: { documentId },
      });
      if (fields.length > 0) {
        const docHash = `0x${primaryHash.hashHex}` as `0x${string}`;
        this.fundTermsRegistry
          .writeExtractedFields(
            doc.fundId,
            fields.map((f) => ({
              fieldName: f.fieldName,
              fieldValueText: f.fieldValueText,
              fieldValueNumeric:
                f.fieldValueNumeric != null
                  ? Number(f.fieldValueNumeric)
                  : null,
            })),
            docHash,
          )
          .catch((e) =>
            console.warn('Writing extracted fields on-chain failed:', e),
          );
      }
    }

    await this.eventLog.log({
      eventType: 'DOCUMENT_APPROVED',
      aggregateType: 'DOCUMENT',
      aggregateId: documentId,
      fundId: doc.fundId,
      payload: { documentType: doc.documentType },
    });

    return updated;
  }

  async updateExtractedFields(
    documentId: string,
    fieldUpdates: Array<{
      fieldId: string;
      fieldValueText?: string;
      fieldValueNumeric?: number;
    }>,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundError('Document', documentId);

    const meta = doc.metadata as Record<string, unknown> | null;
    if (meta?.approved) {
      throw new ValidationError('Cannot edit fields of an approved document', {
        field: 'metadata.approved',
        issue: 'already_approved',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const update of fieldUpdates) {
        await tx.extractedDocumentField.update({
          where: { id: update.fieldId },
          data: {
            ...(update.fieldValueText !== undefined
              ? { fieldValueText: update.fieldValueText }
              : {}),
            ...(update.fieldValueNumeric !== undefined
              ? { fieldValueNumeric: update.fieldValueNumeric }
              : {}),
          },
        });
      }
    });

    return { documentId, fieldsUpdated: fieldUpdates.length };
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
