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
