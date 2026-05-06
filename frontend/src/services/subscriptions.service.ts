import { get, post } from './api-client';

export interface Subscription {
  subscriptionId: string;
  subscriptionRef: string;
  investorId: string;
  investorName: string | null;
  walletId: string;
  allocationPct: number;
  committedAmount: string;
  status: string;
  settledAt: string | null;
  createdAt: string | null;
  governingHashHex: string | null;
  latestSettlementStatus: string | null;
  settlementTxHash: string | null;
  mintTxHash: string | null;
  mintedAt: string | null;
  mintEventId: string | null;
  latestSettlement?: {
    id: string;
    status: string;
    validation: {
      checks: Array<{ name: string; passed: boolean | null }>;
      failureReasonCode: string | null;
    };
  } | null;
}

export interface CreateSubscriptionItem {
  investorId: string;
  walletId: string;
  allocationPct: number;
  committedAmount: string;
  subscriptionRef: string;
}

export interface CreateSubscriptionsResult {
  createdCount: number;
  subscriptions: Array<{ subscriptionId: string; status: string; subscriptionRef: string }>;
}

export function getSubscriptions(fundId: string, status?: string) {
  const query = status ? `?status=${status}` : '';
  return get<Subscription[]>(`/admin/funds/${fundId}/subscriptions${query}`);
}

export function createSubscriptions(
  fundId: string,
  governingDocumentId: string,
  items: CreateSubscriptionItem[],
) {
  return post<CreateSubscriptionsResult>(
    `/admin/funds/${fundId}/subscriptions`,
    { governingDocumentId, items },
  );
}

export interface FundAllocationInvestor {
  investorId: string;
  investorName: string | null;
  investorEmail: string | null;
  totalAllocationPct: number;
  totalCommitted: number;
  settledAllocationPct: number;
  pendingAllocationPct: number;
  subscriptionCount: number;
}

export interface FundAllocation {
  fundId: string;
  fundCapPct: number;
  perInvestorCapPct: number;
  totalAllocationPct: number;
  remainingHeadroomPct: number;
  investors: FundAllocationInvestor[];
}

/**
 * Returns the fund's allocation headroom plus a per-investor breakdown.
 * The Subscriptions page uses this to render "remaining headroom" and to
 * detect when an admin's selected investor already has subs (top-up flow).
 */
export function getFundAllocation(fundId: string) {
  return get<FundAllocation>(`/admin/funds/${fundId}/allocation`);
}
