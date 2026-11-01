// Single source of truth for all configuration constants.
// Demo builds always use the isolated, same-origin fixture API.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
export const DEMO_READ_ONLY_MESSAGE = 'This is a read-only demo. Changes, uploads, and transactions are disabled.';

export const API_BASE_URL =
  DEMO_MODE ? '/api/v1' : (import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '/api/v1');

export const AUTH_TOKEN_KEY = 'angainor_auth_token';
export const AUTH_REFRESH_TOKEN_KEY = 'angainor_auth_refresh_token';
export const AUTH_USER_KEY = 'angainor_auth_user';

export const FUND_ID_KEY = 'angainor_active_fund_id';

// Default fund for demo — matches seed data
export const DEFAULT_FUND_CODE = 'ANGAINOR-DEMO-001';

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
  capitalCalls: (fundId: string) => ['capital-calls', fundId] as const,
  notices: (fundId: string) => ['notices', fundId] as const,
  activityFeed: (fundId: string) => ['activity-feed', fundId] as const,
  eventLog: (fundId: string) => ['event-log', fundId] as const,
  documentProvenance: (fundId: string) => ['document-provenance', fundId] as const,
  capitalAccounts: (fundId: string) => ['capital-accounts', fundId] as const,
  investorDocuments: (fundId: string) => ['investor-documents', fundId] as const,
  investorGpReports: (fundId: string) => ['investor-gp-reports', fundId] as const,
  adminReportingDocs: (fundId: string) => ['admin-reporting-docs', fundId] as const,
  taxPackagePreview: (fundId: string, year: number) => ['tax-package-preview', fundId, year] as const,
  investorActivityFeed: (fundId: string) => ['investor-activity-feed', fundId] as const,
  investorCapitalAccount: (fundId: string) => ['investor-capital-account', fundId] as const,
  taxReport: (fundId: string, year: number) => ['tax-report', fundId, year] as const,
  waterfallBreakdown: (fundId: string) => ['waterfall-breakdown', fundId] as const,
  investorNotices: () => ['investor-notices'] as const,
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
  INVESTOR_CAPITAL_ACCOUNT: '/investor/capital-account',
  INVESTOR_DOCUMENTS: '/investor/documents',
  INVESTOR_ONBOARDING: '/investor/onboarding',
} as const;
