import { get, post } from './api-client';

// ── Types ──────────────────────────────────────────────────

export interface InvestorProfile {
  authUserId: string;
  investorId: string;
  legalName: string;
  email: string;
  verificationStatus: string;
  walletCount: number;
}

export interface LinkedWallet {
  walletId: string;
  address: string;
  chainId: number;
  isPrimary: boolean;
  walletStatus: string;
  label: string | null;
}

export interface WalletChallenge {
  challengeId: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface WalletLinkResult {
  walletId: string;
  investorId: string;
  address: string;
  chainId: number;
  walletStatus: string;
}

// ── API calls ──────────────────────────────────────────────

export function getMyProfile() {
  return get<InvestorProfile>('/investor/me/profile');
}

export function getMyWallets() {
  return get<LinkedWallet[]>('/investor/me/wallets');
}

export function createWalletChallenge(body: { address: string; chainId: number }) {
  return post<WalletChallenge>('/investor/me/wallet-link/challenge', body);
}

export function verifyWalletLink(body: { challengeId: string; address: string; chainId: number; signature: string }) {
  return post<WalletLinkResult>('/investor/me/wallets/verify', body);
}
