import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

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

      // Build CSV for cap table
      const capTableCsv = [
        'investor_id,investor_name,wallet_address,token_balance,ownership_pct',
        ...positions.map((p) => {
          const totalSupply = positions.reduce(
            (s, pos) => s + Number(pos.settledTokenBalance),
            0,
          );
          const pct =
            totalSupply > 0
              ? ((Number(p.settledTokenBalance) / totalSupply) * 100).toFixed(4)
              : '0';
          return `${p.wallet?.investor?.id ?? ''},${p.wallet?.investor?.legalName ?? ''},${p.walletAddress},${Number(p.settledTokenBalance)},${pct}`;
        }),
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

      // Write artifacts
      const exportDir = path.join(
        process.cwd(),
        'storage',
        'exports',
        exportId,
      );
      await fs.mkdir(exportDir, { recursive: true });

      await Promise.all([
        fs.writeFile(
          path.join(exportDir, 'manifest.json'),
          JSON.stringify(manifest, null, 2),
        ),
        fs.writeFile(path.join(exportDir, 'cap-table.csv'), capTableCsv),
        fs.writeFile(
          path.join(exportDir, 'document-hashes.csv'),
          hashCsv,
        ),
        fs.writeFile(
          path.join(exportDir, 'subscriptions.csv'),
          subsCsv,
        ),
        fs.writeFile(path.join(exportDir, 'transfers.csv'), transfersCsv),
      ]);

      // Compute checksum of manifest
      const manifestBuffer = Buffer.from(JSON.stringify(manifest));
      const checksum = createHash('sha256')
        .update(manifestBuffer)
        .digest('hex');

      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: {
          status: 'READY',
          completedAt: new Date(),
          artifactPath: exportDir,
          manifestJson: manifest,
          checksumSha256: checksum,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    } catch (error) {
      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          errorMessage:
            error instanceof Error ? error.message : 'unknown',
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
}
