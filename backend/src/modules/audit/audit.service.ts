import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';
import { createHash } from 'crypto';
import { renderGpAdminExportPdf } from './gp-admin-export-renderer';
import { buildGpAdminExportInput } from './gp-admin-export-builder';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async getEventLog(
    fundId: string,
    options: { limit: number; offset: number },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const events = await this.prisma.systemEventLog.findMany({
      where: { fundId },
      orderBy: { occurredAt: 'asc' },
      take: options.limit,
      skip: options.offset,
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
      metadata: e.metadataJson,
    }));
  }

  async getDocumentProvenance(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const documents = await this.prisma.document.findMany({
      where: { fundId, deletedAt: null },
      include: { hashes: { where: { isPrimary: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return documents.map((d) => {
      const hash = d.hashes[0] ?? null;
      return {
        id: d.id,
        originalName: d.originalFilename,
        type: d.documentType,
        createdAt: d.createdAt.toISOString(),
        hash: hash?.hashHex ?? null,
        hashAlgorithm: hash?.hashAlgorithm ?? null,
        anchorTxHash: hash?.anchorTxHash ?? null,
        anchorBlockNumber: hash?.anchorBlockNumber
          ? Number(hash.anchorBlockNumber)
          : null,
        anchorConfirmedAt: hash?.anchorConfirmedAt?.toISOString() ?? null,
      };
    });
  }

  async requestExport(
    fundId: string,
    input: {
      exportType?: string;
      asOfTimestamp?: string;
      includeDocuments?: boolean;
      includeDistributionRuns?: boolean;
    },
  ) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund', fundId);

    const auditExport = await this.prisma.auditExport.create({
      data: {
        fundId,
        exportType: input.exportType || 'AUDIT_PACKET',
        status: 'QUEUED',
        requestedAt: new Date(),
        artifactStorageProvider: 'LOCAL_FS',
        manifestJson: {
          exportType: input.exportType || 'AUDIT_PACKET',
          asOfTimestamp: input.asOfTimestamp || new Date().toISOString(),
          includeDocuments: input.includeDocuments ?? true,
          includeDistributionRuns: input.includeDistributionRuns ?? true,
        },
      },
    });

    // Build export inline for MVP
    await this.buildExport(auditExport.id);

    await this.eventLog.log({
      eventType: 'AUDIT_EXPORT_COMPLETED',
      aggregateType: 'AUDIT_EXPORT',
      aggregateId: auditExport.id,
      fundId,
      payload: { exportType: input.exportType || 'AUDIT_PACKET' },
    });

    return {
      auditExportId: auditExport.id,
      status: 'READY',
    };
  }

  private async buildExport(exportId: string) {
    const auditExport = await this.prisma.auditExport.findUniqueOrThrow({
      where: { id: exportId },
    });

    await this.prisma.auditExport.update({
      where: { id: exportId },
      data: { status: 'BUILDING', startedAt: new Date() },
    });

    try {
      const fundId = auditExport.fundId;

      // Gather data
      const [
        fund,
        investors,
        subscriptions,
        documents,
        documentHashes,
        transfers,
        positions,
        distributionRuns,
      ] = await Promise.all([
        this.prisma.fund.findUnique({ where: { id: fundId } }),
        this.prisma.investor.findMany({
          where: {
            eligibilities: { some: { fundId, deletedAt: null } },
          },
          include: {
            wallets: true,
            eligibilities: { where: { fundId } },
          },
        }),
        this.prisma.subscription.findMany({
          where: { fundId, deletedAt: null },
        }),
        this.prisma.document.findMany({
          where: { fundId, deletedAt: null },
        }),
        this.prisma.documentHash.findMany({
          where: { document: { fundId } },
        }),
        this.prisma.transferRequest.findMany({
          where: { fundId, deletedAt: null },
        }),
        this.prisma.tokenPosition.findMany({
          where: { fundId },
          include: { wallet: { include: { investor: true } } },
        }),
        this.prisma.distributionRun.findMany({ where: { fundId } }),
      ]);

      // Build manifest
      const manifest = {
        exportId,
        fundId,
        fundName: fund?.name,
        generatedAt: new Date().toISOString(),
        contents: {
          investors: investors.length,
          subscriptions: subscriptions.length,
          documents: documents.length,
          documentHashes: documentHashes.length,
          transfers: transfers.length,
          positions: positions.length,
          distributionRuns: distributionRuns.length,
        },
      };

      // Build CSV for cap table — fall back to settled subscriptions if no token positions
      let capTableRows: Array<{
        investorId: string;
        investorName: string;
        walletAddress: string;
        balance: number;
        pct: string;
      }> = [];
      if (positions.length > 0) {
        const totalSupply = positions.reduce(
          (s, pos) => s + Number(pos.settledTokenBalance),
          0,
        );
        capTableRows = positions.map((p) => ({
          investorId: p.wallet?.investor?.id ?? '',
          investorName: p.wallet?.investor?.legalName ?? '',
          walletAddress: p.walletAddress,
          balance: Number(p.settledTokenBalance),
          pct:
            totalSupply > 0
              ? ((Number(p.settledTokenBalance) / totalSupply) * 100).toFixed(4)
              : '0',
        }));
      } else {
        // Fallback: use settled subscriptions
        const settledSubs = await this.prisma.subscription.findMany({
          where: { fundId, status: 'SETTLED', deletedAt: null },
          include: { investor: true, wallet: true },
        });
        capTableRows = settledSubs.map((s) => ({
          investorId: s.investorId,
          investorName: s.investor.legalName,
          walletAddress: s.wallet?.address ?? '',
          balance: Number(s.committedAmount),
          pct: Number(s.allocationPct).toFixed(4),
        }));
      }

      const capTableCsv = [
        'investor_id,investor_name,wallet_address,token_balance,ownership_pct',
        ...capTableRows.map(
          (r) =>
            `${r.investorId},${r.investorName},${r.walletAddress},${r.balance},${r.pct}`,
        ),
      ].join('\n');

      // Build CSV for document hashes
      const hashCsv = [
        'document_id,hash_algorithm,hash_hex,anchored_onchain,anchor_tx_hash',
        ...documentHashes.map(
          (h) =>
            `${h.documentId},${h.hashAlgorithm},${h.hashHex},${h.anchoredOnchain},${h.anchorTxHash ?? ''}`,
        ),
      ].join('\n');

      // Build CSV for subscriptions
      const subsCsv = [
        'subscription_id,subscription_ref,investor_id,allocation_pct,committed_amount,status,settled_at',
        ...subscriptions.map(
          (s) =>
            `${s.id},${s.subscriptionRef},${s.investorId},${Number(s.allocationPct)},${Number(s.committedAmount)},${s.status},${s.settledAt?.toISOString() ?? ''}`,
        ),
      ].join('\n');

      // Build CSV for transfers
      const transfersCsv = [
        'transfer_id,from_address,to_address,amount,status,tx_hash,created_at',
        ...transfers.map(
          (t) =>
            `${t.id},${t.fromWalletAddress},${t.toWalletAddress},${Number(t.tokenAmount)},${t.requestStatus},${t.submittedTxHash ?? ''},${t.createdAt.toISOString()}`,
        ),
      ].join('\n');

      // Store CSV data in manifestJson (no filesystem writes — works on Vercel serverless)
      const exportData = {
        ...manifest,
        files: {
          'cap-table.csv': capTableCsv,
          'document-hashes.csv': hashCsv,
          'subscriptions.csv': subsCsv,
          'transfers.csv': transfersCsv,
        },
      };

      // Compute checksum of manifest
      const manifestBuffer = Buffer.from(JSON.stringify(manifest));
      const checksum = createHash('sha256')
        .update(manifestBuffer)
        .digest('hex');

      const artifactName = `audit-packet-${new Date().toISOString().slice(0, 10)}`;

      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: {
          status: 'READY',
          completedAt: new Date(),
          artifactPath: artifactName,
          manifestJson: exportData,
          checksumSha256: checksum,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    } catch (error) {
      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'unknown',
        },
      });
      throw error;
    }
  }

  async getExportStatus(auditExportId: string) {
    const exp = await this.prisma.auditExport.findUnique({
      where: { id: auditExportId },
    });
    if (!exp) throw new NotFoundError('AuditExport', auditExportId);

    return {
      auditExportId: exp.id,
      status: exp.status,
      exportType: exp.exportType,
      artifact:
        exp.status === 'READY'
          ? {
              storageProvider: exp.artifactStorageProvider,
              path: exp.artifactPath,
              checksumSha256: exp.checksumSha256,
            }
          : null,
      requestedAt: exp.requestedAt.toISOString(),
      completedAt: exp.completedAt?.toISOString() ?? null,
    };
  }

  async renderGpAdminExportPdf(
    fundId: string,
    asOf: Date = new Date(),
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const input = await buildGpAdminExportInput(this.prisma, fundId, asOf);
    const buffer = await renderGpAdminExportPdf(input);
    const filename = `${input.exportPackageId}.pdf`;
    return { buffer, filename, mimeType: 'application/pdf' };
  }

  async getExportDownload(auditExportId: string) {
    const exp = await this.prisma.auditExport.findUnique({
      where: { id: auditExportId },
    });
    if (!exp) throw new NotFoundError('AuditExport', auditExportId);

    if (exp.status !== 'READY') {
      throw new Error(`Export is not ready (status: ${exp.status})`);
    }

    const manifestData = exp.manifestJson as Record<string, unknown> | null;
    if (!manifestData || !manifestData.files) {
      throw new Error('Export data not found in manifest');
    }

    const files = manifestData.files as Record<string, string>;

    return {
      exportId: exp.id,
      fundId: exp.fundId,
      fundName: (manifestData.fundName as string) ?? null,
      generatedAt:
        (manifestData.generatedAt as string) ?? exp.completedAt?.toISOString(),
      checksumSha256: exp.checksumSha256,
      files,
    };
  }

  /**
   * Wipe all transactional data and re-seed the fund + active waterfall config.
   * Preserves auth_users so existing logins keep working.
   */
  async resetDemoFund(fundId: string) {
    const fund = await this.prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) throw new NotFoundError('Fund not found');

    const tables = [
      'audit_exports',
      'capital_accounts',
      'capital_call_responses',
      'capital_calls',
      'distribution_line_items',
      'distribution_runs',
      'document_hashes',
      'documents',
      'extracted_document_fields',
      'investor_fund_eligibility',
      'investors',
      'jobs',
      'jobs_dead_letter',
      'notice_deliveries',
      'notices',
      'ownership_snapshot_rows',
      'ownership_snapshots',
      'settlement_evidence',
      'settlement_records',
      'subscriptions',
      'system_event_log',
      'tax_reports',
      'token_contracts',
      'token_position_events',
      'token_positions',
      'transfer_events',
      'transfer_requests',
      'wallet_link_challenges',
      'wallets',
      'waterfall_tiers',
      'waterfall_configs',
      'funds',
    ];

    await this.prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );

    const newFund = await this.prisma.fund.create({
      data: {
        code: fund.code,
        name: fund.name,
        legalForm: fund.legalForm,
        jurisdictionCode: fund.jurisdictionCode,
        baseCurrency: fund.baseCurrency,
        status: 'ACTIVE',
      },
    });

    await this.prisma.waterfallConfig.create({
      data: {
        fundId: newFund.id,
        version: '1.0',
        isActive: true,
        calculationBasis: 'IRR',
        distributionFrequency: 'QUARTERLY',
        catchUpEnabled: false,
        gpPromotePct: 20 as unknown as never,
        prefReturnPct: 8 as unknown as never,
        rulesJson: {
          tiers: [
            {
              name: 'Return of Capital',
              hurdle: 'NONE',
              lpShare: 100,
              gpShare: 0,
            },
            {
              name: 'Preferred Return',
              hurdle: 'IRR',
              hurdleValue: 8,
              lpShare: 100,
              gpShare: 0,
            },
            {
              name: 'GP Catch-up',
              hurdle: 'NONE',
              lpShare: 0,
              gpShare: 100,
              catchUp: true,
            },
            {
              name: 'Carried Interest',
              hurdle: 'NONE',
              lpShare: 80,
              gpShare: 20,
            },
          ],
        },
      },
    });

    return {
      fundId: newFund.id,
      fundCode: newFund.code,
      fundName: newFund.name,
      resetAt: new Date().toISOString(),
    };
  }
}
