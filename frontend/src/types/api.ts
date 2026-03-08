// ============================================================
// Shared TypeScript interfaces for API responses.
// Based on the backend service response shapes and the
// existing service-level types re-exported for convenience.
// ============================================================

// Re-export service-level types so pages can import from one place
export type { FundOverview } from '@/services/fund.service';
export type { Investor, InvestorWallet, FundEligibility } from '@/services/investors.service';
export type { Subscription } from '@/services/subscriptions.service';
export type { ValidationResult, SettlementConfirmation } from '@/services/settlements.service';

// ── View-model helpers (page-level mapped types) ─────────

/** Row shape used by InvestorsPage table after mapping API Investor */
export interface InvestorRow {
  id: string;
  name: string;
  wallet: string;
  verificationStatus: string;
  fundEligibility: string;
  ownership: number;
}

/** Row shape used by SubscriptionsPage table after mapping API Subscription */
export interface SubscriptionRow {
  id: string;
  ref: string;
  investorId: string;
  investorName: string;
  allocation: number;
  committedAmount: number;
  status: string;
  lpaHash: string;
  timestamp: string;
  createdAt: string;
}

/** Settlement queue item derived from a pending subscription */
export interface PaymentQueueItem {
  id: string;
  investor: string;
  amount: string;
  ref: string;
  status: 'Pending' | 'Passed' | 'Failed' | 'Verifying';
  subscriptionId: string;
}

// ── Transfers ────────────────────────────────────────────

export type { FailedTransfer, SuccessfulTransfer } from '@/services/tokenization.service';

// ── Cap Table ────────────────────────────────────────────

export type { CapTable, CapTableRow } from '@/services/ownership.service';

// ── Distribution ─────────────────────────────────────────

export type { DistributionPreview, DistributionLineItem } from '@/services/distribution.service';
export type { WaterfallConfig } from '@/services/fund.service';

// ── Audit ────────────────────────────────────────────────

export type { AuditExportSummary, AuditExportDetail } from '@/services/audit.service';
