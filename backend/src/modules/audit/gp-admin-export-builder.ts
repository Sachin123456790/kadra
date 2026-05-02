/**
 * Builds GpAdminExportInput from the live Prisma state.
 *
 * Maps the on-disk schema to the institutional export shape described in
 * the calculations spec (Angainor Demo Fund Calculations V2). Where the
 * schema has no field for a given column (e.g. tax form ref, masked TIN,
 * investor entity type), we derive a stable placeholder from immutable
 * inputs (investor id, legal name) so the export is reproducible.
 */

import type { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { createHash } from 'crypto';
import type {
  GpAdminExportInput,
  GpAdminFundSummary,
  K1Row,
  OwnershipRow,
  OwnershipTotals,
  SideLetterRow,
  TransferRow,
  DocumentProvenanceRow,
} from './gp-admin-export-renderer';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '$0';
  return USD.format(Math.round(n));
}

function fmtPct(n: number | null | undefined, fractionDigits = 2): string {
  if (n == null || Number.isNaN(n)) return '0.00%';
  return `${n.toFixed(fractionDigits)}%`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  // 2026-09-30 17:30:00 EDT (UTC offset is fine for demo; institutional readers
  // care about precision more than tz, and EDT is the demo fund's home tz)
  const iso = d.toISOString().replace('T', ' ').slice(0, 19);
  return `${iso} UTC`;
}

function maskTaxId(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  const last4 = hex.slice(-4).toUpperCase();
  return `**-***${last4}`;
}

function taxFormRef(legalName: string): string {
  const slug = legalName
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 3);
  return `TAX-${slug || 'LPP'}-001`;
}

function entityTypeFromMetadata(metadata: unknown, legalName: string): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  if (typeof m.entityType === 'string') return m.entityType;
  if (typeof m.investorType === 'string') return m.investorType;
  if (/insurance/i.test(legalName)) return 'Insurance company';
  if (/endowment/i.test(legalName)) return 'Endowment';
  if (/pension|retirement|teachers/i.test(legalName)) return 'Public pension';
  if (/family.*office|office.*llc/i.test(legalName)) return 'Family office';
  if (/secondary/i.test(legalName)) return 'Secondary buyer';
  if (/trust/i.test(legalName)) return 'Trust investor';
  return 'Limited partner';
}

function shortHash(hex: string | null | undefined): string {
  if (!hex) return '';
  return hex.slice(0, 12).toUpperCase();
}

function todayIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function compactDate(d: Date): string {
  return todayIsoDate(d).replace(/-/g, '');
}

const DOC_CATEGORY: Record<string, string> = {
  MASTER_LPA: 'LPA',
  LPA: 'LPA',
  SIDE_LETTER: 'Side Letter',
  SUBSCRIPTION_AGREEMENT: 'Subscription Agreement',
  WIRE_CONFIRMATION: 'Bank Receipt Confirmation',
  CAPITAL_CALL_NOTICE: 'Capital Call Notice',
  DISTRIBUTION_NOTICE: 'Distribution Notice',
  TRANSFER_NOTICE: 'Transfer Notice',
  TOKEN_MINT_NOTICE: 'Token Mint Notice',
  GENERAL_NOTICE: 'General Notice',
  REPORTING_DOCUMENT: 'Reporting Document',
  GP_REPORT: 'GP Report',
  TAX_FORM: 'Tax Form',
  JOINDER: 'Joinder Agreement',
  ASSIGNMENT_AND_ASSUMPTION: 'Assignment and Assumption',
  GP_CONSENT: 'GP Consent / Approval',
  TRANSFER_REQUEST: 'Transfer Request',
  INVESTOR_UPLOAD: 'Investor Upload',
};

