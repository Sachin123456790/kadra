# Task 3 Notes: SQL API Integration and Edge-Case Unit Tests

## Module Created

- `lib/sql-api.js` — SQL Data API client (mapped from requested `src/utils/sqlApi.ts`)
  - Uses HTTP fetch with env-driven config (`SQL_API_KEY`, `SQL_API_ENDPOINT`)
  - Supports dependency injection via `options.fetchFn` for deterministic testing
  - Returns fallback `{ transactions: [], entityId: null, fallback: true }` for missing/invalid entity

## Integration

- `scripts/fetch.js` — now imports and calls `fetchTransactionHistory` when SQL env vars are set
  - Gracefully skips when `SQL_API_KEY` or `SQL_API_ENDPOINT` not configured
  - Console output only (no UI)

## Test Coverage (14 new SQL API tests)

| Category | Tests | Description |
|---|---|---|
| Success response | 2 | Valid response parsing, empty transaction list |
| 4xx client errors | 3 | 400 bad request, 404 not found, empty error body |
| 5xx server errors | 2 | 500 internal error, 503 unavailable |
| Auth/token failure | 2 | 401 expired token, 403 forbidden |
| Missing entity fallback | 3 | null, empty string, undefined entityId |
| Missing configuration | 2 | No API key, no endpoint |

## All Tests Use Local Mocks

- Mock fetch function simulates HTTP responses without network calls
- No real SQL API service required
- `console.log` used for info/debug; `console.error` reserved for critical failures

## Full Suite

- **47 tests passing** (14 SQL API + 4 SQL env validation + 7 deploy reverts/fallbacks + 22 baseline)

## Commit

```
9d8d80f feat(task3): add SQL API transaction fetch and edge-case unit tests
```

Files created: `lib/sql-api.js`, `test/sql-api.test.js`
Files modified: `scripts/fetch.js` (SQL fetch integration)
