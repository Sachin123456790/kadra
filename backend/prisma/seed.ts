import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create demo fund
  const fund = await prisma.fund.upsert({
    where: { code: 'KADRA-DEMO-001' },
    update: {},
    create: {
      code: 'KADRA-DEMO-001',
      name: 'Kadra Demo Fund I',
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
        metadata: {},
      },
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
        chainId_addressNorm: {
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

  console.log(
    'Seed complete: 1 fund, 6 investors (5 eligible + 1 ineligible), wallets, eligibility, waterfall config',
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
