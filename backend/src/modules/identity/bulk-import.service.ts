import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../common/event-log.service';
import { ValidationError } from '../../common/errors';

const BCRYPT_ROUNDS = 10;
const DEFAULT_CHAIN_ID = 11155111;

const KYC_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const ACCRED_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const VERIF_VALUES = ['UNKNOWN', 'VERIFIED', 'REVOKED'] as const;
const ELIG_VALUES = ['GRANTED', 'REVOKED', 'NONE'] as const;

const REQUIRED_HEADERS = ['legalname', 'email', 'password'] as const;
const KNOWN_HEADERS = new Set([
  'legalname',
  'email',
  'password',
  'taxid',
  'country',
  'kycstatus',
  'accreditationstatus',
  'verificationstatus',
  'eligibility',
  'walletaddress',
  'chainid',
]);

export type BulkRowStatus = 'CREATED' | 'SKIPPED_DUPLICATE' | 'FAILED';

export interface BulkRowResult {
  rowNumber: number;
  legalName?: string;
  email?: string;
  status: BulkRowStatus;
  investorId?: string;
  message?: string;
}

export interface BulkImportResult {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  rows: BulkRowResult[];
}

interface NormalizedRow {
  rowNumber: number;
  legalName: string;
  email: string;
  password: string;
  taxId?: string;
  country?: string;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accreditationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verificationStatus: 'UNKNOWN' | 'VERIFIED' | 'REVOKED';
  eligibility: 'GRANTED' | 'REVOKED' | 'NONE';
  walletAddress?: string;
  chainId: number;
}

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async importInvestors(
    fundId: string,
    fileBuffer: Buffer,
    actorEmail?: string,
  ): Promise<BulkImportResult> {
    const rawRows = this.parseFile(fileBuffer);
    if (rawRows.length === 0) {
      throw new ValidationError(
        'Bulk import file is empty (no data rows after header).',
      );
    }

    const headers = Object.keys(rawRows[0]).map((h) => h.toLowerCase().trim());
    for (const required of REQUIRED_HEADERS) {
      if (!headers.includes(required)) {
        throw new ValidationError(
          `Bulk import is missing required column: "${required}".`,
        );
      }
    }

    const results: BulkRowResult[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // 1-based, +1 for header row
      const raw = rawRows[i];

      let normalized: NormalizedRow;
      try {
        normalized = this.normalizeRow(raw, rowNumber);
      } catch (err) {
        results.push({
          rowNumber,
          legalName: typeof raw.legalName === 'string' ? raw.legalName : undefined,
          email: typeof raw.email === 'string' ? raw.email : undefined,
          status: 'FAILED',
          message: err instanceof Error ? err.message : 'Invalid row',
        });
        continue;
      }

      try {
        const result = await this.createOne(fundId, normalized);
        results.push(result);
      } catch (err) {
        results.push({
          rowNumber,
          legalName: normalized.legalName,
          email: normalized.email,
          status: 'FAILED',
          message: err instanceof Error ? err.message : 'Insert failed',
        });
      }
    }

    const succeeded = results.filter((r) => r.status === 'CREATED').length;
    const skipped = results.filter(
      (r) => r.status === 'SKIPPED_DUPLICATE',
    ).length;
    const failed = results.filter((r) => r.status === 'FAILED').length;

    await this.eventLog.log({
      eventType: 'INVESTOR_BULK_IMPORTED',
      aggregateType: 'FUND',
      aggregateId: fundId,
      fundId,
      payload: {
        actorEmail,
        total: results.length,
        succeeded,
        skipped,
        failed,
      },
    });

    return {
      total: results.length,
      succeeded,
      skipped,
      failed,
      rows: results,
    };
  }

  private parseFile(buffer: Buffer): Record<string, unknown>[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (err) {
      throw new ValidationError(
        `Bulk import file could not be parsed as CSV or XLSX: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new ValidationError('Bulk import file has no sheets.');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    // Normalize header keys to lowercase
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        const key = k.toLowerCase().trim();
        if (KNOWN_HEADERS.has(key)) {
          out[key] = v;
        }
      }
      return out;
    });
  }

  private normalizeRow(
    raw: Record<string, unknown>,
    rowNumber: number,
  ): NormalizedRow {
    const get = (key: string): string => {
      const v = raw[key];
      return typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
    };

    const legalName = get('legalname');
    const email = get('email').toLowerCase();
    const password = get('password');
    if (!legalName) throw new Error('legalName is required');
    if (!email) throw new Error('email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`email "${email}" is not a valid address`);
    }
    if (!password) throw new Error('password is required');
    if (password.length < 6) {
      throw new Error('password must be at least 6 characters');
    }

    const kycRaw = get('kycstatus').toUpperCase() || 'PENDING';
    if (!KYC_VALUES.includes(kycRaw as (typeof KYC_VALUES)[number])) {
      throw new Error(
        `kycStatus "${kycRaw}" must be one of ${KYC_VALUES.join(', ')}`,
      );
    }
    const accredRaw = get('accreditationstatus').toUpperCase() || 'PENDING';
    if (!ACCRED_VALUES.includes(accredRaw as (typeof ACCRED_VALUES)[number])) {
      throw new Error(
        `accreditationStatus "${accredRaw}" must be one of ${ACCRED_VALUES.join(', ')}`,
      );
    }

    let verifRaw = get('verificationstatus').toUpperCase();
    if (!verifRaw) {
      verifRaw =
        kycRaw === 'APPROVED' && accredRaw === 'APPROVED'
          ? 'VERIFIED'
          : 'UNKNOWN';
    }
    if (!VERIF_VALUES.includes(verifRaw as (typeof VERIF_VALUES)[number])) {
      throw new Error(
        `verificationStatus "${verifRaw}" must be one of ${VERIF_VALUES.join(', ')}`,
      );
    }

    const eligRaw = get('eligibility').toUpperCase() || 'NONE';
    if (!ELIG_VALUES.includes(eligRaw as (typeof ELIG_VALUES)[number])) {
      throw new Error(
        `eligibility "${eligRaw}" must be one of ${ELIG_VALUES.join(', ')}`,
      );
    }

    const wallet = get('walletaddress');
    if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      throw new Error(
        `walletAddress "${wallet}" is not a valid 0x-prefixed 40-char hex address`,
      );
    }

    const chainIdRaw = get('chainid');
    const chainId = chainIdRaw ? parseInt(chainIdRaw, 10) : DEFAULT_CHAIN_ID;
    if (Number.isNaN(chainId) || chainId <= 0) {
      throw new Error(`chainId "${chainIdRaw}" must be a positive integer`);
    }

    return {
      rowNumber,
      legalName,
      email,
      password,
      taxId: get('taxid') || undefined,
      country: get('country') || undefined,
      kycStatus: kycRaw as NormalizedRow['kycStatus'],
      accreditationStatus: accredRaw as NormalizedRow['accreditationStatus'],
      verificationStatus: verifRaw as NormalizedRow['verificationStatus'],
      eligibility: eligRaw as NormalizedRow['eligibility'],
      walletAddress: wallet || undefined,
      chainId,
    };
  }

  private async createOne(
    fundId: string,
    row: NormalizedRow,
  ): Promise<BulkRowResult> {
    const existingAuth = await this.prisma.authUser.findUnique({
      where: { email: row.email },
    });
    const existingInvestor = await this.prisma.investor.findFirst({
      where: {
        OR: [{ email: row.email }, { externalRef: row.email }],
        deletedAt: null,
      },
    });
    if (existingAuth || existingInvestor) {
      return {
        rowNumber: row.rowNumber,
        legalName: row.legalName,
        email: row.email,
        status: 'SKIPPED_DUPLICATE',
        message: 'Email already registered',
      };
    }

    const passwordHash = await bcrypt.hash(row.password, BCRYPT_ROUNDS);
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const authUser = await tx.authUser.create({
        data: {
          email: row.email,
          passwordHash,
          role: 'investor',
          fullName: row.legalName,
          emailVerified: true,
        },
      });

      const investor = await tx.investor.create({
        data: {
          externalRef: row.email,
          legalName: row.legalName,
          email: row.email,
          verificationStatus: row.verificationStatus,
          kycStatus: row.kycStatus,
          accreditationStatus: row.accreditationStatus,
          verifiedAt: row.verificationStatus === 'VERIFIED' ? now : null,
          metadata: {
            profileCompleted: true,
            country: row.country ?? 'US',
            ...(row.taxId ? { taxId: row.taxId } : {}),
            signupSource: 'bulk-import',
          },
        },
      });

      let walletId: string | null = null;
      if (row.walletAddress) {
        const addressNorm = row.walletAddress.toLowerCase();
        const wallet = await tx.wallet.upsert({
          where: {
            investorId_chainId_addressNorm: {
              investorId: investor.id,
              chainId: row.chainId,
              addressNorm,
            },
          },
          create: {
            investorId: investor.id,
            chainId: row.chainId,
            address: row.walletAddress,
            addressNorm,
            isPrimary: true,
            walletStatus: 'ACTIVE',
            walletSource: 'IMPORTED',
          },
          update: {},
        });
        walletId = wallet.id;
      }

      if (
        row.eligibility === 'GRANTED' &&
        walletId &&
        row.kycStatus === 'APPROVED' &&
        row.accreditationStatus === 'APPROVED'
      ) {
        await tx.investorFundEligibility.create({
          data: {
            fundId,
            investorId: investor.id,
            walletId,
            eligibilityStatus: 'ELIGIBLE',
            effectiveAt: now,
            source: 'MANUAL',
            metadata: { via: 'bulk-import' },
          },
        });
      }

      return { authUser, investor };
    });

    await this.eventLog.log({
      eventType: 'INVESTOR_CREATED',
      aggregateType: 'INVESTOR',
      aggregateId: created.investor.id,
      fundId,
      payload: {
        legalName: created.investor.legalName,
        email: created.investor.email,
        via: 'bulk-import',
      },
    });

    return {
      rowNumber: row.rowNumber,
      legalName: row.legalName,
      email: row.email,
      status: 'CREATED',
      investorId: created.investor.id,
    };
  }
}