const DOC_OPERATIONAL_USE: Record<string, string> = {
  MASTER_LPA: 'Governing record',
  LPA: 'Governing record',
  SIDE_LETTER: 'Investor override',
  SUBSCRIPTION_AGREEMENT: 'Subscription package',
  WIRE_CONFIRMATION: 'Cash confirmation',
  CAPITAL_CALL_NOTICE: 'Call allocation',
  DISTRIBUTION_NOTICE: 'Distribution evidence',
  TRANSFER_NOTICE: 'Transfer evidence',
  TOKEN_MINT_NOTICE: 'Settlement evidence',
  GENERAL_NOTICE: 'Investor communication',
  REPORTING_DOCUMENT: 'Reporting',
  GP_REPORT: 'Reporting',
  TAX_FORM: 'Tax support',
  JOINDER: 'New holder joinder',
  ASSIGNMENT_AND_ASSUMPTION: 'Executed transfer document',
  GP_CONSENT: 'GP approval',
  TRANSFER_REQUEST: 'Initiating transfer request',
  INVESTOR_UPLOAD: 'Investor upload',
};

const DOC_LINKED_SECTION: Record<string, string> = {
  MASTER_LPA: 'Fund Summary',
  LPA: 'Fund Summary',
  SIDE_LETTER: 'Fund Summary',
  SUBSCRIPTION_AGREEMENT: 'Ownership Snapshot',
  WIRE_CONFIRMATION: 'Ownership Snapshot',
  CAPITAL_CALL_NOTICE: 'Ownership Snapshot',
  DISTRIBUTION_NOTICE: 'K-1 Support',
  TRANSFER_NOTICE: 'Transfer Register',
  TOKEN_MINT_NOTICE: 'Ownership Snapshot',
  GENERAL_NOTICE: 'Fund Summary',
  REPORTING_DOCUMENT: 'Fund Summary',
  GP_REPORT: 'Fund Summary',
  TAX_FORM: 'K-1 Support',
  JOINDER: 'Transfer Register',
  ASSIGNMENT_AND_ASSUMPTION: 'Transfer Register',
  GP_CONSENT: 'Transfer Register',
  TRANSFER_REQUEST: 'Transfer Register',
  INVESTOR_UPLOAD: 'Ownership Snapshot',
};

const DOC_PREFIX: Record<string, string> = {
  MASTER_LPA: 'LPA',
  LPA: 'LPA',
  SIDE_LETTER: 'SLD',
  SUBSCRIPTION_AGREEMENT: 'SUB',
  WIRE_CONFIRMATION: 'BRC',
  CAPITAL_CALL_NOTICE: 'CCN',
  DISTRIBUTION_NOTICE: 'DST',
  TRANSFER_NOTICE: 'TFN',
  TOKEN_MINT_NOTICE: 'TMN',
  GENERAL_NOTICE: 'GEN',
  REPORTING_DOCUMENT: 'REP',
  GP_REPORT: 'GPR',
  TAX_FORM: 'TAX',
  JOINDER: 'JDN',
  ASSIGNMENT_AND_ASSUMPTION: 'TAA',
  GP_CONSENT: 'GPC',
  TRANSFER_REQUEST: 'TFR',
  INVESTOR_UPLOAD: 'IQ',
};

function docReferenceId(
  documentType: string,
  index: number,
  counterparty?: string,
): string {
  const prefix = DOC_PREFIX[documentType] ?? 'DOC';
  const suffix = counterparty
    ? counterparty
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase()
        .slice(0, 3) || String(index).padStart(3, '0')
    : String(index).padStart(3, '0');
  return `${prefix}-${suffix}-${String(index).padStart(3, '0')}`;
}

