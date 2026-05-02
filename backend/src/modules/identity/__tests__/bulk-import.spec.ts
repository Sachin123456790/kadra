import * as XLSX from 'xlsx';
import { BulkImportService } from '../bulk-import.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { ValidationError } from '../../../common/errors';

const FUND_ID = 'fund-1';

function buildCsv(rows: Array<Record<string, string>>): Buffer {
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? '')).join(','),
    ),
  ];
  return Buffer.from(lines.join('\n'), 'utf8');
}

function buildXlsx(rows: Array<Record<string, string>>): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Investors');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const makePrisma = () => {
  const created: Array<{ email: string; id: string }> = [];

  const tx = {
    authUser: {
      create: jest.fn(async ({ data }: any) => ({
        id: `auth-${data.email}`,
        ...data,
      })),
    },
    investor: {
      create: jest.fn(async ({ data }: any) => {
        const id = `inv-${data.email}`;
        const inv = { id, ...data };
        created.push({ email: data.email, id });
        return inv;
      }),
    },
    wallet: {
      upsert: jest.fn(async ({ create }: any) => ({
        id: `wallet-${create.investorId}`,
        ...create,
      })),
    },
    investorFundEligibility: {
      create: jest.fn(async ({ data }: any) => ({ id: 'elig-1', ...data })),
    },
  };

  const prisma = {
    authUser: {
      findUnique: jest.fn(async ({ where }: any) =>
        created.find((c) => c.email === where.email)
          ? { id: 'existing', email: where.email }
          : null,
      ),
    },
    investor: {
      findFirst: jest.fn(async () => null),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };

  return { prisma, tx, created };
};

describe('BulkImportService', () => {
  let service: BulkImportService;
  let prismaMock: ReturnType<typeof makePrisma>;
  let eventLog: EventLogService;

  beforeEach(() => {
    prismaMock = makePrisma();
    eventLog = { log: jest.fn().mockResolvedValue({}) } as unknown as
      EventLogService;
    service = new BulkImportService(
      prismaMock.prisma as unknown as PrismaService,
      eventLog,
    );
  });

  it('creates investors for a happy-path 3-row CSV', async () => {
    const csv = buildCsv([
      {
        legalName: 'Alpha LLC',
        email: 'alpha@example.com',
        password: 'password1',
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
        eligibility: 'GRANTED',
        walletAddress: '0x' + '1'.repeat(40),
      },
      {
        legalName: 'Beta LLC',
        email: 'beta@example.com',
        password: 'password2',
        kycStatus: 'PENDING',
        accreditationStatus: 'PENDING',
      },
      {
        legalName: 'Gamma LLC',
        email: 'gamma@example.com',
        password: 'password3',
      },
    ]);

    const result = await service.importInvestors(FUND_ID, csv, 'admin@x.io');

    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(prismaMock.tx.investor.create).toHaveBeenCalledTimes(3);
    // Alpha: APPROVED+APPROVED → auto VERIFIED
    const alpha = prismaMock.tx.investor.create.mock.calls.find(
      ([arg]: any) => arg.data.email === 'alpha@example.com',
    );
    expect(alpha[0].data.verificationStatus).toBe('VERIFIED');
    // Eligibility row created for Alpha (has wallet + APPROVED + APPROVED + GRANTED)
    expect(prismaMock.tx.investorFundEligibility.create).toHaveBeenCalledTimes(
      1,
    );
  });

  it('reports duplicate emails as SKIPPED_DUPLICATE', async () => {
    prismaMock.prisma.investor.findFirst = jest.fn(async ({ where }: any) => {
      const target = where.OR?.[0]?.email;
      return target === 'dupe@example.com' ? { id: 'inv-dupe' } : null;
    }) as any;

    const csv = buildCsv([
      {
        legalName: 'Dupe LLC',
        email: 'dupe@example.com',
        password: 'password1',
      },
      {
        legalName: 'New LLC',
        email: 'new@example.com',
        password: 'password2',
      },
    ]);

    const result = await service.importInvestors(FUND_ID, csv);

    expect(result.skipped).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.rows[0].status).toBe('SKIPPED_DUPLICATE');
    expect(result.rows[1].status).toBe('CREATED');
  });

  it('marks rows with invalid status as FAILED', async () => {
    const csv = buildCsv([
      {
        legalName: 'Bad LLC',
        email: 'bad@example.com',
        password: 'password1',
        kycStatus: 'WHATEVER',
      },
    ]);

    const result = await service.importInvestors(FUND_ID, csv);

    expect(result.failed).toBe(1);
    expect(result.rows[0].status).toBe('FAILED');
    expect(result.rows[0].message).toMatch(/kycStatus/);
  });

  it('throws ValidationError when required header is missing', async () => {
    const csv = buildCsv([
      {
        legalName: 'Foo LLC',
        email: 'foo@example.com',
        // no password column
      },
    ]);

    await expect(service.importInvestors(FUND_ID, csv)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('parses XLSX files identically to CSV', async () => {
    const xlsx = buildXlsx([
      {
        legalName: 'Excel LLC',
        email: 'excel@example.com',
        password: 'password1',
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
    ]);

    const result = await service.importInvestors(FUND_ID, xlsx);

    expect(result.succeeded).toBe(1);
    expect(result.rows[0].status).toBe('CREATED');
  });

  it('rejects malformed wallet addresses on the row level', async () => {
    const csv = buildCsv([
      {
        legalName: 'Bad Wallet LLC',
        email: 'bw@example.com',
        password: 'password1',
        walletAddress: '0xnothex',
      },
    ]);

    const result = await service.importInvestors(FUND_ID, csv);

    expect(result.failed).toBe(1);
    expect(result.rows[0].message).toMatch(/walletAddress/);
  });
});
