import { post } from './api-client';

export interface DistributionLineItem {
  investorId: string;
  investorName: string;
  walletAddress: string;
  ownershipPctUsed: number;
  grossAmount: string;
  netAmount: string;
  tierBreakdown: Record<string, unknown>;
}

export interface DistributionPreview {
  asOfTimestamp: string;
  summary: { gross: string; currency: string };
  lineItems: DistributionLineItem[];
}

export interface DistributionRunResult {
  distributionRunId: string;
  runStatus: string;
  lineItemCount: number;
}

export function previewDistribution(
  fundId: string,
  input: {
    waterfallConfigId: string;
    asOfTimestamp: string;
    grossDistributableAmount: string;
    currency?: string;
  },
) {
  return post<DistributionPreview>(
    `/admin/funds/${fundId}/distributions/preview`,
    input,
  );
}

export function executeDistribution(
  fundId: string,
  input: {
    waterfallConfigId: string;
    asOfTimestamp: string;
    grossDistributableAmount: string;
    currency?: string;
  },
) {
  return post<DistributionRunResult>(
    `/admin/funds/${fundId}/distributions/runs`,
    input,
  );
}
