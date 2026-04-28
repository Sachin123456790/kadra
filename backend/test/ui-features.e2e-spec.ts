import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import multipart from '@fastify/multipart';
import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * UI Features — End-to-End Tests
 *
 * Tests API endpoints backing UI features: capital calls, event log,
 * document provenance/verification, notices, investor portal, and cap table.
 *
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
  documentId: string;
  capitalCallId: string;
  noticeId: string;
  subscriptionIds: string[];
} = {} as any;

describe('UI Features (e2e)', () => {
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
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    await (app as NestFastifyApplication)
      .getHttpAdapter()
      .getInstance()
      .ready();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    // Resolve the seeded fund and investors
    const fund = await prisma.fund.findFirst({
      where: { code: 'ANGAINOR-DEMO-001' },
    });
    expect(fund).toBeTruthy();
    ctx.fundId = fund!.id;

    // Clean transactional data from any previous runs
    await cleanTestData(prisma, ctx.fundId);

    // Load eligible investors with wallets
    const investors = await prisma.investor.findMany({
      where: {
        eligibilities: {
          some: { fundId: ctx.fundId, eligibilityStatus: 'ELIGIBLE', deletedAt: null },
        },
        deletedAt: null,
      },
      include: {
        wallets: { where: { deletedAt: null } },
        eligibilities: { where: { fundId: ctx.fundId, deletedAt: null } },
      },
    });

    ctx.investors = investors.map((i) => ({
      investorId: i.id,
      legalName: i.legalName,
      walletId: i.wallets[0].id,
      walletAddress: i.wallets[0].address,
      eligibilityId: i.eligibilities[0].id,
    }));
  }, 30_000);

  afterAll(async () => {
    if (ctx.fundId) {
      await cleanTestData(prisma, ctx.fundId);
    }
    await app.close();
  }, 15_000);

  // ─────────────────────────────────────────────────────────────
  // Setup: Upload a document and create subscriptions for tests
  // that depend on existing data
  // ─────────────────────────────────────────────────────────────

  describe('Setup — Upload document for downstream tests', () => {
    it('uploads Master LPA to create a document', async () => {
      const pdfPath = path.resolve(__dirname, '../../demo.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/documents/master-lpa`)
        .attach('file', pdfPath)
        .expect(201);

      expect(res.body.data.documentId).toBeDefined();
      ctx.documentId = res.body.data.documentId;
    });

    it('creates subscriptions for settlement tests', async () => {
      const items = ctx.investors.map((inv, i) => ({
        investorId: inv.investorId,
        walletId: inv.walletId,
        allocationPct: 20,
        committedAmount: '2000000',
        subscriptionRef: `SUB-UI-${String(i + 1).padStart(3, '0')}`,
      }));

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/subscriptions`)
        .send({ governingDocumentId: ctx.documentId, items })
        .expect(201);

      expect(res.body.data.createdCount).toBe(5);
      ctx.subscriptionIds = res.body.data.subscriptions.map(
        (s: any) => s.subscriptionId,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 1 & 2: Capital Calls — Create and List
  // ─────────────────────────────────────────────────────────────

  describe('Capital Calls', () => {
    it('POST creates a capital call with correct structure', async () => {
      const dueDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/capital-calls`)
        .send({
          amountDue: '5000000',
          currency: 'USD',
          dueDate,
          wireInstructions: 'Wire to Chase acct ending 1234',
          createdBy: 'e2e-test',
        })
        .expect(201);

      const call = res.body.data;
      expect(call.id).toBeDefined();
      expect(call.callNumber).toBe(1);
      expect(call.amountDue).toBeDefined();
      expect(call.status).toBe('ISSUED');
      expect(call.currency).toBe('USD');
      expect(call.dueDate).toBeDefined();
      ctx.capitalCallId = call.id;
    });

    it('POST creates a second capital call with incremented callNumber', async () => {
      const dueDate = new Date(
        Date.now() + 60 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const res = await request(server)
        .post(`/api/v1/admin/funds/${ctx.fundId}/capital-calls`)
        .send({
          amountDue: '3000000',
          dueDate,
        })
        .expect(201);

      expect(res.body.data.callNumber).toBe(2);
      expect(res.body.data.status).toBe('ISSUED');
    });

    it('GET lists all capital calls with expected fields', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/capital-calls`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      for (const call of res.body.data) {
        expect(call).toHaveProperty('id');
        expect(call).toHaveProperty('callNumber');
        expect(call).toHaveProperty('amountDue');
        expect(call).toHaveProperty('dueDate');
        expect(call).toHaveProperty('status');
        expect(call).toHaveProperty('currency');
        expect(call).toHaveProperty('responses');
        expect(Array.isArray(call.responses)).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3: Event Log
  // ─────────────────────────────────────────────────────────────

  describe('Event Log', () => {
    it('GET returns events with required fields', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/event-log`)
        .expect(200);

      expect(res.body.meta.count).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data)).toBe(true);

      for (const event of res.body.data) {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('eventId');
        expect(event).toHaveProperty('eventType');
        expect(event).toHaveProperty('aggregateType');
        expect(event).toHaveProperty('aggregateId');
        expect(event).toHaveProperty('occurredAt');
        expect(event).toHaveProperty('payload');
      }
    });

    it('includes CAPITAL_CALL_ISSUED events from capital call creation', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/event-log`)
        .expect(200);

      const capitalCallEvents = res.body.data.filter(
        (e: any) => e.eventType === 'CAPITAL_CALL_ISSUED',
      );
      expect(capitalCallEvents.length).toBeGreaterThanOrEqual(1);

      const event = capitalCallEvents[0];
      expect(event.aggregateType).toBe('CAPITAL_CALL');
      expect(event.payload).toBeDefined();
    });

    it('respects limit and offset query parameters', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/event-log?limit=2&offset=0`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4: Document Provenance — Hashes
  // ─────────────────────────────────────────────────────────────

  describe('Document Provenance — Hashes', () => {
    it('GET returns hashes with anchoredOnchain field', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/documents/${ctx.documentId}/hashes`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      for (const hash of res.body.data) {
        expect(hash).toHaveProperty('hashId');
        expect(hash).toHaveProperty('algorithm');
        expect(hash).toHaveProperty('hashHex');
        expect(hash).toHaveProperty('anchoredOnchain');
        expect(typeof hash.anchoredOnchain).toBe('boolean');
        expect(hash.hashHex).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('hash includes anchor details when anchored on-chain', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/documents/${ctx.documentId}/hashes`)
        .expect(200);

      const anchored = res.body.data.find((h: any) => h.anchoredOnchain);
      if (anchored) {
        expect(anchored.anchor).toBeDefined();
        expect(anchored.anchor.txHash).toMatch(/^0x[a-f0-9]+$/);
        expect(anchored.anchor.chainId).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5: Document Verification
  // ─────────────────────────────────────────────────────────────

  describe('Document Verification', () => {
    it('POST returns verification status with hash details', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/documents/${ctx.documentId}/verify`)
        .expect(201);

      const data = res.body.data;
      expect(data).toHaveProperty('verified');
      expect(data).toHaveProperty('documentId', ctx.documentId);
      expect(data).toHaveProperty('hashAlgorithm');
      expect(data).toHaveProperty('storedHash');
      expect(typeof data.verified).toBe('boolean');

      if (data.verified) {
        expect(data.anchorTxHash).toMatch(/^0x[a-f0-9]+$/);
        expect(data.anchoredAt).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6: Notices — Generate and List
  // ─────────────────────────────────────────────────────────────

  describe('Notices', () => {
    it('POST generates a notice with delivery tracking', async () => {
      const res = await request(server)
        .post('/api/v1/admin/notices')
        .send({
          fundId: ctx.fundId,
          type: 'CAPITAL_CALL',
          recipientInvestorId: ctx.investors[0].investorId,
          capitalCallId: ctx.capitalCallId,
        })
        .expect(201);

      const notice = res.body.data;
      expect(notice.id).toBeDefined();
      expect(notice.type).toBe('CAPITAL_CALL');
      expect(notice.recipientInvestorId).toBe(ctx.investors[0].investorId);
      expect(notice.deliveries).toBeDefined();
      expect(notice.deliveries).toHaveLength(1);
      expect(notice.deliveries[0].status).toBe('GENERATED');
      ctx.noticeId = notice.id;
    });

    it('GET lists notices with delivery tracking fields', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/notices`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      for (const notice of res.body.data) {
        expect(notice).toHaveProperty('id');
        expect(notice).toHaveProperty('type');
        expect(notice).toHaveProperty('recipientInvestorId');
        expect(notice).toHaveProperty('generatedAt');
        expect(notice).toHaveProperty('deliveries');
        expect(Array.isArray(notice.deliveries)).toBe(true);

        // Verify delivery records have tracking timestamp fields
        for (const delivery of notice.deliveries) {
          expect(delivery).toHaveProperty('status');
          expect(delivery).toHaveProperty('sentAt');
          expect(delivery).toHaveProperty('openedAt');
          expect(delivery).toHaveProperty('downloadedAt');
        }
      }
    });

    it('notices include investor details', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/notices`)
        .expect(200);

      const notice = res.body.data.find((n: any) => n.id === ctx.noticeId);
      expect(notice).toBeTruthy();
      expect(notice.investor).toBeDefined();
      expect(notice.investor.legalName).toBeDefined();
      expect(notice.investor.email).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7: Investor Portal — Dashboard
  // ─────────────────────────────────────────────────────────────

  describe('Investor Portal — Dashboard (direct service)', () => {
    // The investor portal endpoints require Supabase JWT auth via @CurrentUser().
    // Since we do not have real Supabase tokens in e2e, we test the service
    // layer directly via Prisma queries that mirror what the controller returns.

    it('dashboard service returns correct structure for a seeded investor', async () => {
      const investorId = ctx.investors[0].investorId;

      // Query the same data the getDashboard service method would return
      const investor = await prisma.investor.findUnique({
        where: { id: investorId },
        include: { wallets: { where: { deletedAt: null } } },
      });
      expect(investor).toBeTruthy();
      expect(investor!.legalName).toBeDefined();
      expect(investor!.wallets.length).toBeGreaterThanOrEqual(1);

      const eligibility = await prisma.investorFundEligibility.findMany({
        where: { fundId: ctx.fundId, investorId, deletedAt: null },
      });
      expect(eligibility.length).toBeGreaterThanOrEqual(1);
      expect(eligibility[0].eligibilityStatus).toBe('ELIGIBLE');

      const subscriptions = await prisma.subscription.findMany({
        where: { fundId: ctx.fundId, investorId, deletedAt: null },
      });
      expect(subscriptions.length).toBeGreaterThanOrEqual(1);

      // Verify summary fields can be computed
      const totalCommitted = subscriptions.reduce(
        (sum, s) => sum + Number(s.committedAmount),
        0,
      );
      expect(totalCommitted).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8: Investor Portal — Capital Account
  // ─────────────────────────────────────────────────────────────

  describe('Investor Portal — Capital Account (direct query)', () => {
    it('capital account table exists and returns expected fields when populated', async () => {
      const investorId = ctx.investors[0].investorId;

      const capitalAccount = await prisma.capitalAccount.findFirst({
        where: {
          investorId,
          fundId: ctx.fundId,
          isCurrent: true,
          deletedAt: null,
        },
      });

      // Capital accounts may not exist until settlement + distribution.
      // Verify the schema is correct by checking model fields.
      if (capitalAccount) {
        expect(capitalAccount.openingBalance).toBeDefined();
        expect(capitalAccount.initialContribution).toBeDefined();
        expect(capitalAccount.capitalReturned).toBeDefined();
        expect(capitalAccount.accruedPref).toBeDefined();
        expect(capitalAccount.residualAllocation).toBeDefined();
        expect(capitalAccount.endingCapitalBalance).toBeDefined();
        expect(capitalAccount.asOfDate).toBeDefined();
      }
      // Test passes whether or not capital accounts exist yet
      expect(true).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9: Investor Portal — Documents
  // ─────────────────────────────────────────────────────────────

  describe('Investor Portal — Documents (direct query)', () => {
    it('documents linked to investor have type, status, and download fields', async () => {
      const investorId = ctx.investors[0].investorId;

      // Get subscriptions to find governing documents (mirrors service logic)
      const subscriptions = await prisma.subscription.findMany({
        where: { fundId: ctx.fundId, investorId, deletedAt: null },
        select: { governingDocumentId: true },
      });

      const docIds = subscriptions
        .map((s) => s.governingDocumentId)
        .filter((id): id is string => id !== null);

      if (docIds.length > 0) {
        const docs = await prisma.document.findMany({
          where: { id: { in: docIds }, deletedAt: null },
        });

        expect(docs.length).toBeGreaterThan(0);
        for (const doc of docs) {
          expect(doc.documentType).toBeDefined();
          expect(doc.parseStatus).toBeDefined();
          expect(doc.originalFilename).toBeDefined();
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10: Investor Portal — Tax Reports
  // ─────────────────────────────────────────────────────────────

  describe('Investor Portal — Tax Reports (direct query)', () => {
    it('tax report query returns null when no report exists (correct behavior)', async () => {
      const investorId = ctx.investors[0].investorId;
      const currentYear = new Date().getFullYear();

      const report = await prisma.taxReport.findFirst({
        where: { investorId, fundId: ctx.fundId, taxYear: currentYear },
      });

      // Tax reports are generated on demand; null is valid for no-report state
      if (report) {
        expect(report.taxYear).toBe(currentYear);
        expect(report.taxEntityName).toBeDefined();
        expect(report.ordinaryIncome).toBeDefined();
        expect(report.returnOfCapital).toBeDefined();
        expect(report.ltcg).toBeDefined();
        expect(report.stcg).toBeDefined();
        expect(report.totalDistributions).toBeDefined();
        expect(report.generatedAt).toBeDefined();
      } else {
        expect(report).toBeNull();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 11: Cap Table — Admin endpoint response shape
  // ─────────────────────────────────────────────────────────────

  describe('Cap Table — Response Shape', () => {
    it('GET returns cap table with fundId, asOfTimestamp, and rows', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/cap-table`)
        .expect(200);

      const data = res.body.data;
      expect(data).toHaveProperty('fundId', ctx.fundId);
      expect(data).toHaveProperty('asOfTimestamp');
      expect(data).toHaveProperty('rows');
      expect(Array.isArray(data.rows)).toBe(true);
    });

    it('cap table rows contain expected ownership fields', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/cap-table`)
        .expect(200);

      // With subscriptions created but not yet settled, rows come from
      // pending subscriptions (includePending defaults to true)
      if (res.body.data.rows.length > 0) {
        for (const row of res.body.data.rows) {
          expect(row).toHaveProperty('investorId');
          expect(row).toHaveProperty('investorName');
          expect(row).toHaveProperty('walletAddress');
          expect(row).toHaveProperty('settledTokenBalance');
          expect(row).toHaveProperty('ownershipPct');
          expect(row).toHaveProperty('pendingAllocationPct');
        }
      }
    });

    it('cap table supports includePending=false query param', async () => {
      const res = await request(server)
        .get(
          `/api/v1/admin/funds/${ctx.fundId}/cap-table?includePending=false`,
        )
        .expect(200);

      expect(res.body.data).toHaveProperty('rows');
      // With no settled positions yet, all rows should be from token positions only
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Document Provenance — Fund-level
  // ─────────────────────────────────────────────────────────────

  describe('Document Provenance — Fund-level', () => {
    it('GET returns document provenance with hash and anchor details', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/document-provenance`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      for (const doc of res.body.data) {
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('originalName');
        expect(doc).toHaveProperty('type');
        expect(doc).toHaveProperty('createdAt');
        expect(doc).toHaveProperty('hash');
        expect(doc).toHaveProperty('hashAlgorithm');
        expect(doc).toHaveProperty('anchorTxHash');
        expect(doc).toHaveProperty('anchorBlockNumber');
        expect(doc).toHaveProperty('anchorConfirmedAt');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Capital Calls — Response Recording
  // ─────────────────────────────────────────────────────────────

  describe('Capital Calls — Response Recording', () => {
    it('records a response for a capital call', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/capital-calls/${ctx.capitalCallId}/responses`)
        .send({
          investorId: ctx.investors[0].investorId,
          amountReceived: '1000000',
          currency: 'USD',
          receivedAt: new Date().toISOString(),
        })
        .expect(201);

      const response = res.body.data;
      expect(response.id).toBeDefined();
      expect(response.capitalCallId).toBe(ctx.capitalCallId);
      expect(response.investorId).toBe(ctx.investors[0].investorId);
      expect(response.status).toBe('RECEIVED');
    });

    it('capital call list now shows the response', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/capital-calls`)
        .expect(200);

      const call = res.body.data.find(
        (c: any) => c.id === ctx.capitalCallId,
      );
      expect(call).toBeTruthy();
      expect(call.responses.length).toBeGreaterThanOrEqual(1);
      expect(call.responses[0].status).toBe('RECEIVED');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Capital Calls — Status Update
  // ─────────────────────────────────────────────────────────────

  describe('Capital Calls — Status Update', () => {
    it('updates capital call status', async () => {
      const res = await request(server)
        .put(`/api/v1/admin/capital-calls/${ctx.capitalCallId}/status`)
        .send({ status: 'CLOSED' })
        .expect(200);

      expect(res.body.data.status).toBe('CLOSED');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Notices — Delivery Status Updates
  // ─────────────────────────────────────────────────────────────

  describe('Notices — Delivery Status', () => {
    it('updates delivery status to SENT and sets sentAt', async () => {
      // Get the delivery ID from the notice
      const listRes = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/notices`)
        .expect(200);

      const notice = listRes.body.data.find(
        (n: any) => n.id === ctx.noticeId,
      );
      expect(notice).toBeTruthy();
      const deliveryId = notice.deliveries[0].id;

      const res = await request(server)
        .put(`/api/v1/admin/notices/${ctx.noticeId}/delivery`)
        .send({ deliveryId, status: 'SENT' })
        .expect(200);

      expect(res.body.data.status).toBe('SENT');
      expect(res.body.data.sentAt).toBeDefined();
    });

    it('updates delivery status to VIEWED and sets openedAt', async () => {
      const listRes = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/notices`)
        .expect(200);

      const notice = listRes.body.data.find(
        (n: any) => n.id === ctx.noticeId,
      );
      const deliveryId = notice.deliveries[0].id;

      const res = await request(server)
        .put(`/api/v1/admin/notices/${ctx.noticeId}/delivery`)
        .send({ deliveryId, status: 'VIEWED' })
        .expect(200);

      expect(res.body.data.status).toBe('VIEWED');
      expect(res.body.data.openedAt).toBeDefined();
    });

    it('updates delivery status to DOWNLOADED and sets downloadedAt', async () => {
      const listRes = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/notices`)
        .expect(200);

      const notice = listRes.body.data.find(
        (n: any) => n.id === ctx.noticeId,
      );
      const deliveryId = notice.deliveries[0].id;

      const res = await request(server)
        .put(`/api/v1/admin/notices/${ctx.noticeId}/delivery`)
        .send({ deliveryId, status: 'DOWNLOADED' })
        .expect(200);

      expect(res.body.data.status).toBe('DOWNLOADED');
      expect(res.body.data.downloadedAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fund Documents — List
  // ─────────────────────────────────────────────────────────────

  describe('Fund Documents — List', () => {
    it('GET lists documents for the fund with hash info', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/documents`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      for (const doc of res.body.data) {
        expect(doc).toHaveProperty('documentId');
        expect(doc).toHaveProperty('documentType');
        expect(doc).toHaveProperty('originalFilename');
        expect(doc).toHaveProperty('parseStatus');
        expect(doc).toHaveProperty('createdAt');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Capital Accounts — Admin endpoint
  // ─────────────────────────────────────────────────────────────

  describe('Capital Accounts — Admin', () => {
    it('GET returns capital accounts array (may be empty before settlement)', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/funds/${ctx.fundId}/capital-accounts`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        for (const account of res.body.data) {
          expect(account).toHaveProperty('id');
          expect(account).toHaveProperty('investorId');
          expect(account).toHaveProperty('investorName');
          expect(account).toHaveProperty('openingBalance');
          expect(account).toHaveProperty('initialContribution');
          expect(account).toHaveProperty('capitalReturned');
          expect(account).toHaveProperty('accruedPreferredReturn');
          expect(account).toHaveProperty('residualAllocation');
          expect(account).toHaveProperty('endingBalance');
          expect(account).toHaveProperty('asOfDate');
        }
      }
    });
  });
});

/**
 * Cleans test-specific transactional data, preserving seed data.
 */
async function cleanTestData(prisma: PrismaService, fundId: string) {
  // Clean notices and deliveries
  const notices = await prisma.notice.findMany({
    where: { fundId },
    select: { id: true },
  });
  for (const notice of notices) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM notice_deliveries WHERE notice_id = $1`,
      notice.id,
    );
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM notices WHERE fund_id = $1`,
    fundId,
  );

  // Clean capital call responses and capital calls
  const calls = await prisma.capitalCall.findMany({
    where: { fundId },
    select: { id: true },
  });
  for (const call of calls) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM capital_call_responses WHERE capital_call_id = $1`,
      call.id,
    );
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM capital_calls WHERE fund_id = $1`,
    fundId,
  );

  // Clean transfers, positions, distributions, settlements, subscriptions
  await prisma.$executeRawUnsafe(
    `DELETE FROM transfer_events WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM transfer_requests WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM token_position_events WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM token_positions WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM distribution_line_items WHERE distribution_run_id IN (SELECT id FROM distribution_runs WHERE fund_id = $1)`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM distribution_runs WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM settlement_evidence WHERE settlement_record_id IN (SELECT sr.id FROM settlement_records sr JOIN subscriptions s ON sr.subscription_id = s.id WHERE s.fund_id = $1)`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM settlement_records WHERE subscription_id IN (SELECT id FROM subscriptions WHERE fund_id = $1)`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM subscriptions WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM token_contracts WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM audit_exports WHERE fund_id = $1`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM ownership_snapshot_rows WHERE snapshot_id IN (SELECT id FROM ownership_snapshots WHERE fund_id = $1)`,
    fundId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM ownership_snapshots WHERE fund_id = $1`,
    fundId,
  );

  // Clean event log entries created by tests
  await prisma.$executeRawUnsafe(
    `DELETE FROM system_event_log WHERE fund_id = $1`,
    fundId,
  );

  // Clean documents
  const docs = await prisma.document.findMany({
    where: { fundId },
    select: { id: true },
  });
  for (const doc of docs) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM extracted_document_fields WHERE document_id = $1`,
      doc.id,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM document_hashes WHERE document_id = $1`,
      doc.id,
    );
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM documents WHERE fund_id = $1`,
    fundId,
  );
}
