/**
 * Renders the institutional GP/Admin Export PDF.
 *
 * Layout matches the reference document
 * (see Angainor GP-Admin Export - 2026-09-30.pdf):
 *   - Top-left wordmark on page 1, right-aligned page header on every page.
 *   - "GP / ADMIN EXPORT" title block + 4-row metadata table on page 1.
 *   - Five sections, each opened by a black banner header:
 *       1. Fund summary / governing logic (4-col KV table + 2-col KV table
 *          for prose fields + side-letter table)
 *       2. Ownership snapshot (12-col table with totals row, optional
 *          highlighted exception row)
 *       3. Transfer register (10-col table)
 *       4. K-1-ready capital account support (9-col table + totals row)
 *       5. Document provenance (10-col table)
 *   - Footer on every page: "Export ID  AGN-GPA-YYYYMMDD-001  |  Page N".
 */

import type {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
  TableCell,
} from 'pdfmake/interfaces';
import { createPdfBuffer } from '../../common/pdfmake-printer';

// ── Input types ──────────────────────────────────────────────────────────────

export interface GpAdminFundSummary {
  fundName: string;
  fundType: string;
  strategy: string;
  domicile: string;
  vintageYear: string;
  baseCurrency: string;
  fundSizeAtClose: string;
  targetFundSize: string;
  fundTerm: string;
  investmentPeriod: string;
  managementFee: string;
  preferredReturn: string;
  carriedInterest: string;
  waterfallStyle: string;
  capitalCallBasis: string;
  distributionBasis: string;
  activeLpaVersion: string;
  applicableSideLetterSet: string;
  waterfallVersion: string;
}

export interface SideLetterRow {
  investor: string;
  set: string;
  activeClauses: string;
}

export interface OwnershipRow {
  investorLegalName: string;
  type: string;
  effectiveHolderDate: string;
  ownershipPct: string;
  committedCapital: string;
  calledCapital: string;
  cashReceived: string;
  arrears: string;
  settlementStatus: string;
  distributedToDate: string;
  futureUncalled: string;
  sideLetterOverride: string;
  isException?: boolean;
}

export interface OwnershipTotals {
  ownershipPct: string;
  committedCapital: string;
  calledCapital: string;
  cashReceived: string;
  arrears: string;
  distributedToDate: string;
  futureUncalled: string;
}

export interface TransferRow {
  effectiveDate: string;
  transferor: string;
  transferee: string;
  requestRef: string;
  commitmentTransferred: string;
  calledCapitalTransferred: string;
  uncalledTransferred: string;
  gpApproval: string;
  executionStatus: string;
  supportingDocSet: string;
  resultingHolderChange: string;
}

export interface K1Row {
  taxYear: string;
  lpLegalTaxEntityName: string;
  taxFormRef: string;
  taxIdMasked: string;
  beginningCapital: string;
  contributionsYtd: string;
  distributionsYtd: string;
  endingCapital: string;
  capitalAccountSupportRef: string;
  isTotal?: boolean;
}

export interface DocumentProvenanceRow {
  documentReferenceId: string;
  category: string;
  effectiveDate: string;
  anchorTimestamp: string;
  counterparty: string;
  displayAnchorHash: string;
  fileName: string;
  version: string;
  operationalUse: string;
  linkedExportSections: string;
}

export interface GpAdminExportInput {
  exportPackageId: string;
  exportType: string;
  asOfDate: string;
  asOfCutoff: string;
  generatedTimestamp: string;
  ledgerSnapshotRef: string;
  sourceSet: string;
  packageStatus: string;

  fund: GpAdminFundSummary;
  sideLetters: ReadonlyArray<SideLetterRow>;

  ownership: {
    asOfDate: string;
    snapshotTime: string;
    rows: ReadonlyArray<OwnershipRow>;
    totals: OwnershipTotals;
  };

  transfers: ReadonlyArray<TransferRow>;

  k1: {
    taxYear: string;
    periodThrough: string;
    distributionActivityThroughDate: string;
    rows: ReadonlyArray<K1Row>;
  };

