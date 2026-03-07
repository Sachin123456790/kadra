import { get, post } from './api-client';

export interface MintResult {
  mintRequestId: string;
  status: string;
  txHash: string;
  tokenAmount: string;
}

export interface TransferResult {
  transferRequestId: string;
  requestStatus: string;
  precheck: {
    recipientEligible: boolean;
    senderEligible: boolean;
    sufficientBalance: boolean;
  };
  txHash: string | null;
}

export interface TransferValidation {
  transferRequestId: string;
  requestStatus: string;
  precheckResult: {
    recipientEligible: boolean;
    senderEligible: boolean;
    sufficientBalance: boolean;
    failureCode: string;
  } | null;
  txHash: string | null;
  finalizedAt: string | null;
}

export interface FailedTransfer {
  transferRequestId: string;
  failureStage: string;
  failureCode: string;
  fromWalletAddress: string;
  toWalletAddress: string;
  tokenAmount: string;
  timestamp: string;
}

export interface SuccessfulTransfer {
  transferRequestId: string;
  fromWalletAddress: string;
  toWalletAddress: string;
  tokenAmount: string;
  txHash: string;
  timestamp: string;
}

export function mintTokens(subscriptionId: string) {
  return post<MintResult>(
    `/admin/subscriptions/${subscriptionId}/token-mint`,
    {},
  );
}

export function initiateTransfer(
  fundId: string,
  input: {
    fromWalletAddress: string;
    toWalletAddress: string;
    tokenAmount: string;
    reason?: string;
  },
) {
  return post<TransferResult>(`/investor/funds/${fundId}/transfers`, input);
}

export function getTransferValidation(transferRequestId: string) {
  return get<TransferValidation>(`/transfers/${transferRequestId}/validation`);
}

export function getFailedTransfers(fundId: string) {
  return get<FailedTransfer[]>(`/admin/funds/${fundId}/transfers/failed`);
}

export function getSuccessfulTransfers(fundId: string) {
  return get<SuccessfulTransfer[]>(`/admin/funds/${fundId}/transfers/successful`);
}
