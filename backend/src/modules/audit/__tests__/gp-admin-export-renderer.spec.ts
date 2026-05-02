import { renderGpAdminExportPdf } from '../gp-admin-export-renderer';
import type { GpAdminExportInput } from '../gp-admin-export-renderer';

const FIXTURE: GpAdminExportInput = {
  exportPackageId: 'AGN-GPA-20260930-001',
  exportType: 'Consolidated GP/Admin',
  asOfDate: '2026-09-30',
  asOfCutoff: '2026-09-30 17:30:00 UTC',
  generatedTimestamp: '2026-09-30 18:12:44 UTC',
  ledgerSnapshotRef: 'SNAP-20260930-173000-001',
  sourceSet: 'FMS-001 | LPA-001 | CRG-001 | CCS-001 | SEL-001 | TLR-001',
  packageStatus: 'Final',
  fund: {
    fundName: 'Northgate Essential Real Estate Income Fund I, L.P.',
    fundType: 'Closed-end private real estate drawdown fund',
    strategy: 'Core-plus / income-oriented U.S. real estate',
    domicile: 'Delaware, U.S.',
    vintageYear: '2026',
    baseCurrency: 'USD',
    fundSizeAtClose: '$200,000,000',
    targetFundSize: '$500,000,000',
    fundTerm: '10 years + 2 x 1-year extensions',
    investmentPeriod: '4 years',
    managementFee:
      '1.50% on committed capital during investment period; thereafter 1.50% on invested capital',
    preferredReturn: '8.00% annual, non-compounding',
    carriedInterest: '20.00% to GP after return of capital and preferred return',
    waterfallStyle: 'European-style fund-level waterfall',
    capitalCallBasis: 'Pro rata by commitment',
    distributionBasis: 'Pro rata by capital account and waterfall outcome',
    activeLpaVersion: 'v1.0',
    applicableSideLetterSet: 'RED | HAR | SUM',
    waterfallVersion: 'v1.0',
  },
  sideLetters: [
    {
      investor: 'Redwood State Teachers’ Retirement System',
      set: 'RED',
      activeClauses:
        '45-day quarter-end reporting | MFN | enhanced ESG/property exposure',
    },
  ],
  ownership: {
    asOfDate: '2026-09-30',
    snapshotTime: '17:30:00 UTC',
    rows: [
      {
        investorLegalName: 'Redwood State Teachers’ Retirement System',
        type: 'Public pension',
        effectiveHolderDate: '2026-03-31',
        ownershipPct: '25.00%',
        committedCapital: '$50,000,000',
        calledCapital: '$10,000,000',
        cashReceived: '$10,000,000',
        arrears: '$0',
        settlementStatus: 'Settled',
        distributedToDate: '$0',
        futureUncalled: '$40,000,000',
        sideLetterOverride: 'Yes',
      },
      {
        investorLegalName: 'Westbridge Family Office LLC',
        type: 'Family office',
        effectiveHolderDate: '2026-04-15',
        ownershipPct: '12.50%',
        committedCapital: '$25,000,000',
        calledCapital: '$5,000,000',
        cashReceived: '$4,000,000',
        arrears: '$1,000,000',
        settlementStatus: 'Partial / Exception',
        distributedToDate: '$0',
        futureUncalled: '$20,000,000',
        sideLetterOverride: 'No',
        isException: true,
      },
    ],
    totals: {
      ownershipPct: '37.50%',
      committedCapital: '$75,000,000',
      calledCapital: '$15,000,000',
      cashReceived: '$14,000,000',
      arrears: '$1,000,000',
      distributedToDate: '$0',
      futureUncalled: '$60,000,000',
    },
  },
  transfers: [
    {
      effectiveDate: '2026-09-30',
      transferor: 'James Holloway Revocable Trust',
      transferee: 'Cedar Peak Secondary Partners, L.P.',
      requestRef: 'TFR-JHT-001',
      commitmentTransferred: '$5,000,000',
      calledCapitalTransferred: '$1,000,000',
      uncalledTransferred: '$4,000,000',
      gpApproval: 'Approved',
      executionStatus: 'Executed',
      supportingDocSet: 'TFR-JHT-001 | TAA-JHT-CED-001 | GPC-JHT-CED-001',
      resultingHolderChange: 'James 20.0M→15.0M | Cedar 0→5.0M',
    },
  ],
  k1: {
    taxYear: '2026',
    periodThrough: '2026-09-30',
    distributionActivityThroughDate: 'None',
    rows: [
      {
        taxYear: '2026',
        lpLegalTaxEntityName: 'Redwood State Teachers’ Retirement System',
        taxFormRef: 'TAX-RED-001',
        taxIdMasked: '**-***0679',
        beginningCapital: '$0',
        contributionsYtd: '$10,000,000',
        distributionsYtd: '$0',
        endingCapital: '$10,000,000',
        capitalAccountSupportRef: 'CAL-001',
      },
      {
        taxYear: '2026',
        lpLegalTaxEntityName: 'Total',
        taxFormRef: '',
        taxIdMasked: '',
        beginningCapital: '$0',
        contributionsYtd: '$10,000,000',
        distributionsYtd: '$0',
        endingCapital: '$10,000,000',
        capitalAccountSupportRef: '',
        isTotal: true,
      },
    ],
  },
  documentProvenance: [
    {
      documentReferenceId: 'LPA-001',
      category: 'LPA',
      effectiveDate: '2026-02-01',
      anchorTimestamp: '2026-02-01 09:02:51 UTC',
      counterparty: 'Fund',
      displayAnchorHash: 'FD52212B5300',
      fileName: 'NGEIF_I_Executed_LPA_20260201_v1.0.pdf',
      version: 'v1.0',
      operationalUse: 'Governing record',
      linkedExportSections: 'Fund Summary',
    },
  ],
};

describe('renderGpAdminExportPdf', () => {
  it('produces a non-trivial PDF buffer with %PDF magic header', async () => {
    const buffer = await renderGpAdminExportPdf(FIXTURE);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5000);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  }, 15000);

  it('renders even with empty transfer & document arrays', async () => {
    const buffer = await renderGpAdminExportPdf({
      ...FIXTURE,
      transfers: [],
      documentProvenance: [],
      sideLetters: [],
    });
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  }, 15000);
});
