import { get, upload } from './api-client';
import { downloadBlob } from '@/lib/downloadBlob';

// ── Types (match actual backend response shapes) ────────

export interface InvestorDashboard {
  investor: { id: string; legalName: string; email: string; verificationStatus: string };
  wallets: Array<{ id: string; address: string; chainId: number; isPrimary: boolean; walletStatus: string }>;
  eligibility: Array<{ id: string; eligibilityStatus: string; effectiveAt: string | null; revokedAt: string | null }>;
  subscriptions: Array<{
    id: string; subscriptionRef: string; allocationPct: number;
    committedAmount: string; currency: string; status: string;
    settledAt: string | null; latestSettlementStatus: string | null;
  }>;
  tokenPositions: Array<{
    id: string; walletAddress: string; settledTokenBalance: string;
    ownershipPct: number; asOfBlockNumber: number | null; asOfTimestamp: string | null;
  }>;
  capitalAccount: {
    id: string; openingBalance: string; initialContribution: string;
    capitalReturned: string; accruedPref: string; residualAllocation: string;
    endingCapitalBalance: string; asOfDate: string;
  } | null;
  summary: {
    totalCommitted: string; totalSettled: string;
    tokenBalance: string; ownershipPct: number;
  };
}

export interface InvestorSubscription {
  id: string; subscriptionRef: string; allocationPct: number;
  committedAmount: string; currency: string; status: string;
  settledAt: string | null; createdAt: string;
  latestSettlementStatus: string | null;
  mintTxHash: string | null;
  mintedAt: string | null;
  mintEventId: string | null;
  governingDocument: { id: string; originalFilename: string; documentType: string } | null;
}

export interface InvestorDistributionLineItem {
  id: string; grossAmount: string; netAmount: string; currency: string;
  ownershipPctUsed: number | null;
  prefAmount: string; returnOfCapitalAmount: string; promoteAmount: string;
  tierBreakdown: unknown; createdAt: string;
  run: {
    id: string; runStatus: string; asOfTimestamp: string;
    completedAt: string | null; totalGrossAmount: string | null;
    totalNetAmount: string | null; currency: string;
  };
}

export interface InvestorTransferRequest {
  id: string; fromWalletAddress: string; toWalletAddress: string;
  tokenAmount: string; requestStatus: string;
  precheckPassed: boolean | null; precheckReasonCode: string | null;
  precheckReasonText: string | null;
  submittedTxHash: string | null; submittedAt: string | null;
  finalizedAt: string | null; createdAt: string;
  events: Array<{
    id: string; eventKind: string; txHash: string | null;
    blockNumber: number | null; reasonCode: string | null;
    reasonText: string | null; createdAt: string;
  }>;
}

export interface InvestorCapTableRow {
  investorId: string | null; investorName: string | null; walletAddress: string;
  settledTokenBalance: string; ownershipPct: number; pendingAllocationPct: number;
}

export interface InvestorCapTable {
  fundId: string; fundName: string; asOfTimestamp: string; rows: InvestorCapTableRow[];
}

// ── API calls ──────────────────────────────────────────────

const DEFAULT_FUND = 'ANGAINOR-DEMO-001';

export function getMyDashboard(fundId = DEFAULT_FUND) {
  return get<InvestorDashboard>(`/investor/me/dashboard?fundId=${fundId}`);
}

export function getMySubscriptions(fundId = DEFAULT_FUND) {
  return get<InvestorSubscription[]>(`/investor/me/subscriptions?fundId=${fundId}`);
}

export function getMyDistributions(fundId = DEFAULT_FUND) {
  return get<InvestorDistributionLineItem[]>(`/investor/me/distributions?fundId=${fundId}`);
}

export function getMyTransfers(fundId = DEFAULT_FUND) {
  return get<InvestorTransferRequest[]>(`/investor/me/transfers?fundId=${fundId}`);
}

export function getInvestorCapTable(fundId = DEFAULT_FUND) {
  return get<InvestorCapTable>(`/investor/funds/${fundId}/cap-table`);
}

// ── Capital Account, Documents, Activity, Waterfall ────────

export interface CapitalAccountStatement {
  id: string;
  openingBalance: string;
  initialContribution: string;
  capitalReturned: string;
  accruedPreferredReturn: string;
  residualAllocation: string;
  endingBalance: string;
  asOfDate: string;
}

export interface InvestorDocument {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  status: string;
  downloadable: boolean;
  metadata?: Record<string, unknown>;
}

export interface WaterfallBreakdown {
  waterfallConfig: unknown;
  lineItem?: unknown;
  distributionRun: unknown;
}

export function getInvestorCapitalAccount(fundId: string) {
  return get<CapitalAccountStatement | null>(`/investor/me/capital-account?fundId=${fundId}`);
}

export function getInvestorDocuments(fundId: string) {
  return get<InvestorDocument[]>(`/investor/me/documents?fundId=${fundId}`);
}

export function getInvestorActivityFeed(fundId: string, limit = 50) {
  return get<import('./fund.service').ActivityEvent[]>(`/investor/me/activity-feed?fundId=${fundId}&limit=${limit}`);
}

export function getInvestorWaterfallBreakdown(fundId: string) {
  return get<WaterfallBreakdown | null>(`/investor/me/waterfall-breakdown?fundId=${fundId}`);
}

// ── Uploads, exports, GP reports ───────────────────────────

export interface InvestorUploadResult {
  documentId: string;
  fileName: string;
  byteSize: number;
  uploadedAt: string;
}

export interface InvestorGpReport {
  documentId: string;
  title: string;
  period: string | null;
  fileName: string;
  byteSize: number;
  uploadedAt: string;
}

export interface TaxPackagePreview {
  available: boolean;
  taxYear: number;
  reason?: string;
  report?: {
    taxYear: number;
    taxEntityName: string | null;
    ordinaryIncome: string;
    returnOfCapital: string;
    ltcg: string;
    stcg: string;
    totalDistributions: string;
    generatedAt: string;
    source?: 'TAX_REPORT' | 'DERIVED_LEDGER_PREVIEW';
  };
}

export function uploadInvestorDocument(file: File, fundId = DEFAULT_FUND) {
  return upload<InvestorUploadResult>(
    `/investor/me/documents/upload?fundId=${fundId}`,
    file,
  );
}

export function getInvestorGpReports(fundId = DEFAULT_FUND) {
  return get<InvestorGpReport[]>(`/investor/me/gp-reports?fundId=${fundId}`);
}

export function getInvestorTaxPackagePreview(taxYear: number, fundId = DEFAULT_FUND) {
  return get<TaxPackagePreview>(
    `/investor/me/tax-package/preview?fundId=${fundId}&taxYear=${taxYear}`,
  );
}

export async function exportInvestorTaxPackage(
  taxYear: number,
  format: 'csv' | 'pdf' = 'csv',
  fundId = DEFAULT_FUND,
): Promise<void> {
  await downloadBlob(
    `/investor/me/tax-package/export?fundId=${fundId}&taxYear=${taxYear}&format=${format}`,
    `tax-package-${fundId}-${taxYear}.${format}`,
  );
}

export async function exportCapitalAccount(
  format: 'csv' = 'csv',
  fundId = DEFAULT_FUND,
): Promise<void> {
  await downloadBlob(
    `/investor/me/capital-account/export?fundId=${fundId}&format=${format}`,
    `capital-account-${fundId}-${Date.now()}.${format}`,
  );
}