  documentProvenance: ReadonlyArray<DocumentProvenanceRow>;
}

// ── Style dictionary ─────────────────────────────────────────────────────────

const COLOR_INK = '#0a0a0a';
const COLOR_MUTED = '#6b7280';
const COLOR_BODY = '#374151';
const COLOR_GRID_BG = '#f3f4f6';
const COLOR_EXCEPTION_BG = '#fef3c7';

const STYLES: StyleDictionary = {
  pageHeaderRight: { fontSize: 9, color: COLOR_MUTED },
  wordmark: { fontSize: 22, color: COLOR_INK, characterSpacing: 0.5 },
  title: { fontSize: 26, bold: true, color: COLOR_INK },
  subtitle: { fontSize: 11, color: COLOR_BODY },
  sectionBanner: { fontSize: 11, bold: true, color: '#ffffff' },
  asOfCaption: { fontSize: 9, color: COLOR_BODY },
  th: { bold: true, fontSize: 9, color: COLOR_INK, fillColor: COLOR_GRID_BG },
  thCenter: {
    bold: true,
    fontSize: 9,
    color: COLOR_INK,
    fillColor: COLOR_GRID_BG,
    alignment: 'center',
  },
  td: { fontSize: 9, color: COLOR_INK },
  tdCenter: { fontSize: 9, color: COLOR_INK, alignment: 'center' },
  tdRight: { fontSize: 9, color: COLOR_INK, alignment: 'right' },
  tdMono: { fontSize: 9, font: 'Courier', color: COLOR_INK },
  totalRow: { bold: true, fontSize: 9 },
  totalRowRight: { bold: true, fontSize: 9, alignment: 'right' },
  exceptionCell: {
    fontSize: 9,
    color: COLOR_INK,
    fillColor: COLOR_EXCEPTION_BG,
    alignment: 'center',
  },
  metaLabel: { bold: true, fontSize: 9 },
  metaValue: { fontSize: 9 },
  footerLeft: { fontSize: 9, color: COLOR_BODY },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sectionBanner(text: string): Content {
  return {
    margin: [0, 16, 0, 8],
    table: {
      widths: ['*'],
      body: [
        [
          {
            text,
            style: 'sectionBanner',
            fillColor: COLOR_INK,
            margin: [10, 6, 10, 6],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
}

function kvRow(l1: string, v1: string, l2: string, v2: string): TableCell[] {
  return [
    { text: l1, style: 'metaLabel' },
    { text: v1, style: 'metaValue' },
    { text: l2, style: 'metaLabel' },
    { text: v2, style: 'metaValue' },
  ];
}

function metaTable(rows: TableCell[][]): Content {
  return {
    margin: [0, 4, 0, 12],
    table: {
      widths: [100, '*', 100, '*'],
      body: rows,
    },
    layout: 'lightHorizontalLines',
  };
}

function twoColTable(rows: Array<[string, string]>): Content {
  return {
    margin: [0, 0, 0, 12],
    table: {
      widths: [180, '*'],
      body: rows.map(([l, v]) => [
        { text: l, style: 'metaLabel' },
        { text: v, style: 'metaValue' },
      ]),
    },
    layout: 'lightHorizontalLines',
  };
}

const TABLE_LAYOUT_GRID = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#d1d5db',
  vLineColor: () => '#d1d5db',
  paddingLeft: () => 3,
  paddingRight: () => 3,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

function dataTable(
  widths: (number | string)[],
  header: TableCell[],
  body: TableCell[][],
  headerRows = 1,
): Content {
  return {
    margin: [0, 4, 0, 12],
    table: {
      headerRows,
      widths,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
      body: [header, ...body],
    },
    layout: TABLE_LAYOUT_GRID,
  };
}

// ── Section builders ─────────────────────────────────────────────────────────

function buildHeaderBlock(input: GpAdminExportInput): Content[] {
  return [
    {
      margin: [0, 32, 0, 8],
      text: 'angainor',
      style: 'wordmark',
    },
    { text: 'GP / ADMIN EXPORT', style: 'title', margin: [0, 16, 0, 4] },
    { text: input.fund.fundName, style: 'subtitle', margin: [0, 0, 0, 12] },
    metaTable([
      kvRow(
        'Export package ID',
        input.exportPackageId,
        'Export type',
        input.exportType,
      ),
      kvRow('As-of date', input.asOfDate, 'As-of cut-off', input.asOfCutoff),
      kvRow(
        'Generated timestamp',
        input.generatedTimestamp,
        'Ledger snapshot ref',
        input.ledgerSnapshotRef,
      ),
      kvRow(
        'Source set',
        input.sourceSet,
        'Package status',
        input.packageStatus,
      ),
    ]),
  ];
}

function buildFundSummary(input: GpAdminExportInput): Content[] {
  const f = input.fund;
  return [
    sectionBanner('FUND SUMMARY / GOVERNING LOGIC'),
    {
      margin: [0, 0, 0, 0],
      table: {
        widths: [100, '*', 100, '*'],
        body: [
          kvRow('Fund name', f.fundName, 'Fund type', f.fundType),
          kvRow('Strategy', f.strategy, 'Domicile', f.domicile),
          kvRow('Vintage year', f.vintageYear, 'Base currency', f.baseCurrency),
          kvRow(
            'Fund size at close',
            f.fundSizeAtClose,
            'Target fund size',
            f.targetFundSize,
          ),
          kvRow(
            'Fund term',
            f.fundTerm,
            'Investment period',
            f.investmentPeriod,
          ),
        ],
      },
      layout: 'lightHorizontalLines',
    },
    { text: '', margin: [0, 0, 0, 8] },
    twoColTable([
      ['Management fee', f.managementFee],
      ['Preferred return', f.preferredReturn],
      ['Carried interest', f.carriedInterest],
      ['Waterfall style', f.waterfallStyle],
      ['Capital call basis', f.capitalCallBasis],
      ['Distribution basis', f.distributionBasis],
      ['Active LPA version', f.activeLpaVersion],
      ['Applicable side-letter set', f.applicableSideLetterSet],
      ['Waterfall version', f.waterfallVersion],
    ]),
    input.sideLetters.length > 0
      ? dataTable(
          ['*', 80, '*'],
          [
            { text: 'Investor', style: 'th' },
            { text: 'Set', style: 'th' },
            { text: 'Active clauses', style: 'th' },
          ],
          input.sideLetters.map((r) => [
            { text: r.investor, style: 'td' },
            { text: r.set, style: 'tdCenter' },
            { text: r.activeClauses, style: 'td' },
          ]),
        )
      : { text: '' },
  ];
}

function buildOwnershipSnapshot(input: GpAdminExportInput): Content[] {
  // 12 cols. Landscape Letter usable inner width ~640pt after cell padding.
  const widths = [80, 50, 46, 38, 60, 52, 52, 44, 52, 48, 56, 36];
  const header: TableCell[] = [
    'Investor legal name',
    'Type',
    'Effective holder date',
    'Ownership %',
    'Committed capital',
    'Called capital',
    'Cash received',
    'Arrears',
    'Settlement status',
    'Distributed to date',
    'Future uncalled',
    'Side-letter / override',
  ].map((t) => ({ text: t, style: 'thCenter' }));

  const body = input.ownership.rows.map((r) => {
    const settlementCell: TableCell = r.isException
      ? { text: r.settlementStatus, style: 'exceptionCell' }
      : { text: r.settlementStatus, style: 'tdCenter' };
    const arrearsCell: TableCell = r.isException
      ? { text: r.arrears, style: 'exceptionCell' }
      : { text: r.arrears, style: 'tdRight' };
    return [
      { text: r.investorLegalName, style: 'td' },
      { text: r.type, style: 'td' },
      { text: r.effectiveHolderDate, style: 'tdCenter' },
      { text: r.ownershipPct, style: 'tdRight' },
      { text: r.committedCapital, style: 'tdRight' },
      { text: r.calledCapital, style: 'tdRight' },
      { text: r.cashReceived, style: 'tdRight' },
      arrearsCell,
      settlementCell,
      { text: r.distributedToDate, style: 'tdRight' },
      { text: r.futureUncalled, style: 'tdRight' },
      { text: r.sideLetterOverride, style: 'tdCenter' },
    ];
  });

  const t = input.ownership.totals;
  const totalRow: TableCell[] = [
    { text: 'Total', style: 'totalRow' },
    { text: '', style: 'td' },
    { text: '', style: 'td' },
    { text: t.ownershipPct, style: 'totalRowRight' },
    { text: t.committedCapital, style: 'totalRowRight' },
    { text: t.calledCapital, style: 'totalRowRight' },
    { text: t.cashReceived, style: 'totalRowRight' },
    { text: t.arrears, style: 'totalRowRight' },
    { text: '', style: 'td' },
    { text: t.distributedToDate, style: 'totalRowRight' },
    { text: t.futureUncalled, style: 'totalRowRight' },
    { text: '', style: 'td' },
  ];

  return [
    sectionBanner('OWNERSHIP SNAPSHOT'),
    {
      text: `As-of-date  ${input.ownership.asOfDate}    |    Snapshot time  ${input.ownership.snapshotTime}`,
      style: 'asOfCaption',
      margin: [0, 0, 0, 6],
    },
    dataTable(widths, header, [...body, totalRow]),
  ];
}

function buildTransferRegister(input: GpAdminExportInput): Content[] {
  // 11 cols. usable inner width ~646pt.
  const widths = [54, 68, 68, 54, 56, 56, 52, 38, 46, 90, 60];
  const header: TableCell[] = [
    'Transfer effective date',
    'Transferor',
    'Transferee',
    'Request ref',
    'Commitment transferred',
    'Called capital transferred',
    'Uncalled transferred',
    'GP approval',
    'Execution status',
    'Supporting document set',
    'Resulting holder change',
  ].map((t) => ({ text: t, style: 'thCenter' }));

  const body = input.transfers.map((r) => [
    { text: r.effectiveDate, style: 'tdCenter' },
    { text: r.transferor, style: 'td' },
    { text: r.transferee, style: 'td' },
    { text: r.requestRef, style: 'tdMono' },
    { text: r.commitmentTransferred, style: 'tdRight' },
    { text: r.calledCapitalTransferred, style: 'tdRight' },
    { text: r.uncalledTransferred, style: 'tdRight' },
    { text: r.gpApproval, style: 'tdCenter' },
    { text: r.executionStatus, style: 'tdCenter' },
    { text: r.supportingDocSet, style: 'tdMono' },
    { text: r.resultingHolderChange, style: 'td' },
  ]);

  return [
    sectionBanner('TRANSFER REGISTER'),
    body.length > 0
      ? dataTable(widths, header, body)
      : {
          text: 'No transfers executed during the reporting period.',
          style: 'asOfCaption',
          margin: [0, 4, 0, 12],
        },
  ];
}

function buildK1Support(input: GpAdminExportInput): Content[] {
  // 9 cols. usable inner width ~658pt.
  const widths = [44, 120, 70, 64, 66, 72, 72, 72, 78];
  const header: TableCell[] = [
    'Tax year',
    'LP legal tax entity name',
    'Tax form ref',
    'Tax ID ref (masked)',
    'Beginning capital',
    'Contributions YTD',
    'Distributions YTD',
    'Ending capital',
    'Capital account support ref',
  ].map((t) => ({ text: t, style: 'thCenter' }));

  const body = input.k1.rows.map((r) => {
    if (r.isTotal) {
      return [
        { text: r.taxYear, style: 'totalRow' },
        { text: r.lpLegalTaxEntityName, style: 'totalRow' },
        { text: '', style: 'td' },
        { text: '', style: 'td' },
        { text: r.beginningCapital, style: 'totalRowRight' },
        { text: r.contributionsYtd, style: 'totalRowRight' },
        { text: r.distributionsYtd, style: 'totalRowRight' },
        { text: r.endingCapital, style: 'totalRowRight' },
        { text: '', style: 'td' },
      ];
    }
    return [
      { text: r.taxYear, style: 'tdCenter' },
      { text: r.lpLegalTaxEntityName, style: 'td' },
      { text: r.taxFormRef, style: 'tdMono' },
      { text: r.taxIdMasked, style: 'tdMono' },
      { text: r.beginningCapital, style: 'tdRight' },
      { text: r.contributionsYtd, style: 'tdRight' },
      { text: r.distributionsYtd, style: 'tdRight' },
      { text: r.endingCapital, style: 'tdRight' },
      { text: r.capitalAccountSupportRef, style: 'tdMono' },
    ];
  });

  return [
    sectionBanner('K-1-READY CAPITAL ACCOUNT SUPPORT'),
    {
      text: `Tax year  ${input.k1.taxYear}    |    Period through  ${input.k1.periodThrough}    |    Distribution activity through date  ${input.k1.distributionActivityThroughDate}`,
      style: 'asOfCaption',
      margin: [0, 0, 0, 6],
    },
    dataTable(widths, header, body),
  ];
}

function buildDocumentProvenance(input: GpAdminExportInput): Content[] {
  // 10 cols. usable inner width ~652pt; file name gets the bulk of the slack.
  const widths = [62, 64, 50, 70, 56, 68, 120, 32, 56, 60];
  const header: TableCell[] = [
    'Document reference ID',
    'Category',
    'Effective date',
    'Anchor timestamp',
    'Counterparty / entity',
    'Display anchor / hash',
    'File name',
    'Version',
    'Operational use',
    'Linked export section(s)',
  ].map((t) => ({ text: t, style: 'thCenter' }));

  const body = input.documentProvenance.map((r) => [
    { text: r.documentReferenceId, style: 'tdMono' },
    { text: r.category, style: 'td' },
    { text: r.effectiveDate, style: 'tdCenter' },
    { text: r.anchorTimestamp, style: 'tdCenter' },
    { text: r.counterparty, style: 'td' },
    { text: r.displayAnchorHash, style: 'tdMono' },
    { text: r.fileName, style: 'tdMono' },
    { text: r.version, style: 'tdCenter' },
    { text: r.operationalUse, style: 'td' },
    { text: r.linkedExportSections, style: 'td' },
  ]);

  return [
    sectionBanner('DOCUMENT PROVENANCE'),
    body.length > 0
      ? dataTable(widths, header, body)
      : {
          text: 'No anchored documents available.',
          style: 'asOfCaption',
          margin: [0, 4, 0, 12],
        },
  ];
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function renderGpAdminExportPdf(
  input: GpAdminExportInput,
): Promise<Buffer> {
  const content: Content[] = [
    ...buildHeaderBlock(input),
    ...buildFundSummary(input),
    ...buildOwnershipSnapshot(input),
    ...buildTransferRegister(input),
    ...buildK1Support(input),
    ...buildDocumentProvenance(input),
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [40, 56, 40, 48],
    defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.25 },
    styles: STYLES,
    header: () => ({
      text: 'Angainor GP/Admin Export',
      alignment: 'right',
      margin: [40, 24, 40, 0],
      style: 'pageHeaderRight',
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 12, 40, 0],
      columns: [
        {
          text: [
            { text: 'Export ID  ', style: 'footerLeft' },
            {
              text: input.exportPackageId,
              style: 'footerLeft',
              font: 'Courier',
            },
            { text: '    |    Page ', style: 'footerLeft' },
            { text: String(currentPage), style: 'footerLeft', bold: true },
            ...(pageCount > 1
              ? [{ text: ` of ${pageCount}`, style: 'footerLeft' as const }]
              : []),
          ],
          alignment: 'left',
        },
      ],
    }),
    content,
  };

  return createPdfBuffer(docDefinition);
}
