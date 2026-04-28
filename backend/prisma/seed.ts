import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Demo credentials — documented in CLAUDE.md. Keep in sync.
const DEMO_CREDENTIALS: ReadonlyArray<{
  email: string;
  password: string;
  role: 'admin' | 'investor';
  fullName: string;
}> = [
  {
    email: 'demo@angainor.io',
    password: 'AngainorDemo2024',
    role: 'admin',
    fullName: 'Angainor Admin',
  },
  {
    email: 'alpine@example.com',
    password: 'AlpineLP2024',
    role: 'investor',
    fullName: 'Alpine Capital Partners',
  },
  {
    email: 'bridge@example.com',
    password: 'BridgewaterLP2024',
    role: 'investor',
    fullName: 'Bridgewater Associates',
  },
  {
    email: 'cascade@example.com',
    password: 'CascadeLP2024',
    role: 'investor',
    fullName: 'Cascade Investment LLC',
  },
  {
    email: 'dominion@example.com',
    password: 'DominionLP2024',
    role: 'investor',
    fullName: 'Dominion Capital Group',
  },
  {
    email: 'evergreen@example.com',
    password: 'EvergreenLP2024',
    role: 'investor',
    fullName: 'Evergreen Holdings Ltd',
  },
  {
    email: 'foxglove@example.com',
    password: 'FoxgloveLP2024',
    role: 'investor',
    fullName: 'Foxglove Ventures',
  },
];

async function seedAuthUsers() {
  for (const cred of DEMO_CREDENTIALS) {
    const passwordHash = await bcrypt.hash(cred.password, 10);
    await prisma.authUser.upsert({
      where: { email: cred.email },
      update: { passwordHash, role: cred.role, fullName: cred.fullName },
      create: {
        email: cred.email,
        passwordHash,
        role: cred.role,
        fullName: cred.fullName,
        emailVerified: true,
      },
    });
  }
  console.log(`Seeded ${DEMO_CREDENTIALS.length} auth users`);
}

