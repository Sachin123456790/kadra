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
