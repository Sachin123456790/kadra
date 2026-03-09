import { get, post } from './api-client';

export interface MintResult {
  mintRequestId: string;
  status: string;
  txHash: string;
  tokenAmount: string;
}

export interface TransferValidateResult {
  transferRequestId: string;
  requestStatus: string;
  precheck: {
    recipientEligible: boolean;
    senderEligible: boolean;
    sufficientBalance: boolean;
  };
  contractAddress: string;
  txHash: string | null;
}

export interface TransferConfirmResult {
  transferRequestId: string;
  requestStatus: string;
  txHash: string;
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

export function validateTransfer(
  fundId: string,
  input: {
    fromWalletAddress: string;
    toWalletAddress: string;
    tokenAmount: string;
    reason?: string;
  },
) {
  return post<TransferValidateResult>(`/investor/funds/${fundId}/transfers/validate`, input);
}

export function confirmTransfer(transferRequestId: string, txHash: string) {
  return post<TransferConfirmResult>(`/investor/transfers/${transferRequestId}/confirm`, { txHash });
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
