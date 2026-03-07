import { get, post } from './api-client';

export interface Subscription {
  subscriptionId: string;
  subscriptionRef: string;
  investorId: string;
  walletId: string;
  allocationPct: number;
  committedAmount: string;
  status: string;
  settledAt: string | null;
  latestSettlementStatus: string | null;
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
