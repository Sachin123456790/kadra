import { get } from './api-client';

// ── Types ──────────────────────────────────────────────────

export interface TaxReport {
  id: string;
  taxYear: number;
  taxEntityName: string;
  ordinaryIncome: string;
  returnOfCapital: string;
  ltcg: string;
  stcg: string;
  totalDistributions: string;
}

// ── API calls ──────────────────────────────────────────────

export function getInvestorTaxReport(fundId: string, taxYear: number) {
  return get<TaxReport | null>(`/investor/me/tax-report?fundId=${fundId}&taxYear=${taxYear}`);
}
