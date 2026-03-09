import { post, upload } from './api-client';

export interface ValidationResult {
  settlementRecordId: string;
  status: string;
  checks: {
    checkAmountMatch: boolean;
    checkInvestorMatch: boolean;
    checkReferenceMatch: boolean;
    checkNoDoubleSettlement: boolean;
  };
  failureReasonCode: string | null;
}

export interface SettlementConfirmation {
  subscriptionId: string;
  status: string;
  settledAt: string;
}

export function requestPaymentValidation(
  subscriptionId: string,
  input: {
    paymentDocumentId: string;
    declaredAmount: string;
    declaredCurrency: string;
    declaredReference: string;
  },
) {
  return post<ValidationResult>(
    `/admin/subscriptions/${subscriptionId}/payment-validations`,
    input,
  );
}

export function confirmSettlement(
  subscriptionId: string,
  settlementRecordId: string,
) {
  return post<SettlementConfirmation>(
    `/admin/subscriptions/${subscriptionId}/settlement-confirmation`,
    { settlementRecordId },
  );
}

export function uploadPaymentEvidence(
  subscriptionId: string,
  body: {
    paymentDocumentId: string;
    declaredAmount: string;
    declaredCurrency: string;
    declaredReference: string;
  },
) {
  return post<{ paymentEvidenceId: string }>(
    `/admin/subscriptions/${subscriptionId}/payment-evidence`,
    body,
  );
}

export function uploadWireConfirmation(
  fundId: string,
  investorId: string,
  file: File,
) {
  return upload<{ documentId: string; hashHex: string }>(
    `/admin/funds/${fundId}/investors/${investorId}/documents/wire-confirmation`,
    file,
  );
}

export function overrideSettlement(
  settlementRecordId: string,
  body: { action: string; reason: string },
) {
  return post<{ status: string }>(
    `/admin/settlements/${settlementRecordId}/override`,
    body,
  );
}
