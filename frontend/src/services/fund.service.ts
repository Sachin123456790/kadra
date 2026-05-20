import { get, post, put } from './api-client';

// ── Response types ─────────────────────────────────────────

export interface FundOverview {
  fundId: string;
  fundName: string;
  status: string;
  legalForm?: string;
  lpCount: number;
  eligibleWalletCount: number;
  pendingSubscriptions: number;
  settledSubscriptions: number;
  targetCommitment: string | null;
  totalCommittedAmount: string;
  totalSettledAmount: string;
  createdAt?: string;
  tokenContract: {
    chainId: number;
    contractAddress: string;
    deploymentStatus: string;
    deployedAt?: string;
  } | null;
}

export interface WaterfallConfig {
  waterfallConfigId: string;
  version: string;
  calculationBasis: string;
  distributionFrequency: string;
  catchUpEnabled: boolean;
  gpPromotePct: number;
  prefReturnPct: number;
  rules: {
    tiers: Array<{
      name: string;
      hurdle: string;
      lpShare: number;
      gpShare: number;
      hurdleValue?: number;
      catchUp?: boolean;
    }>;
  };
}

// ── API calls ──────────────────────────────────────────────

export function getFundOverview(fundId: string) {
  return get<FundOverview>(`/admin/funds/${fundId}/overview`);
}

export function getWaterfallConfig(fundId: string) {
  return get<WaterfallConfig>(`/admin/funds/${fundId}/waterfall-configs/active`);
}

export function createFund(body: {
  fundName: string;
  legalForm: string;
  jurisdiction: string;
}) {
  return post<{ fundId: string }>('/admin/funds', body);
}

export function getFund(fundId: string) {
  return get<FundOverview>(`/admin/funds/${fundId}`);
}

export interface UpdateFundResult {
  fundId: string;
  code: string;
  name: string;
  legalForm: string;
  jurisdictionCode: string | null;
  baseCurrency: string;
  targetCommitment: string | null;
  status: string;
  updatedAt: string;
}

export function updateFund(
  fundId: string,
  body: {
    name?: string;
    legalForm?: string;
    jurisdictionCode?: string;
    targetCommitment?: number;
  },
) {
  return put<UpdateFundResult>(`/admin/funds/${fundId}`, body);
}

// ── Activity Feed ──────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  occurredAt: string;
  txHash: string | null;
  blockNumber: number | null;
}

export function getActivityFeed(fundId: string, limit = 50, offset = 0) {
  return get<ActivityEvent[]>(`/admin/funds/${fundId}/activity-feed?limit=${limit}&offset=${offset}`);
}
