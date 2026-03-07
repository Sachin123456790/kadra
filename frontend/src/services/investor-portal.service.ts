import { get } from './api-client';

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

const DEFAULT_FUND = 'KADRA-DEMO-001';

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
