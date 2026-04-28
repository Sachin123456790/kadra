import { get, post, put } from './api-client';
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

export type OnboardingStageKey =
  | 'account'
  | 'profile'
  | 'kyc'
  | 'accreditation'
  | 'wallet'
  | 'eligibility';

export interface OnboardingStage {
  key: OnboardingStageKey;
  order: number;
  label: string;
  state: 'complete' | 'current' | 'pending' | 'blocked';
  actor: 'investor' | 'admin' | 'system';
  hint?: string;
}

export interface OnboardingSummary {
  stages: OnboardingStage[];
  currentStage: OnboardingStageKey | null;
  blockedOn: OnboardingStageKey | null;
  completed: boolean;
  percentComplete: number;
}

export interface Investor {
  investorId: string;
  legalName: string;
  email: string;
  createdAt?: string;
  verificationStatus: string;
  kycStatus?: string;
  accreditationStatus?: string;
  wallets: InvestorWallet[];
  fundEligibility: FundEligibility | null;
  onboarding?: OnboardingSummary;
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
  body: { investorId: string; walletId: string; status: string; reason?: string },
): Promise<ApiResponse<{ eligibilityId: string }>> {
  return put<{ eligibilityId: string }>(
    `/admin/funds/${fundId}/eligibility`,
    body,
  );
}

export interface UpdateVerificationBody {
  verificationStatus?: 'UNKNOWN' | 'VERIFIED' | 'REVOKED';
  kycStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  accreditationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
}

export function updateInvestorVerification(
  investorId: string,
  body: UpdateVerificationBody,
): Promise<ApiResponse<{
  investorId: string;
  verificationStatus: string;
  kycStatus: string | null;
  accreditationStatus: string | null;
}>> {
  return put(`/admin/investors/${investorId}/verification`, body);
}

export function linkInvestorWallet(
  investorId: string,
  walletAddress: string,
  chainId = 11155111,
): Promise<ApiResponse<{ walletId: string }>> {
  return post<{ walletId: string }>(
    `/admin/investors/${investorId}/wallets`,
    { address: walletAddress, chainId },
  );
}

export function updateInvestorEligibility(
  fundId: string,
  body: { investorId: string; walletId: string; status: string; reason?: string },
) {
  return updateEligibility(fundId, body);
}
