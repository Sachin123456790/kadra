import { post } from './api-client';

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
