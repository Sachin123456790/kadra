import { get, post, put, upload } from './api-client';

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

export interface FundDocument {
  documentId: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  parseStatus: string;
  uploadedBy: string | null;
  hash: {
    hashHex: string;
    algorithm: string;
    anchoredOnchain: boolean;
  } | null;
  extractedFieldCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedField {
  fieldId: string;
  fieldName: string;
  fieldValueText: string | null;
  fieldValueNumeric: number | null;
  fieldValueJson: unknown;
  confidence: number;
  sourcePage: number | null;
  extractionRunRef: string;
  createdAt: string;
}

export interface SubscriptionItem {
  investorId: string;
  walletId: string;
  allocationPct: number;
  committedAmount: number;
}

export interface FieldUpdate {
  fieldId: string;
  fieldValueText?: string;
  fieldValueNumeric?: number;
}

export interface ApproveResult {
  subscriptionsCreated: number;
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

export function getDocuments(fundId: string) {
  return get<FundDocument[]>(`/admin/funds/${fundId}/documents`);
}

export function getExtractedFields(documentId: string) {
  return get<ExtractedField[]>(`/admin/documents/${documentId}/extracted-fields`);
}

export function updateExtractedFields(
  documentId: string,
  fieldUpdates: FieldUpdate[],
) {
  return put<{ documentId: string; fieldsUpdated: number }>(
    `/admin/documents/${documentId}/extracted-fields`,
    { fieldUpdates },
  );
}

export function approveDocument(
  documentId: string,
  fundId: string,
  subscriptionItems: SubscriptionItem[],
  options?: { notes?: string; fieldUpdates?: FieldUpdate[] },
) {
  return post<ApproveResult>(`/admin/documents/${documentId}/approve`, {
    fundId,
    subscriptionItems,
    notes: options?.notes,
    fieldUpdates: options?.fieldUpdates,
  });
}
