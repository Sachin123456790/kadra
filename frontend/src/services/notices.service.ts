import { get, post, put } from './api-client';

// ── Types ──────────────────────────────────────────────────

export interface NoticeDelivery {
  id: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  downloadedAt: string | null;
}

export interface Notice {
  id: string;
  fundId: string;
  type: string;
  recipientInvestorId: string;
  capitalCallId?: string | null;
  distributionRunId?: string | null;
  documentHash: string | null;
  anchorTxHash: string | null;
  subject?: string | null;
  bodyMarkdown?: string | null;
  templateKey?: string | null;
  generatedAt: string;
  deliveries: NoticeDelivery[];
  investor?: { legalName: string };
}

export interface CreateNoticeBody {
  fundId: string;
  type: string;
  recipientInvestorId: string;
  capitalCallId?: string;
  distributionRunId?: string;
  documentHash?: string;
  anchorTxHash?: string;
  subject?: string;
  bodyMarkdown?: string;
  templateKey?: string;
}

export interface NoticeTemplateResponse {
  subject: string;
  body: string;
  templateKey: string;
  availableTokens: string[];
}

// ── API calls ──────────────────────────────────────────────

export function getNotices(fundId: string) {
  return get<Notice[]>(`/admin/funds/${fundId}/notices`);
}

export function createNotice(body: CreateNoticeBody) {
  return post<Notice>(`/admin/notices`, body);
}

export function getNoticeTemplate(params: {
  type: string;
  fundId: string;
  recipientInvestorId?: string;
  capitalCallId?: string;
  distributionRunId?: string;
}) {
  const qs = new URLSearchParams({ fundId: params.fundId });
  if (params.recipientInvestorId) qs.set('recipientInvestorId', params.recipientInvestorId);
  if (params.capitalCallId) qs.set('capitalCallId', params.capitalCallId);
  if (params.distributionRunId) qs.set('distributionRunId', params.distributionRunId);
  return get<NoticeTemplateResponse>(
    `/admin/notice-templates/${encodeURIComponent(params.type)}?${qs.toString()}`,
  );
}

/**
 * Update delivery status on a notice. Backend expects `deliveryId` + `status`.
 * We resolve the first delivery id on the notice server-side indirectly by
 * passing it here from the caller.
 */
export function updateNoticeDelivery(
  noticeId: string,
  deliveryId: string,
  status: string,
) {
  return put<NoticeDelivery>(`/admin/notices/${noticeId}/delivery`, {
    deliveryId,
    status,
  });
}

export function getInvestorNotices() {
  return get<Notice[]>(`/investor/me/notices`);
}

// ── Admin ops helpers (Phase 5) ────────────────────────────

export function mintAllSettled(fundId: string) {
  return post<{
    mintedCount: number;
    results: Array<{
      subscriptionId: string;
      status: string;
      txHash?: string;
      error?: string;
    }>;
  }>(`/admin/funds/${fundId}/mint-all-settled`, {});
}

export function anchorPendingDocuments() {
  return post<{ anchoredCount: number; results: unknown[] } | unknown>(
    `/admin/documents/anchor-pending`,
    {},
  );
}

export function rebuildProjections(fundId: string) {
  return post<unknown>(`/admin/projections/rebuild`, { fundId });
}

// ── Jobs ────────────────────────────────────────────────────

export interface AdminJobDefinition {
  name: string;
  label: string;
  description: string;
  path: string;
  /** Optional body to include when invoking. */
  body?: Record<string, unknown>;
}

export const ADMIN_JOBS: ReadonlyArray<AdminJobDefinition> = [
  {
    name: 'run-pending',
    label: 'Run pending jobs',
    description:
      'Pick up queued background jobs and execute them (bounded batch).',
    path: '/admin/jobs/run',
    body: {},
  },
  {
    name: 'chain-ingest',
    label: 'Chain event ingest',
    description: 'Ingest on-chain events (transfers, mints) into the ledger.',
    path: '/admin/jobs/chain-ingest',
    body: {},
  },
  {
    name: 'tx-sync',
    label: 'Sync pending transactions',
    description:
      'Reconcile pending EVM transactions against receipts and update state.',
    path: '/admin/jobs/tx-sync',
    body: {},
  },
];

export function listAdminJobs(): ReadonlyArray<AdminJobDefinition> {
  return ADMIN_JOBS;
}

export function triggerJob(job: AdminJobDefinition) {
  return post<unknown>(job.path, job.body ?? {});
}
