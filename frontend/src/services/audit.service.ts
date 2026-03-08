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
