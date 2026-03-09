// Single source of truth for all configuration constants.
// Only VITE_API_URL is read from env; everything else is hardcoded.

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '/api/v1';

export const AUTH_TOKEN_KEY = 'kadra_auth_token';
export const AUTH_REFRESH_TOKEN_KEY = 'kadra_auth_refresh_token';
export const AUTH_USER_KEY = 'kadra_auth_user';

export const FUND_ID_KEY = 'kadra_active_fund_id';

// Default fund for demo — matches seed data
export const DEFAULT_FUND_CODE = 'KADRA-DEMO-001';

export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const;

export const QUERY_KEYS = {
  fundOverview: (fundId: string) => ['fund', fundId, 'overview'] as const,
  investors: (fundId: string) => ['fund', fundId, 'investors'] as const,
  subscriptions: (fundId: string) => ['fund', fundId, 'subscriptions'] as const,
  capTable: (fundId: string) => ['fund', fundId, 'cap-table'] as const,
  waterfallConfig: (fundId: string) => ['fund', fundId, 'waterfall'] as const,
  ownershipHistory: (fundId: string) => ['fund', fundId, 'ownership-history'] as const,
  failedTransfers: (fundId: string) => ['fund', fundId, 'transfers', 'failed'] as const,
  successfulTransfers: (fundId: string) => ['fund', fundId, 'transfers', 'successful'] as const,
  auditExport: (exportId: string) => ['audit-export', exportId] as const,
  documents: (fundId: string) => ['fund', fundId, 'documents'] as const,
  documentHashes: (docId: string) => ['document', docId, 'hashes'] as const,
  documentParseStatus: (docId: string) => ['document', docId, 'parse-status'] as const,
  extractedFields: (docId: string) => ['document', docId, 'extracted-fields'] as const,
  investorDashboard: (fundId: string) => ['investor', fundId, 'dashboard'] as const,
  investorSubscriptions: (fundId: string) => ['investor', fundId, 'subscriptions'] as const,
  investorCapTable: (fundId: string) => ['investor', fundId, 'cap-table'] as const,
  investorDistributions: (fundId: string) => ['investor', fundId, 'distributions'] as const,
  investorTransfers: (fundId: string) => ['investor', fundId, 'transfers'] as const,
  investorProfile: () => ['investor', 'profile'] as const,
  investorWallets: () => ['investor', 'wallets'] as const,
} as const;

export const ADMIN_ROLES = ['admin', 'platform_admin', 'fund_admin', 'operations_analyst'] as const;

export const ROUTES = {
  LANDING: '/',
  LOGIN: '/login',
  OVERVIEW: '/dashboard',
  INVESTORS: '/investors',
  SUBSCRIPTIONS: '/subscriptions',
  SETTLEMENT: '/settlement',
  TRANSFERS: '/transfers',
  CAP_TABLE: '/cap-table',
  DISTRIBUTION: '/distribution',
  DOCUMENTS: '/documents',
  AUDIT: '/audit',
  PROFILE: '/profile',
  HELP: '/help',
  NOTIFICATIONS: '/notifications',
  INVESTOR_DASHBOARD: '/investor',
  INVESTOR_SUBSCRIPTIONS: '/investor/subscriptions',
  INVESTOR_CAP_TABLE: '/investor/cap-table',
  INVESTOR_DISTRIBUTIONS: '/investor/distributions',
  INVESTOR_TRANSFERS: '/investor/transfers',
  INVESTOR_PROFILE: '/investor/profile',
} as const;
