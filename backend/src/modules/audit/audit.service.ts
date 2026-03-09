import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { EventLogService } from '../../common/event-log.service';
import { createHash } from 'crypto';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

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
}
