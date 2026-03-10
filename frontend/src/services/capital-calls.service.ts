import { get, post, put } from './api-client';

// ── Types ──────────────────────────────────────────────────

export interface CapitalCallResponse {
  id: string;
  capitalCallId: string;
  investorId: string;
  amountReceived: string;
  receivedAt: string;
  status: string;
  investor?: { legalName: string };
}

export interface CapitalCall {
  id: string;
  fundId: string;
  callNumber: number;
  amountDue: string;
  dueDate: string;
  wireInstructions: string | null;
  status: string;
  createdAt: string;
  responses?: CapitalCallResponse[];
}

// ── API calls ──────────────────────────────────────────────

export function getCapitalCalls(fundId: string) {
  return get<CapitalCall[]>(`/admin/funds/${fundId}/capital-calls`);
}

export function createCapitalCall(
  fundId: string,
  data: { amountDue: string; dueDate: string; wireInstructions?: string },
) {
  return post<CapitalCall>(`/admin/funds/${fundId}/capital-calls`, data);
}

export function updateCapitalCallStatus(callId: string, status: string) {
  return put<CapitalCall>(`/admin/capital-calls/${callId}/status`, { status });
}

export function recordCapitalCallResponse(
  callId: string,
  data: { investorId: string; amountReceived: string; receivedAt: string; wireDocumentId?: string },
) {
  return post<CapitalCallResponse>(`/admin/capital-calls/${callId}/responses`, data);
}
