import { get } from './api-client';

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
