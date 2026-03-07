import { get, upload } from './api-client';

export interface UploadResult {
  documentId: string;
  parseStatus: string;
  hashStatus: string;
}

export interface DocumentHash {
  hashId: string;
  algorithm: string;
  hashHex: string;
  anchoredOnchain: boolean;
  anchor: { chainId: number; txHash: string; blockNumber: number | null } | null;
}

export interface ParseStatus {
  documentId: string;
  parseStatus: string;
  hashStatus: string;
  extractionSummary: { fieldsExtracted: number; lowConfidenceFields: number };
  updatedAt: string;
}

export function uploadMasterLpa(fundId: string, file: File) {
  return upload<UploadResult>(
    `/admin/funds/${fundId}/documents/master-lpa`,
    file,
  );
}

export function getDocumentHashes(documentId: string) {
  return get<DocumentHash[]>(`/admin/documents/${documentId}/hashes`);
}

export function getParseStatus(documentId: string) {
  return get<ParseStatus>(`/admin/documents/${documentId}/parse-status`);
}
