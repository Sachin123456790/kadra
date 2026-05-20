import { get, post } from './api-client';

export interface AuditExportSummary {
  auditExportId: string;
  status: string;
}

export interface AuditExportDetail {
  auditExportId: string;
  status: string;
  exportType: string;
  artifact: {
    storageProvider: string;
    path: string;
    checksumSha256: string;
  } | null;
  requestedAt: string;
  completedAt: string | null;
}

export function createAuditExport(fundId: string) {
  return post<AuditExportSummary>(`/admin/funds/${fundId}/audit-exports`, {});
}

export interface ResetDemoResult {
  fundId: string;
  fundCode: string;
  fundName: string;
  resetAt: string;
}

export function resetDemoFund(fundId: string) {
  return post<ResetDemoResult>(`/admin/funds/${fundId}/reset-demo`, {});
}

export function getAuditExport(auditExportId: string) {
  return get<AuditExportDetail>(`/admin/audit-exports/${auditExportId}`);
}

export interface AuditExportDownload {
  exportId: string;
  fundId: string;
  fundName: string | null;
  generatedAt: string | null;
  checksumSha256: string | null;
  files: Record<string, string>;
}

export function downloadAuditExport(auditExportId: string) {
  return get<AuditExportDownload>(`/admin/audit-exports/${auditExportId}/download`);
}

// ── Event Log & Document Provenance ────────────────────────

export interface EventLogEntry {
  id: string;
  eventType: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  txHash: string | null;
  metadata: Record<string, unknown>;
}

export interface DocumentProvenance {
  id: string;
  originalName: string;
  type: string;
  createdAt: string;
  hash: string | null;
  anchorTxHash: string | null;
  anchorBlockNumber: number | null;
  anchorConfirmedAt: string | null;
}

export function getEventLog(fundId: string, limit = 100, offset = 0) {
  return get<EventLogEntry[]>(`/admin/funds/${fundId}/event-log?limit=${limit}&offset=${offset}`);
}

export function getDocumentProvenance(fundId: string) {
  return get<DocumentProvenance[]>(`/admin/funds/${fundId}/document-provenance`);
}

export async function downloadGpAdminExportPdf(fundId: string): Promise<void> {
  const { API_BASE_URL, AUTH_TOKEN_KEY } = await import('@/config/constants');
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  const res = await fetch(
    `${API_BASE_URL}/admin/funds/${fundId}/gp-admin-export.pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Export failed (${res.status}): ${text}`);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const filenameMatch = /filename="([^"]+)"/.exec(cd);
  const filename =
    filenameMatch?.[1] ??
    `gp-admin-export-${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
