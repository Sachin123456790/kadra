import { get, post } from './api-client';
import type { ApiResponse } from './api-client';

export interface InvestorWallet {
  walletId: string;
  address: string;
  chainId: number;
  isPrimary: boolean;
  status: string;
}

export interface FundEligibility {
  eligibilityId: string;
  status: string;
  effectiveAt: string;
}

export interface Investor {
  investorId: string;
  legalName: string;
  email: string;
  verificationStatus: string;
  wallets: InvestorWallet[];
  fundEligibility: FundEligibility | null;
}

export function getInvestors(fundId: string) {
  return get<Investor[]>(`/admin/funds/${fundId}/investors`);
}

export function createInvestor(body: {
  legalName: string;
  email: string;
  taxId?: string;
}) {
  return post<{ investorId: string }>('/admin/investors', body);
}

export function linkWallet(
  investorId: string,
  body: { address: string; chainId: number },
) {
  return post<{ walletId: string }>(
    `/admin/investors/${investorId}/wallets`,
    body,
  );
}

export function updateEligibility(
  fundId: string,
  body: { investorId: string; status: string },
): Promise<ApiResponse<{ eligibilityId: string }>> {
  // Uses PUT semantics but the api-client only exposes post; the backend
  // accepts POST on this endpoint as well.
  return post<{ eligibilityId: string }>(
    `/admin/funds/${fundId}/eligibility`,
    body,
  );
}
