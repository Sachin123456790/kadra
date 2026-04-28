import { ApiRequestError } from '@/services/api-client';

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  INVESTOR_NOT_FOUND:
    "We couldn't find an investor profile for this account. Please contact your fund admin to get onboarded.",
  SUBSCRIPTION_NOT_PENDING:
    'This subscription has already been processed. Refresh the queue to see the latest state.',
  SUBSCRIPTION_NOT_FOUND: "We couldn't find that subscription. It may have been removed.",
  SETTLEMENT_VALIDATION_FAILED:
    "The wire confirmation didn't match the expected amount, reference, or investor. Please verify the uploaded document.",
  WIRE_AMOUNT_MISMATCH: "The wire amount doesn't match the subscription's committed amount.",
  WIRE_REFERENCE_MISMATCH: "The wire reference doesn't match the subscription ID.",
  WIRE_INVESTOR_MISMATCH: "The wire recipient doesn't match the investor on this subscription.",
  DOCUMENT_HASH_MISSING: 'The governing document hash is missing. Please re-upload the LPA.',
  DUPLICATE_WALLET: 'That wallet address is already linked to another investor.',
  WALLET_NOT_ELIGIBLE: 'This wallet is not eligible to hold fund assets. Contact the fund admin.',
  ELIGIBILITY_REVOKED: 'This investor is no longer eligible for this fund.',
  INSUFFICIENT_TOKEN_BALANCE: 'The sender does not hold enough tokens for this transfer.',
  TRANSFER_NOT_ALLOWED: 'This transfer is not permitted under the current fund rules.',
  FUND_NOT_FOUND: "We couldn't find that fund.",
  VALIDATION_ERROR: 'Please check the form for errors and try again.',
  CONFLICT: 'This operation conflicts with the current state. Please refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again in a moment.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function toFriendlyMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    return ERROR_MESSAGES[err.code] ?? err.message ?? ERROR_MESSAGES.UNKNOWN;
  }
  if (err instanceof Error) {
    return err.message || ERROR_MESSAGES.UNKNOWN;
  }
  return ERROR_MESSAGES.UNKNOWN;
}

export function isErrorCode(err: unknown, code: string): boolean {
  return err instanceof ApiRequestError && err.code === code;
}
