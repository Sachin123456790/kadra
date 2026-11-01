import { fundId, stamp, demoUser, docs, fund, config, investors, subscriptions, capitalCalls, allocation, waterfall, events, sourceTerms, sourceHtml } from './fixtures.mjs';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const result = (data) => ({ status: 200, headers: jsonHeaders, body: JSON.stringify({ data, meta: { requestId: 'synthetic-demo', timestamp: stamp } }) });
const failure = (status, code, message) => ({ status, headers: jsonHeaders, body: JSON.stringify({ error: { code, message }, meta: { requestId: 'synthetic-demo', timestamp: stamp } }) });

// The fixture service has no storage, external fetch, wallet, or database dependency.
// The hosting platform protects access; demo sessions are not real authentication.
export function demoResponse({ method = 'GET', path = '', enabled = false }) {
  if (!enabled) return failure(404, 'NOT_FOUND', 'Not found');
  const pathname = `/${path.replace(/^\/+/, '').split('?')[0]}`.replace(/\/$/, '');
  if (method === 'POST' && pathname === '/auth/login') return result({ accessToken: 'synthetic-demo-session', user: demoUser });
  if (method !== 'GET' && method !== 'HEAD') return failure(405, 'DEMO_READ_ONLY', 'This is a read-only demo. Changes, uploads, and transactions are disabled.');
  if (pathname === '/auth/me') return result(demoUser);
  if (pathname === '/config') return result(config);
  const base = `/admin/funds/${fundId}`;
  const byPath = new Map([
    [base, fund], [`${base}/overview`, fund], [`${base}/activity-feed`, events],
    [`${base}/capital-calls`, capitalCalls], [`${base}/documents`, docs],
    [`${base}/investors`, investors], [`${base}/subscriptions`, subscriptions],
    [`${base}/allocation`, allocation], [`${base}/waterfall-configs/active`, waterfall],
    // No token balances or ownership claims are fabricated.
    [`${base}/cap-table`, { fundId, asOfTimestamp: stamp, rows: [] }],
    [`${base}/lpa-stack`, null],
  ]);
  if (byPath.has(pathname)) return result(byPath.get(pathname));
  const emptyLists = ['notices', 'reporting-documents', 'event-log', 'document-provenance', 'capital-accounts', 'ownership-history', 'transfers/failed', 'transfers/successful'];
  if (emptyLists.some((suffix) => pathname === `${base}/${suffix}`)) return result([]);
  const match = pathname.match(/^\/admin\/documents\/(lpa|amendment|side)\/(parse-status|hashes|extracted-fields|content)$/);
  if (match) {
    const [, documentId, resource] = match;
    if (resource === 'parse-status') return result({ documentId, parseStatus: 'COMPLETED', hashStatus: 'COMPLETED', extractionSummary: { fieldsExtracted: 1, lowConfidenceFields: 0 }, updatedAt: stamp });
    if (resource === 'hashes') return result([{ hashId: `demo-hash-${documentId}`, algorithm: 'SHA-256', hashHex: 'a'.repeat(64), anchoredOnchain: false, anchor: null }]);
    if (resource === 'extracted-fields') return result([{ fieldId: `demo-field-${documentId}`, fieldName: sourceTerms[documentId][0], fieldValueText: sourceTerms[documentId][1], fieldValueNumeric: null, fieldValueJson: null, sourcePage: 1, extractionRunRef: 'synthetic-demo', createdAt: stamp }]);
    if (resource === 'content') return { status: 200, headers: { ...jsonHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'" }, body: sourceHtml(documentId) };
  }
  return failure(404, 'DEMO_NOT_AVAILABLE', 'This view is not included in the interface demo.');
}
