import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import multipart from '@fastify/multipart';
import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Kadra Demo Flow — End-to-End Test
 *
 * Mirrors the 9-step demo described in CLAUDE.md.
 * Requires: DATABASE_URL pointing at a seeded Supabase/Postgres instance.
 * Run:      npm run test:e2e
 */

const SERVICE_TOKEN = process.env.CRON_SERVICE_TOKEN ?? 'e2e-test-token';

const ctx: {
  fundId: string;
  investors: Array<{
    investorId: string;
    legalName: string;
    walletId: string;
    walletAddress: string;
    eligibilityId: string;
  }>;
  ineligibleInvestor: {
    investorId: string;
    walletId: string;
    walletAddress: string;
  };
  documentId: string;
  subscriptionIds: string[];
  subscriptionRefs: string[];
  settlementRecordIds: string[];
  waterfallConfigId: string;
  contractAddress: string;
  failedTransferId: string;
  successfulTransferId: string;
  auditExportId: string;
} = {} as any;

describe('Kadra Demo Flow (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.CRON_SERVICE_TOKEN = SERVICE_TOKEN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await (app as NestFastifyApplication).register(multipart, {
      limits: { fileSize: 50 * 1024 * 1024 },
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    await (app as NestFastifyApplication).getHttpAdapter().getInstance().ready();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    // Clean up any leftover data from previous runs (preserves seed data)
    const fund = await prisma.fund.findFirst({ where: { code: 'KADRA-DEMO-001' } });
    if (fund) {
      ctx.fundId = fund.id;
      await cleanFundTransactionalData(prisma, fund.id);
    }
  }, 30_000);

  afterAll(async () => {
    // Clean up data created during this test run
    if (ctx.fundId) {
      await cleanFundTransactionalData(prisma, ctx.fundId);
    }
    await app.close();
  }, 15_000);

  // ─────────────────────────────────────────────────────────────
  // STEP 1: Verify pre-demo seeded state
  // ─────────────────────────────────────────────────────────────

  describe('Step 1 — Seeded State', () => {
    it('health check returns ok', async () => {
      const res = await request(server).get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('fund "Kadra Demo Fund I" exists and is ACTIVE', async () => {
      const fund = await prisma.fund.findFirst({ where: { code: 'KADRA-DEMO-001' } });
      expect(fund).toBeTruthy();
      ctx.fundId = fund!.id;

      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/overview`)
        .expect(200);

      expect(res.body.data.fundName).toBe('Kadra Demo Fund I');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.lpCount).toBe(5);
      expect(res.body.data.eligibleWalletCount).toBe(5);
      expect(res.body.data.settledSubscriptions).toBe(0);
      expect(res.body.data.tokenContract).toBeNull();
    });

    it('5 verified + 1 unverified investors with wallets and eligibility', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/investors`)
        .expect(200);

      expect(res.body.meta.count).toBe(6);

      const eligible = res.body.data.filter(
        (i: any) => i.fundEligibility?.status === 'ELIGIBLE',
      );
      const ineligible = res.body.data.filter((i: any) => !i.fundEligibility);

      expect(eligible).toHaveLength(5);
      expect(ineligible).toHaveLength(1);

      for (const inv of eligible) {
        expect(inv.verificationStatus).toBe('VERIFIED');
        expect(inv.wallets).toHaveLength(1);
        expect(inv.wallets[0].status).toBe('ACTIVE');
      }

      ctx.investors = eligible.map((i: any) => ({
        investorId: i.investorId,
        legalName: i.legalName,
        walletId: i.wallets[0].walletId,
        walletAddress: i.wallets[0].address,
        eligibilityId: i.fundEligibility.eligibilityId,
      }));
      ctx.ineligibleInvestor = {
        investorId: ineligible[0].investorId,
        walletId: ineligible[0].wallets[0].walletId,
        walletAddress: ineligible[0].wallets[0].address,
      };
    });

    it('waterfall config is pre-configured with 4 tiers', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/waterfall-configs/active`)
        .expect(200);

      const wf = res.body.data;
      expect(wf.calculationBasis).toBe('IRR');
      expect(wf.distributionFrequency).toBe('QUARTERLY');
      expect(wf.prefReturnPct).toBe(8);
      expect(wf.gpPromotePct).toBe(20);
      expect(wf.rules.tiers).toHaveLength(4);
      expect(wf.rules.tiers.map((t: any) => t.name)).toEqual([
        'Return of Capital',
        'Preferred Return',
        'GP Catch-up',
        'Carried Interest',
      ]);
      ctx.waterfallConfigId = wf.waterfallConfigId;
    });

    it('cap table is empty (no ownership issued)', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/cap-table`)
        .expect(200);

      expect(res.body.data.rows).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 2: Upload Master LPA
  // ─────────────────────────────────────────────────────────────

  describe('Step 2 — Upload Master LPA', () => {
    it('rejects non-PDF files with 400', async () => {
      const tmpFile = '/tmp/kadra-e2e-test.txt';
      fs.writeFileSync(tmpFile, 'This is not a PDF');

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/documents/master-lpa`)
        .attach('file', tmpFile)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/PDF/i);

      fs.unlinkSync(tmpFile);
    });

    it('accepts PDF upload, generates SHA-256 hash', async () => {
      const pdfPath = path.resolve(__dirname, '../../demo.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/documents/master-lpa`)
        .attach('file', pdfPath)
        .expect(201);

      expect(res.body.data.documentId).toBeDefined();
      expect(res.body.data.parseStatus).toBe('COMPLETED');
      expect(res.body.data.hashStatus).toBe('COMPLETED');
      ctx.documentId = res.body.data.documentId;
    });

    it('document has a valid SHA-256 hash', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/documents/${ctx.documentId}/hashes`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].algorithm).toBe('SHA256');
      expect(res.body.data[0].hashHex).toMatch(/^[a-f0-9]{64}$/);
    });

    it('parse status shows extracted fields', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/documents/${ctx.documentId}/parse-status`)
        .expect(200);

      expect(res.body.data.parseStatus).toBe('COMPLETED');
      expect(res.body.data.hashStatus).toBe('COMPLETED');
      expect(res.body.data.extractionSummary.fieldsExtracted).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Create subscriptions (pre-settlement state)
  // ─────────────────────────────────────────────────────────────

  describe('Step 3 — Pre-Settlement State', () => {
    it('creates 5 subscriptions linked to governing document, each 20%', async () => {
      ctx.subscriptionRefs = ctx.investors.map(
        (_, i) => `SUB-E2E-${String(i + 1).padStart(3, '0')}`,
      );

      const items = ctx.investors.map((inv, i) => ({
        investorId: inv.investorId,
        walletId: inv.walletId,
        allocationPct: 20,
        committedAmount: '2000000',
        subscriptionRef: ctx.subscriptionRefs[i],
      }));

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/subscriptions`)
        .send({ governingDocumentId: ctx.documentId, items })
        .expect(201);

      expect(res.body.data.createdCount).toBe(5);
      expect(res.body.data.subscriptions).toHaveLength(5);
      res.body.data.subscriptions.forEach((s: any) => {
        expect(s.status).toBe('PENDING');
      });

      ctx.subscriptionIds = res.body.data.subscriptions.map(
        (s: any) => s.subscriptionId,
      );
    });

    it('total allocation is 100%, all PENDING', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/subscriptions`)
        .expect(200);

      expect(res.body.data).toHaveLength(5);
      const totalAlloc = res.body.data.reduce(
        (sum: number, s: any) => sum + s.allocationPct, 0,
      );
      expect(totalAlloc).toBe(100);
      res.body.data.forEach((s: any) => {
        expect(s.status).toBe('PENDING');
        expect(s.committedAmount).toBe('2000000');
      });
    });

    it('fund overview shows pending subscriptions, zero settled', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/overview`)
        .expect(200);

      expect(res.body.data.pendingSubscriptions).toBe(5);
      expect(res.body.data.settledSubscriptions).toBe(0);
      expect(res.body.data.totalCommittedAmount).toBe('10000000');
      expect(parseFloat(res.body.data.totalSettledAmount)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 4: Settlement confirmation
  // ─────────────────────────────────────────────────────────────

  describe('Step 4 — Settlement Confirmation', () => {
    it('3-way match validates each subscription', async () => {
      ctx.settlementRecordIds = [];

      for (let i = 0; i < ctx.subscriptionIds.length; i++) {
        const subId = ctx.subscriptionIds[i];
        const res = await request(server)
          .post(`/api/v1/admin/subscriptions/${subId}/payment-validations`)
          .send({
            paymentDocumentId: ctx.documentId,
            declaredAmount: '2000000',
            declaredCurrency: 'USD',
            declaredReference: ctx.subscriptionRefs[i],
          })
          .expect(201);

        expect(res.body.data.status).toBe('PASSED');
        expect(res.body.data.checks).toEqual({
          checkAmountMatch: true,
          checkInvestorMatch: true,
          checkReferenceMatch: true,
          checkNoDoubleSettlement: true,
        });
        ctx.settlementRecordIds.push(res.body.data.settlementRecordId);
      }
    });

    it('rejects amount mismatch on re-validation', async () => {
      const subId = ctx.subscriptionIds[0];
      const res = await request(server)
        .post(`/api/v1/admin/subscriptions/${subId}/payment-validations`)
        .send({
          paymentDocumentId: ctx.documentId,
          declaredAmount: '999999',
          declaredCurrency: 'USD',
          declaredReference: ctx.subscriptionRefs[0],
        })
        .expect(201);

      expect(res.body.data.status).toBe('FAILED');
      expect(['AMOUNT_MISMATCH', 'DOUBLE_SETTLEMENT']).toContain(
        res.body.data.failureReasonCode,
      );
    });

    it('confirms all 5 settlements — PENDING to SETTLED', async () => {
      for (let i = 0; i < ctx.subscriptionIds.length; i++) {
        const res = await request(server)
          .post(`/api/v1/admin/subscriptions/${ctx.subscriptionIds[i]}/settlement-confirmation`)
          .send({ settlementRecordId: ctx.settlementRecordIds[i] })
          .expect(201);

        expect(res.body.data.status).toBe('SETTLED');
        expect(res.body.data.settledAt).toBeDefined();
      }
    });

    it('mints tokens for all 5 settled subscriptions — 2000 each', async () => {
      for (const subId of ctx.subscriptionIds) {
        const res = await request(server)
          .post(`/api/v1/admin/subscriptions/${subId}/token-mint`)
          .expect(201);

        expect(res.body.data.status).toBe('CONFIRMED');
        expect(res.body.data.txHash).toMatch(/^0x[a-f0-9]+$/);
        expect(res.body.data.tokenAmount).toBe('2000');
      }
    });

    it('rejects double-mint', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/subscriptions/${ctx.subscriptionIds[0]}/token-mint`)
        .expect(409);

      expect(res.body.error.code).toBe('MINT_ALREADY_CONFIRMED');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 5: Fund dashboard (final settled state)
  // ─────────────────────────────────────────────────────────────

  describe('Step 5 — Post-Settlement Dashboard', () => {
    it('fund: 5 settled, $10M total, token contract deployed', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/overview`)
        .expect(200);

      const d = res.body.data;
      expect(d.settledSubscriptions).toBe(5);
      expect(d.pendingSubscriptions).toBe(0);
      expect(d.totalCommittedAmount).toBe('10000000');
      expect(d.totalSettledAmount).toBe('10000000');
      expect(d.tokenContract).toBeTruthy();
      expect(d.tokenContract.deploymentStatus).toBe('DEPLOYED');
      expect(d.tokenContract.contractAddress).toMatch(/^0x[a-f0-9]+$/);
      ctx.contractAddress = d.tokenContract.contractAddress;
    });

    it('cap table: 5 investors, each 20% / 2000 tokens, total 10000', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/cap-table`)
        .expect(200);

      expect(res.body.data.rows).toHaveLength(5);
      res.body.data.rows.forEach((row: any) => {
        expect(row.settledTokenBalance).toBe('2000');
        expect(row.ownershipPct).toBe(20);
      });

      const total = res.body.data.rows.reduce(
        (sum: number, r: any) => sum + parseInt(r.settledTokenBalance), 0,
      );
      expect(total).toBe(10000);
    });

    it('all subscriptions SETTLED with settlement records', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/subscriptions`)
        .expect(200);

      res.body.data.forEach((s: any) => {
        expect(s.status).toBe('SETTLED');
        expect(s.settledAt).toBeDefined();
        // latestSettlementStatus may be PASSED or FAILED (from re-validation test)
        expect(['PASSED', 'FAILED']).toContain(s.latestSettlementStatus);
      });
    });

    it('ownership history: 5 MINT events, each 2000 tokens', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/ownership-history`)
        .expect(200);

      const mints = res.body.data.filter((e: any) => e.eventType === 'MINT');
      expect(mints).toHaveLength(5);
      mints.forEach((m: any) => {
        expect(m.tokenDelta).toBe('2000');
        expect(m.fromWalletAddress).toBe('0x0000000000000000000000000000000000000000');
        expect(m.txHash).toMatch(/^0x[a-f0-9]+$/);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 6: Distribution logic
  // ─────────────────────────────────────────────────────────────

  describe('Step 6 — Distribution Logic', () => {
    it('previews pro-rata distribution: 5 equal LPs, $100K each', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/distributions/preview`)
        .send({
          waterfallConfigId: ctx.waterfallConfigId,
          asOfTimestamp: new Date().toISOString(),
          grossDistributableAmount: '500000',
          currency: 'USD',
        })
        .expect(201);

      const d = res.body.data;
      expect(d.summary.gross).toBe('500000');
      expect(d.lineItems).toHaveLength(5);
      d.lineItems.forEach((item: any) => {
        expect(item.ownershipPctUsed).toBe(20);
        expect(parseFloat(item.grossAmount)).toBeCloseTo(100000, 0);
      });
    });

    it('executes a distribution run', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/distributions/runs`)
        .send({
          waterfallConfigId: ctx.waterfallConfigId,
          asOfTimestamp: new Date().toISOString(),
          grossDistributableAmount: '500000',
          currency: 'USD',
        })
        .expect(201);

      expect(res.body.data.distributionRunId).toBeDefined();
      expect(res.body.data.runStatus).toBe('COMPLETED');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 7: Transfer rule enforcement (illegal transfer)
  // ─────────────────────────────────────────────────────────────

  describe('Step 7 — Transfer Rule Enforcement', () => {
    it('rejects transfer to non-LP: PRECHECK_FAILED, recipientEligible=false', async () => {
      const sender = ctx.investors[0];
      const res = await request(server)
        .post(`/api/v1/investor/funds/${ctx.fundId}/transfers`)
        .send({
          fromWalletAddress: sender.walletAddress,
          toWalletAddress: ctx.ineligibleInvestor.walletAddress,
          tokenAmount: '500',
        })
        .expect(201);

      expect(res.body.data.requestStatus).toBe('PRECHECK_FAILED');
      expect(res.body.data.precheck.recipientEligible).toBe(false);
      expect(res.body.data.precheck.senderEligible).toBe(true);
      expect(res.body.data.txHash).toBeNull();
      ctx.failedTransferId = res.body.data.transferRequestId;
    });

    it('rejected transfer listed in failed transfers', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/transfers/failed`)
        .expect(200);

      const failed = res.body.data.find(
        (t: any) => t.transferRequestId === ctx.failedTransferId,
      );
      expect(failed).toBeTruthy();
      expect(failed.failureStage).toBe('PRECHECK');
      expect(failed.failureCode).toBe('RECIPIENT_NOT_ELIGIBLE');
    });

    it('transfer validation endpoint shows failure detail', async () => {
      const res = await request(server)
        .get(`/api/v1/transfers/${ctx.failedTransferId}/validation`)
        .expect(200);

      expect(res.body.data.requestStatus).toBe('PRECHECK_FAILED');
      expect(res.body.data.precheckResult.recipientEligible).toBe(false);
      expect(res.body.data.precheckResult.failureCode).toBe('RECIPIENT_NOT_ELIGIBLE');
    });

    it('rejects transfer with insufficient balance', async () => {
      const res = await request(server)
        .post(`/api/v1/investor/funds/${ctx.fundId}/transfers`)
        .send({
          fromWalletAddress: ctx.investors[0].walletAddress,
          toWalletAddress: ctx.investors[1].walletAddress,
          tokenAmount: '99999',
        })
        .expect(201);

      expect(res.body.data.requestStatus).toBe('PRECHECK_FAILED');
      expect(res.body.data.precheck.sufficientBalance).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 8: Legal transfer execution (LP-to-LP)
  // ─────────────────────────────────────────────────────────────

  describe('Step 8 — Legal Transfer Execution', () => {
    it('LP-to-LP transfer succeeds (Alpine 500 -> Bridgewater)', async () => {
      const sender = ctx.investors[0];
      const recipient = ctx.investors[1];

      const res = await request(server)
        .post(`/api/v1/investor/funds/${ctx.fundId}/transfers`)
        .send({
          fromWalletAddress: sender.walletAddress,
          toWalletAddress: recipient.walletAddress,
          tokenAmount: '500',
        })
        .expect(201);

      expect(res.body.data.requestStatus).toBe('MINED');
      expect(res.body.data.precheck).toEqual({
        recipientEligible: true,
        senderEligible: true,
        sufficientBalance: true,
      });
      expect(res.body.data.txHash).toMatch(/^0x[a-f0-9]+$/);
      ctx.successfulTransferId = res.body.data.transferRequestId;
    });

    it('cap table recalculates: Alpine 1500 (15%), Bridgewater 2500 (25%)', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/cap-table`)
        .expect(200);

      const rows = res.body.data.rows;
      const senderRow = rows.find(
        (r: any) => r.walletAddress === ctx.investors[0].walletAddress,
      );
      const recipientRow = rows.find(
        (r: any) => r.walletAddress === ctx.investors[1].walletAddress,
      );

      expect(senderRow).toBeTruthy();
      expect(recipientRow).toBeTruthy();
      expect(parseInt(senderRow.settledTokenBalance)).toBe(1500);
      expect(parseInt(recipientRow.settledTokenBalance)).toBe(2500);
      expect(senderRow.ownershipPct).toBe(15);
      expect(recipientRow.ownershipPct).toBe(25);

      // Total still 10000
      const total = rows.reduce(
        (sum: number, r: any) => sum + parseInt(r.settledTokenBalance), 0,
      );
      expect(total).toBe(10000);
    });

    it('successful transfer listed in successful transfers', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/transfers/successful`)
        .expect(200);

      const transfer = res.body.data.find(
        (t: any) => t.transferRequestId === ctx.successfulTransferId,
      );
      expect(transfer).toBeTruthy();
      expect(transfer.fromWalletAddress).toBe(ctx.investors[0].walletAddress);
      expect(transfer.toWalletAddress).toBe(ctx.investors[1].walletAddress);
      expect(transfer.tokenAmount).toBe('500');
      expect(transfer.txHash).toMatch(/^0x[a-f0-9]+$/);
    });

    it('ownership history includes TRANSFER event', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/ownership-history`)
        .expect(200);

      const transfers = res.body.data.filter((e: any) => e.eventType === 'TRANSFER');
      expect(transfers.length).toBeGreaterThanOrEqual(1);

      const latest = transfers[0];
      expect(latest.fromWalletAddress).toBe(ctx.investors[0].walletAddress);
      expect(latest.toWalletAddress).toBe(ctx.investors[1].walletAddress);
      expect(latest.tokenDelta).toBe('500');
    });

    it('distribution preview reflects updated ownership', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/distributions/preview`)
        .send({
          waterfallConfigId: ctx.waterfallConfigId,
          asOfTimestamp: new Date().toISOString(),
          grossDistributableAmount: '100000',
          currency: 'USD',
        })
        .expect(201);

      const items = res.body.data.lineItems;
      const senderItem = items.find(
        (i: any) => i.walletAddress === ctx.investors[0].walletAddress,
      );
      const recipientItem = items.find(
        (i: any) => i.walletAddress === ctx.investors[1].walletAddress,
      );

      expect(senderItem.ownershipPctUsed).toBe(15);
      expect(parseFloat(senderItem.grossAmount)).toBeCloseTo(15000, 0);
      expect(recipientItem.ownershipPctUsed).toBe(25);
      expect(parseFloat(recipientItem.grossAmount)).toBeCloseTo(25000, 0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 9: Audit & Export
  // ─────────────────────────────────────────────────────────────

  describe('Step 9 — Audit & Export', () => {
    it('creates audit export package', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/audit-exports`)
        .send({})
        .expect(201);

      expect(res.body.data.auditExportId).toBeDefined();
      expect(res.body.data.status).toBe('READY');
      ctx.auditExportId = res.body.data.auditExportId;
    });

    it('audit export has SHA-256 checksum and artifact', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/audit-exports/${ctx.auditExportId}`)
        .expect(200);

      expect(res.body.data.status).toBe('READY');
      expect(res.body.data.exportType).toBe('AUDIT_PACKET');
      expect(res.body.data.artifact).toBeTruthy();
      expect(res.body.data.artifact.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.data.requestedAt).toBeDefined();
      expect(res.body.data.completedAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Jobs / Cron Endpoints (ServiceTokenGuard)
  // ─────────────────────────────────────────────────────────────

  describe('Jobs — ServiceTokenGuard & Cron Endpoints', () => {
    it('rejects without x-service-token (401)', async () => {
      const res = await request(server)
        .post('/api/v1/admin/jobs/run')
        .send({ batchSize: 10 })
        .expect(401);

      expect(res.body.error.message).toMatch(/service token/i);
    });

    it('rejects invalid token (401)', async () => {
      const res = await request(server)
        .post('/api/v1/admin/jobs/run')
        .set('x-service-token', 'wrong-token')
        .send({ batchSize: 10 })
        .expect(401);

      expect(res.body.error.message).toMatch(/service token/i);
    });

    it('POST /admin/jobs/run — batch drain', async () => {
      const res = await request(server)
        .post('/api/v1/admin/jobs/run')
        .set('x-service-token', SERVICE_TOKEN)
        .send({ batchSize: 10 })
        .expect(201);

      expect(res.body.data).toHaveProperty('processed');
      expect(res.body.data).toHaveProperty('succeeded');
      expect(res.body.data).toHaveProperty('failed');
      expect(res.body.data).toHaveProperty('deadLettered');
    });

    it('POST /admin/jobs/chain-ingest', async () => {
      const res = await request(server)
        .post('/api/v1/admin/jobs/chain-ingest')
        .set('x-service-token', SERVICE_TOKEN)
        .send({})
        .expect(201);

      expect(res.body.data).toHaveProperty('contractsProcessed');
      expect(res.body.data).toHaveProperty('eventsIngested');
    });

    it('POST /admin/jobs/tx-sync', async () => {
      const res = await request(server)
        .post('/api/v1/admin/jobs/tx-sync')
        .set('x-service-token', SERVICE_TOKEN)
        .send({})
        .expect(201);

      expect(res.body.data).toHaveProperty('checked');
      expect(res.body.data).toHaveProperty('confirmed');
      expect(res.body.data).toHaveProperty('reverted');
    });
  });
});

/**
 * Cleans all transactional data for a fund, preserving seed data
 * (fund, investors, wallets, eligibility, waterfall config).
 */
async function cleanFundTransactionalData(prisma: PrismaService, fundId: string) {
  // Order matters: delete child rows before parents
  await prisma.$executeRawUnsafe(`DELETE FROM transfer_events WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(`DELETE FROM transfer_requests WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(`DELETE FROM token_position_events WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(`DELETE FROM token_positions WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(
    `DELETE FROM distribution_line_items WHERE distribution_run_id IN (SELECT id FROM distribution_runs WHERE fund_id = $1)`, fundId,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM distribution_runs WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(
    `DELETE FROM settlement_evidence WHERE settlement_record_id IN (SELECT sr.id FROM settlement_records sr JOIN subscriptions s ON sr.subscription_id = s.id WHERE s.fund_id = $1)`, fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM settlement_records WHERE subscription_id IN (SELECT id FROM subscriptions WHERE fund_id = $1)`, fundId,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM subscriptions WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(`DELETE FROM token_contracts WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(`DELETE FROM audit_exports WHERE fund_id = $1`, fundId);
  await prisma.$executeRawUnsafe(
    `DELETE FROM ownership_snapshot_rows WHERE snapshot_id IN (SELECT id FROM ownership_snapshots WHERE fund_id = $1)`, fundId,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM ownership_snapshots WHERE fund_id = $1`, fundId);

  // Clean documents (not fund-specific in schema, so match by fund_id)
  const docs = await prisma.document.findMany({ where: { fundId }, select: { id: true } });
  for (const doc of docs) {
    await prisma.$executeRawUnsafe(`DELETE FROM extracted_document_fields WHERE document_id = $1`, doc.id);
    await prisma.$executeRawUnsafe(`DELETE FROM document_hashes WHERE document_id = $1`, doc.id);
  }
  await prisma.$executeRawUnsafe(`DELETE FROM documents WHERE fund_id = $1`, fundId);
}
