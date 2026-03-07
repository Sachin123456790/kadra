import { get } from './api-client';

// ── Response types ─────────────────────────────────────────

export interface FundOverview {
  fundId: string;
  fundName: string;
  status: string;
  lpCount: number;
  eligibleWalletCount: number;
  pendingSubscriptions: number;
  settledSubscriptions: number;
  totalCommittedAmount: string;
  totalSettledAmount: string;
  tokenContract: {
    chainId: number;
    contractAddress: string;
    deploymentStatus: string;
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