async function main() {
  await seedAuthUsers();

  // Create demo fund
  const fund = await prisma.fund.upsert({
    where: { code: 'ANGAINOR-DEMO-001' },
    update: {},
    create: {
      code: 'ANGAINOR-DEMO-001',
      name: 'Angainor Demo Fund I',
      legalForm: 'LP',
      jurisdictionCode: 'US-DE',
      baseCurrency: 'USD',
      status: 'ACTIVE',
      metadata: {},
    },
  });

  // Create 5 eligible investors + 1 ineligible
  const investorData = [
    {
      externalRef: 'INV-001',
      legalName: 'Alpine Capital Partners',
      email: 'alpine@example.com',
    },
    {
      externalRef: 'INV-002',
      legalName: 'Bridgewater Associates',
      email: 'bridge@example.com',
    },
    {
      externalRef: 'INV-003',
      legalName: 'Cascade Investment LLC',
      email: 'cascade@example.com',
    },
    {
      externalRef: 'INV-004',
      legalName: 'Dominion Capital Group',
      email: 'dominion@example.com',
    },
    {
      externalRef: 'INV-005',
      legalName: 'Evergreen Holdings Ltd',
      email: 'evergreen@example.com',
    },
    {
      externalRef: 'INV-006',
      legalName: 'Foxglove Ventures',
      email: 'foxglove@example.com',
    },
  ];

  const investors: Array<{ id: string; legalName: string; email: string }> = [];

  for (let i = 0; i < investorData.length; i++) {
    const inv = investorData[i];
    const isEligible = i < 5; // First 5 eligible, 6th is not

    const investor = await prisma.investor.upsert({
      where: { externalRef: inv.externalRef },
      update: {},
      create: {
        externalRef: inv.externalRef,
        legalName: inv.legalName,
        email: inv.email,
        verificationStatus: isEligible ? 'VERIFIED' : 'UNKNOWN',
        verifiedAt: isEligible ? new Date() : null,
        kycStatus: isEligible ? 'APPROVED' : 'PENDING',
        accreditationStatus: isEligible ? 'APPROVED' : 'PENDING',
        metadata: isEligible ? { profileCompleted: true, country: 'US' } : {},
      },
    });

    investors.push({
      id: investor.id,
      legalName: inv.legalName,
      email: inv.email,
    });

    // Real Sepolia wallet addresses — env-driven, with fallbacks
    const defaultAddresses = [
      '0x47F430D7d898F8bf8BB6A89938C066C30a75D326',
      '0xd11B2Ab28610F2E22Db7B51cd26DfF91618f2A5C',
      '0xe552DE75e93Eca51c2b58BC3b0bA6628DC3eadc6',
      '0xBCA2A58A8827C4b6b66Fc08258761951A21f70c7',
      '0x8031B890dd4a302FBF6f1a9E50ce7848DBC3B027',
      '0xaB427a8b61aa17f672D902F593f13Fe8945f1513',
    ];
    const walletAddress =
      process.env[`INVESTOR_${i + 1}_ADDRESS`] || defaultAddresses[i];
    const chainId = 11155111; // Sepolia

    // Delete old wallets for this investor that don't match the realistic address
    const existingWallets = await prisma.wallet.findMany({
      where: { investorId: investor.id },
    });
    for (const ew of existingWallets) {
      if (ew.addressNorm !== walletAddress.toLowerCase()) {
        // Remove eligibilities referencing the old wallet first
        await prisma.investorFundEligibility.deleteMany({
          where: { walletId: ew.id },
        });
        await prisma.wallet.delete({ where: { id: ew.id } });
      }
    }

    const wallet = await prisma.wallet.upsert({
      where: {
        investorId_chainId_addressNorm: {
          investorId: investor.id,
          chainId,
          addressNorm: walletAddress.toLowerCase(),
        },
      },
      update: { address: walletAddress, isPrimary: true },
      create: {
        investorId: investor.id,
        chainId,
        address: walletAddress,
        addressNorm: walletAddress.toLowerCase(),
        isPrimary: true,
        walletStatus: 'ACTIVE',
      },
    });

    // Create fund eligibility for first 5
    if (isEligible) {
      await prisma.investorFundEligibility.upsert({
        where: {
          fundId_walletId_deletedAt_null: {
            fundId: fund.id,
            walletId: wallet.id,
          },
        },
        update: {},
        create: {
          fundId: fund.id,
          investorId: investor.id,
          walletId: wallet.id,
          eligibilityStatus: 'ELIGIBLE',
          effectiveAt: new Date(),
          source: 'SEED',
          metadata: {},
        },
      });
    }
  }

  // Create initial waterfall config
  await prisma.waterfallConfig.upsert({
    where: {
      fundId_version: {
        fundId: fund.id,
        version: '1.0',
      },
    },
    update: {},
    create: {
      fundId: fund.id,
      version: '1.0',
      isActive: true,
      calculationBasis: 'IRR',
      distributionFrequency: 'QUARTERLY',
      catchUpEnabled: false,
      gpPromotePct: new Prisma.Decimal(20),
      prefReturnPct: new Prisma.Decimal(8),
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
      effectiveAt: new Date(),
    },
  });

  // ── Capital Call ──────────────────────────────────────────
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const capitalCall = await prisma.capitalCall.upsert({
    where: { id: 'seed-capital-call-001' },
    update: {},
    create: {
      id: 'seed-capital-call-001',
      fundId: fund.id,
      callNumber: 1,
      amountDue: new Prisma.Decimal(1000000),
      currency: 'USD',
      dueDate,
      wireInstructions:
        'Wire to Angainor Demo Fund I Trust Account, Chase Bank, Routing: 021000021, Account: 123456789',
      status: 'ISSUED',
    },
  });

  // ── Notices (one per eligible investor) ─────────────────
  const eligibleInvestors = investors.slice(0, 5);
  const noticeIds: string[] = [];

  for (let i = 0; i < eligibleInvestors.length; i++) {
    const inv = eligibleInvestors[i];
    const noticeId = `seed-notice-cc-${String(i + 1).padStart(3, '0')}`;
    noticeIds.push(noticeId);

    await prisma.notice.upsert({
      where: { id: noticeId },
      update: {},
      create: {
        id: noticeId,
        fundId: fund.id,
        type: 'CAPITAL_CALL',
        recipientInvestorId: inv.id,
        capitalCallId: capitalCall.id,
        generatedAt: new Date(),
      },
    });
  }

  // ── Notice Deliveries ───────────────────────────────────
  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const deliveryConfigs = [
    // Alpine: VIEWED
    {
      noticeId: noticeIds[0],
      status: 'VIEWED',
      sentAt: daysAgo(2),
      openedAt: daysAgo(1),
      downloadedAt: null,
    },
    // Bridgewater: SENT
    {
      noticeId: noticeIds[1],
      status: 'SENT',
      sentAt: daysAgo(1),
      openedAt: null,
      downloadedAt: null,
    },
    // Cascade: SENT
    {
      noticeId: noticeIds[2],
      status: 'SENT',
      sentAt: daysAgo(1),
      openedAt: null,
      downloadedAt: null,
    },
    // Dominion: GENERATED
    {
      noticeId: noticeIds[3],
      status: 'GENERATED',
      sentAt: null,
      openedAt: null,
      downloadedAt: null,
    },
    // Evergreen: VIEWED + downloaded
    {
      noticeId: noticeIds[4],
      status: 'VIEWED',
      sentAt: daysAgo(3),
      openedAt: daysAgo(2),
      downloadedAt: daysAgo(1),
    },
  ];

  for (let i = 0; i < deliveryConfigs.length; i++) {
    const dc = deliveryConfigs[i];
    const deliveryId = `seed-delivery-${String(i + 1).padStart(3, '0')}`;

    await prisma.noticeDelivery.upsert({
      where: { id: deliveryId },
      update: {},
      create: {
        id: deliveryId,
        noticeId: dc.noticeId,
        status: dc.status,
        sentAt: dc.sentAt,
        openedAt: dc.openedAt,
        downloadedAt: dc.downloadedAt,
      },
    });
  }

  // ── Tax Reports (2025, one per eligible investor) ───────
  const taxData = [
    { ordinaryIncome: 18500, returnOfCapital: 45000, ltcg: 12000, stcg: 3500 },
    { ordinaryIncome: 22000, returnOfCapital: 52000, ltcg: 14500, stcg: 4200 },
    { ordinaryIncome: 15000, returnOfCapital: 40000, ltcg: 8000, stcg: 2000 },
    { ordinaryIncome: 25000, returnOfCapital: 58000, ltcg: 11000, stcg: 4800 },
    { ordinaryIncome: 20000, returnOfCapital: 60000, ltcg: 15000, stcg: 5000 },
  ];

  for (let i = 0; i < eligibleInvestors.length; i++) {
    const inv = eligibleInvestors[i];
    const td = taxData[i];
    const totalDistributions =
      td.ordinaryIncome + td.returnOfCapital + td.ltcg + td.stcg;

    await prisma.taxReport.upsert({
      where: {
        investorId_fundId_taxYear: {
          investorId: inv.id,
          fundId: fund.id,
          taxYear: 2025,
        },
      },
      update: {},
      create: {
        investorId: inv.id,
        fundId: fund.id,
        taxYear: 2025,
        taxEntityName: `${inv.legalName} Trust`,
        ordinaryIncome: new Prisma.Decimal(td.ordinaryIncome),
        returnOfCapital: new Prisma.Decimal(td.returnOfCapital),
        ltcg: new Prisma.Decimal(td.ltcg),
        stcg: new Prisma.Decimal(td.stcg),
        totalDistributions: new Prisma.Decimal(totalDistributions),
      },
    });
  }

  console.log(
    'Seed complete: 1 fund, 6 investors (5 eligible + 1 ineligible), wallets, eligibility, waterfall config, capital call, notices, deliveries, tax reports',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
