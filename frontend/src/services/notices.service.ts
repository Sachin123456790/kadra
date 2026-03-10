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
  documentHash: string | null;
  anchorTxHash: string | null;
  generatedAt: string;
  deliveries: NoticeDelivery[];
  investor?: { legalName: string };
}

// ── API calls ──────────────────────────────────────────────

export function getNotices(fundId: string) {
  return get<Notice[]>(`/admin/funds/${fundId}/notices`);
}

export function generateNotice(data: {
  fundId: string;
  type: string;
  recipientInvestorId: string;
  capitalCallId?: string;
}) {
  return post<Notice>(`/admin/notices`, data);
}

export function updateNoticeDelivery(noticeId: string, status: string) {
  return put<NoticeDelivery>(`/admin/notices/${noticeId}/delivery`, { status });
}

export function getInvestorNotices() {
  return get<Notice[]>(`/investor/me/notices`);
}
