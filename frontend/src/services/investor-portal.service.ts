import { get } from './api-client';

// ── Types ──────────────────────────────────────────────────

export interface InvestorDashboard {
  investor: { id: string; legalName: string; email: string; verificationStatus: string };
  fundEligibility: { status: string; effectiveAt: string } | null;
  subscriptions: Array<{
    subscriptionId: string; subscriptionRef: string; allocationPct: string;
    committedAmount: string; status: string; settledAt: string | null;
  }>;
  positions: Array<{
    walletAddress: string; settledTokenBalance: string; ownershipPct: number;
  }>;
  capitalAccount: {
    openingBalance: string; initialContribution: string; capitalReturned: string;
    accruedPref: string; endingCapitalBalance: string;
  } | null;
  summary: {
    totalCommitted: string; totalSettled: string; tokenBalance: string; ownershipPct: number;
  };
}

export interface InvestorSubscription {
  subscriptionId: string; subscriptionRef: string; allocationPct: string;
  committedAmount: string; currency: string; status: string;
  settledAt: string | null; latestSettlementStatus: string | null;
}

export interface InvestorDistribution {
  distributionRunId: string; runStatus: string; asOfTimestamp: string;
  grossAmount: string; netAmount: string; ownershipPctUsed: string;
  currency: string; completedAt: string | null;
}

export interface InvestorTransfer {
  transferRequestId: string; direction: 'sent' | 'received';
  counterpartyAddress: string; tokenAmount: string;
  requestStatus: string; txHash: string | null; timestamp: string;
}

export interface InvestorCapTableRow {
  investorId: string; investorName: string; walletAddress: string;
  settledTokenBalance: string; ownershipPct: number; pendingAllocationPct: string;
}

export interface InvestorCapTable {
  fundId: string; asOfTimestamp: string; rows: InvestorCapTableRow[];
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
  return get<InvestorDistribution[]>(`/investor/me/distributions?fundId=${fundId}`);
}

export function getMyTransfers(fundId = DEFAULT_FUND) {
  return get<InvestorTransfer[]>(`/investor/me/transfers?fundId=${fundId}`);
}

export function getInvestorCapTable(fundId = DEFAULT_FUND) {
  return get<InvestorCapTable>(`/investor/funds/${fundId}/cap-table`);
}