export async function buildGpAdminExportInput(
  prisma: PrismaService,
  fundId: string,
  asOf: Date = new Date(),
): Promise<GpAdminExportInput> {
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });
  if (!fund) throw new NotFoundError('Fund', fundId);

  const fundMeta = (fund.metadata ?? {}) as Record<string, unknown>;

  const [
    waterfall,
    investors,
    subscriptions,
    capitalCalls,
    capitalCallResponses,
    capitalAccounts,
    transferRequests,
    documents,
    documentHashes,
  ] = await Promise.all([
    prisma.waterfallConfig.findFirst({
      where: { fundId, isActive: true, deletedAt: null },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
    }),
    prisma.investor.findMany({
      where: { eligibilities: { some: { fundId, deletedAt: null } } },
      include: {
        wallets: true,
        eligibilities: { where: { fundId } },
      },
      orderBy: { legalName: 'asc' },
    }),
    prisma.subscription.findMany({
      where: { fundId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.capitalCall.findMany({
      where: { fundId, deletedAt: null },
      orderBy: { callNumber: 'asc' },
    }),
    prisma.capitalCallResponse.findMany({
      where: { capitalCall: { fundId } },
    }),
    prisma.capitalAccount.findMany({
      where: { fundId, isCurrent: true, deletedAt: null },
    }),
    prisma.transferRequest.findMany({
      where: { fundId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        fromWallet: { include: { investor: true } },
        toWallet: { include: { investor: true } },
      },
    }),
    prisma.document.findMany({
      where: { fundId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { hashes: { where: { isPrimary: true } } },
    }),
    prisma.documentHash.findMany({
      where: { document: { fundId } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // ── Fund summary fields ────────────────────────────────────────────────────

  const waterfallTiers = waterfall?.tiers ?? [];
  const carryTier = waterfallTiers.find((t) => Number(t.gpSharePct) > 0);
  const prefRate = waterfall ? Number(waterfall.prefReturnPct ?? 0) : 0;
  const carryPct = carryTier ? Number(carryTier.gpSharePct) : 0;

  const totalCommitted = subscriptions.reduce(
    (s, sub) => s + Number(sub.committedAmount),
    0,
  );

  const fundSummary: GpAdminFundSummary = {
    fundName: fund.name,
    fundType:
      typeof fundMeta.fundType === 'string'
        ? (fundMeta.fundType as string)
        : 'Closed-end private real estate drawdown fund',
    strategy:
      typeof fundMeta.strategy === 'string'
        ? (fundMeta.strategy as string)
        : 'Core-plus / income-oriented U.S. real estate',
    domicile:
      typeof fundMeta.domicile === 'string'
        ? (fundMeta.domicile as string)
        : `${fund.jurisdictionCode ?? 'Delaware'}, U.S.`,
    vintageYear:
      typeof fundMeta.vintageYear === 'string'
        ? (fundMeta.vintageYear as string)
        : String(fund.createdAt.getUTCFullYear()),
    baseCurrency: fund.baseCurrency,
    fundSizeAtClose:
      typeof fundMeta.fundSizeAtClose === 'string'
        ? (fundMeta.fundSizeAtClose as string)
        : fmtUsd(totalCommitted),
    targetFundSize:
      typeof fundMeta.targetFundSize === 'string'
        ? (fundMeta.targetFundSize as string)
        : fmtUsd(totalCommitted * 2.5 || 500_000_000),
    fundTerm:
      typeof fundMeta.fundTerm === 'string'
        ? (fundMeta.fundTerm as string)
        : '10 years + 2 x 1-year extensions',
    investmentPeriod:
      typeof fundMeta.investmentPeriod === 'string'
        ? (fundMeta.investmentPeriod as string)
        : '4 years',
    managementFee:
      typeof fundMeta.managementFee === 'string'
        ? (fundMeta.managementFee as string)
        : '1.50% on committed capital during investment period; thereafter 1.50% on invested capital',
    preferredReturn: `${fmtPct(prefRate, 2)} annual, non-compounding`,
    carriedInterest: `${fmtPct(carryPct, 2)} to GP after return of capital and preferred return`,
    waterfallStyle:
      typeof fundMeta.waterfallStyle === 'string'
        ? (fundMeta.waterfallStyle as string)
        : 'European-style fund-level waterfall',
    capitalCallBasis:
      typeof fundMeta.capitalCallBasis === 'string'
        ? (fundMeta.capitalCallBasis as string)
        : 'Pro rata by commitment',
    distributionBasis:
      typeof fundMeta.distributionBasis === 'string'
        ? (fundMeta.distributionBasis as string)
        : 'Pro rata by capital account and waterfall outcome',
    activeLpaVersion:
      typeof fundMeta.lpaVersion === 'string'
        ? (fundMeta.lpaVersion as string)
        : 'v1.0',
    applicableSideLetterSet:
      investors
        .filter((i) => {
          const m = (i.metadata ?? {}) as Record<string, unknown>;
          return Boolean(m.sideLetter);
        })
        .map((i) => i.legalName.replace(/[^A-Z]/g, '').slice(0, 3) || 'SLD')
        .join(' | ') || '—',
    waterfallVersion: waterfall?.version ?? 'v1.0',
  };

  // ── Side letters ──────────────────────────────────────────────────────────

  const sideLetters: SideLetterRow[] = investors
    .filter((i) =>
      Boolean(((i.metadata ?? {}) as Record<string, unknown>).sideLetter),
    )
    .map((i) => {
      const m = (i.metadata ?? {}) as Record<string, unknown>;
      const setCode = i.legalName.replace(/[^A-Z]/g, '').slice(0, 3) || 'SLD';
      return {
        investor: i.legalName,
        set: setCode,
        activeClauses:
          typeof m.sideLetterClauses === 'string'
            ? (m.sideLetterClauses as string)
            : 'enhanced reporting | MFN',
      };
    });

  // ── Ownership snapshot ────────────────────────────────────────────────────

  const subsByInvestor = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    const list = subsByInvestor.get(sub.investorId) ?? [];
    list.push(sub);
    subsByInvestor.set(sub.investorId, list);
  }

  const calledByInvestor = new Map<string, number>();
  const cashByInvestor = new Map<string, number>();
  for (const call of capitalCalls) {
    if (
      call.status !== 'ISSUED' &&
      call.status !== 'PAID' &&
      call.status !== 'PARTIAL'
    ) {
      continue;
    }
    // Pro-rata share of this call across investors based on allocationPct
    const totalCommitForCall = subscriptions
      .filter((s) => s.status === 'SETTLED' || s.status === 'PENDING')
      .reduce((s, sub) => s + Number(sub.committedAmount), 0);
    if (totalCommitForCall === 0) continue;

    for (const sub of subscriptions) {
      if (sub.status !== 'SETTLED' && sub.status !== 'PENDING') continue;
      const share =
        (Number(sub.committedAmount) / totalCommitForCall) *
        Number(call.amountDue);
      calledByInvestor.set(
        sub.investorId,
        (calledByInvestor.get(sub.investorId) ?? 0) + share,
      );
    }
  }
  for (const resp of capitalCallResponses) {
    cashByInvestor.set(
      resp.investorId,
      (cashByInvestor.get(resp.investorId) ?? 0) + Number(resp.amountReceived),
    );
  }

  const distributedByInvestor = new Map<string, number>();
  const lineItems = await prisma.distributionLineItem.findMany({
    where: { distributionRun: { fundId } },
    include: { distributionRun: true },
  });
  for (const li of lineItems) {
    if (li.distributionRun.chainStatus === 'SIMULATED') continue;
    distributedByInvestor.set(
      li.investorId,
      (distributedByInvestor.get(li.investorId) ?? 0) + Number(li.netAmount),
    );
  }

  const ownershipRows: OwnershipRow[] = investors.map((inv) => {
    const subs = subsByInvestor.get(inv.id) ?? [];
    const committed = subs.reduce(
      (s, sub) => s + Number(sub.committedAmount),
      0,
    );
    const allocPct = subs.reduce((s, sub) => s + Number(sub.allocationPct), 0);
    const earliestSettle = subs
      .filter((s) => s.settledAt)
      .map((s) => s.settledAt!)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const called = calledByInvestor.get(inv.id) ?? 0;
    const cash = cashByInvestor.get(inv.id) ?? 0;
    const arrears = Math.max(0, called - cash);
    const status = subs.every((s) => s.status === 'SETTLED')
      ? arrears > 0
        ? 'Partial / Exception'
        : 'Settled'
      : 'Pending';
    const isException = arrears > 0;
    const m = (inv.metadata ?? {}) as Record<string, unknown>;

    return {
      investorLegalName: inv.legalName,
      type: entityTypeFromMetadata(m, inv.legalName),
      effectiveHolderDate: fmtDate(
        earliestSettle ?? subs[0]?.createdAt ?? null,
      ),
      ownershipPct: fmtPct(allocPct * 100, 2),
      committedCapital: fmtUsd(committed),
      calledCapital: fmtUsd(called),
      cashReceived: fmtUsd(cash),
      arrears: fmtUsd(arrears),
      settlementStatus: status,
      distributedToDate: fmtUsd(distributedByInvestor.get(inv.id) ?? 0),
      futureUncalled: fmtUsd(Math.max(0, committed - called)),
      sideLetterOverride: m.sideLetter ? 'Yes' : 'No',
      isException,
    };
  });

  const totalsRaw = {
    ownershipPct: investors.reduce((s, inv) => {
      const subs = subsByInvestor.get(inv.id) ?? [];
      return s + subs.reduce((ss, sub) => ss + Number(sub.allocationPct), 0);
    }, 0),
    committedCapital: investors.reduce((s, inv) => {
      const subs = subsByInvestor.get(inv.id) ?? [];
      return s + subs.reduce((ss, sub) => ss + Number(sub.committedAmount), 0);
    }, 0),
    calledCapital: Array.from(calledByInvestor.values()).reduce(
      (s, v) => s + v,
      0,
    ),
    cashReceived: Array.from(cashByInvestor.values()).reduce(
      (s, v) => s + v,
      0,
    ),
    arrears: ownershipRows.reduce((s, r) => {
      const num = Number(r.arrears.replace(/[^0-9.-]/g, ''));
      return s + (Number.isFinite(num) ? num : 0);
    }, 0),
    distributedToDate: Array.from(distributedByInvestor.values()).reduce(
      (s, v) => s + v,
      0,
    ),
    futureUncalled: 0,
  };
  totalsRaw.futureUncalled =
    totalsRaw.committedCapital - totalsRaw.calledCapital;

  const totals: OwnershipTotals = {
    ownershipPct: fmtPct(totalsRaw.ownershipPct * 100, 2),
    committedCapital: fmtUsd(totalsRaw.committedCapital),
    calledCapital: fmtUsd(totalsRaw.calledCapital),
    cashReceived: fmtUsd(totalsRaw.cashReceived),
    arrears: fmtUsd(totalsRaw.arrears),
    distributedToDate: fmtUsd(totalsRaw.distributedToDate),
    futureUncalled: fmtUsd(Math.max(0, totalsRaw.futureUncalled)),
  };

  // ── Transfer register ─────────────────────────────────────────────────────

  const transfers: TransferRow[] = transferRequests
    .filter((tr) => tr.requestStatus !== 'REQUESTED')
    .map((tr, idx) => {
      const fromName =
        tr.fromWallet?.investor?.legalName ?? tr.fromWalletAddress.slice(0, 10);
      const toName =
        tr.toWallet?.investor?.legalName ?? tr.toWalletAddress.slice(0, 10);
      const ref = `TFR-${fromName.replace(/[^A-Z]/g, '').slice(0, 3) || 'XXX'}-${String(idx + 1).padStart(3, '0')}`;
      const amount = Number(tr.tokenAmount);
      const status =
        tr.requestStatus === 'MINED'
          ? 'Executed'
          : tr.requestStatus === 'PRECHECK_FAILED' ||
              tr.requestStatus === 'CHAIN_REVERTED'
            ? 'Rejected'
            : 'Submitted';
      const gp = tr.requestStatus === 'MINED' ? 'Approved' : 'Pending';
      return {
        effectiveDate: fmtDate(
          tr.finalizedAt ?? tr.submittedAt ?? tr.createdAt,
        ),
        transferor: fromName,
        transferee: toName,
        requestRef: ref,
        commitmentTransferred: fmtUsd(amount),
        calledCapitalTransferred: fmtUsd(amount * 0.2),
        uncalledTransferred: fmtUsd(amount * 0.8),
        gpApproval: gp,
        executionStatus: status,
        supportingDocSet: `${ref} | TAA-${idx + 1} | GPC-${idx + 1}`,
        resultingHolderChange: `${fromName.split(' ')[0]} → ${toName.split(' ')[0]}`,
      };
    });

  // ── K-1 capital account support ───────────────────────────────────────────

  const capAccByInvestor = new Map(
    capitalAccounts.map((c) => [c.investorId, c]),
  );
  const taxYear = String(asOf.getUTCFullYear());
  const k1Rows: K1Row[] = investors.map((inv) => {
    const cap = capAccByInvestor.get(inv.id);
    const beginning = Number(cap?.openingBalance ?? 0);
    const contributions = Number(cap?.initialContribution ?? 0);
    const distributed = distributedByInvestor.get(inv.id) ?? 0;
    const ending = Number(
      cap?.endingCapitalBalance ?? beginning + contributions - distributed,
    );
    return {
      taxYear,
      lpLegalTaxEntityName: inv.legalName,
      taxFormRef: taxFormRef(inv.legalName),
      taxIdMasked: maskTaxId(inv.id),
      beginningCapital: fmtUsd(beginning),
      contributionsYtd: fmtUsd(contributions),
      distributionsYtd: fmtUsd(distributed),
      endingCapital: fmtUsd(ending),
      capitalAccountSupportRef: 'CAL-001',
    };
  });

  const k1Totals: K1Row = {
    taxYear,
    lpLegalTaxEntityName: 'Total',
    taxFormRef: '',
    taxIdMasked: '',
    beginningCapital: fmtUsd(
      investors.reduce(
        (s, inv) =>
          s + Number(capAccByInvestor.get(inv.id)?.openingBalance ?? 0),
        0,
      ),
    ),
    contributionsYtd: fmtUsd(
      investors.reduce(
        (s, inv) =>
          s + Number(capAccByInvestor.get(inv.id)?.initialContribution ?? 0),
        0,
      ),
    ),
    distributionsYtd: fmtUsd(
      Array.from(distributedByInvestor.values()).reduce((s, v) => s + v, 0),
    ),
    endingCapital: fmtUsd(
      investors.reduce(
        (s, inv) =>
          s + Number(capAccByInvestor.get(inv.id)?.endingCapitalBalance ?? 0),
        0,
      ),
    ),
    capitalAccountSupportRef: '',
    isTotal: true,
  };

  // ── Document provenance ──────────────────────────────────────────────────

  const hashByDocId = new Map<string, (typeof documentHashes)[0]>();
  for (const h of documentHashes) {
    if (h.isPrimary) hashByDocId.set(h.documentId, h);
  }

  const documentProvenance: DocumentProvenanceRow[] = documents.map(
    (d, idx) => {
      const docType = d.documentType;
      const dm = (d.metadata ?? {}) as Record<string, unknown>;
      const counterparty =
        (typeof dm.counterparty === 'string' && (dm.counterparty as string)) ||
        (typeof dm.investor === 'string' && (dm.investor as string)) ||
        'Fund';
      const hash = d.hashes?.[0] ?? hashByDocId.get(d.id);
      return {
        documentReferenceId: docReferenceId(docType, idx + 1, counterparty),
        category: DOC_CATEGORY[docType] ?? docType,
        effectiveDate: fmtDate(d.createdAt),
        anchorTimestamp: hash?.anchorConfirmedAt
          ? fmtDateTime(hash.anchorConfirmedAt)
          : fmtDateTime(d.createdAt),
        counterparty,
        displayAnchorHash: shortHash(hash?.hashHex),
        fileName: d.originalFilename,
        version: 'v1.0',
        operationalUse: DOC_OPERATIONAL_USE[docType] ?? '—',
        linkedExportSections: DOC_LINKED_SECTION[docType] ?? 'Fund Summary',
      };
    },
  );

  // ── Top-level metadata ───────────────────────────────────────────────────

  const exportPackageId = `AGN-GPA-${compactDate(asOf)}-001`;
  const ledgerSnapshotRef = `SNAP-${compactDate(asOf)}-${asOf
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, '')
    .slice(0, 6)}-001`;
  const sourceSet = [
    'FMS-001',
    'LPA-001',
    'CRG-001',
    'CCS-001',
    'SEL-001',
    'TLR-001',
  ].join(' | ');

  return {
    exportPackageId,
    exportType: 'Consolidated GP/Admin',
    asOfDate: todayIsoDate(asOf),
    asOfCutoff: `${todayIsoDate(asOf)} 17:30:00 UTC`,
    generatedTimestamp: fmtDateTime(asOf),
    ledgerSnapshotRef,
    sourceSet,
    packageStatus: 'Final',
    fund: fundSummary,
    sideLetters,
    ownership: {
      asOfDate: todayIsoDate(asOf),
      snapshotTime: '17:30:00 UTC',
      rows: ownershipRows,
      totals,
    },
    transfers,
    k1: {
      taxYear,
      periodThrough: todayIsoDate(asOf),
      distributionActivityThroughDate:
        lineItems.length > 0 ? todayIsoDate(asOf) : 'None',
      rows: [...k1Rows, k1Totals],
    },
    documentProvenance,
  };
}
