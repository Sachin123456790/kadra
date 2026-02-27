# Task 3 Edge Case Matrix

## Required Edge Cases → Test Mapping

| Required Edge Case | Test File | Test Name | Status |
|---|---|---|---|
| Zero-balance responses | `sql-api.test.js` | Should return parsed data for zero-balance transaction list | PASS |
| Zero-value ETH transfer | `deploy.test.js` | Should succeed with zero-value ETH transfer | PASS |
| Empty transaction list | `sql-api.test.js` | Should handle empty transaction list | PASS |
| SQL API 400 bad request | `sql-api.test.js` | Should throw on 400 bad request | PASS |
| SQL API 404 not found | `sql-api.test.js` | Should throw on 404 not found | PASS |
| SQL API 422 empty body | `sql-api.test.js` | Should handle empty error body on 4xx | PASS |
| SQL API 429 rate limit | `sql-api.test.js` | Should throw on 429 too many requests | PASS |
| SQL API 500 server error | `sql-api.test.js` | Should throw on 500 internal server error | PASS |
| SQL API 503 unavailable | `sql-api.test.js` | Should throw on 503 service unavailable | PASS |
| Expired token (401) | `sql-api.test.js` | Should throw on 401 unauthorized (expired token) | PASS |
| Invalid token (403) | `sql-api.test.js` | Should throw on 403 forbidden | PASS |
| Missing API key config | `sql-api.test.js` | Should throw when apiKey is not set | PASS |
| Missing endpoint config | `sql-api.test.js` | Should throw when endpoint is not set | PASS |
| Network/connection error | `sql-api.test.js` | Should propagate network/fetch errors | PASS |
| Transaction revert (past unlock) | `deploy.test.js` | Should revert Lock deploy with past unlock time | PASS |
| Transaction revert (non-owner) | `deploy.test.js` | Should revert Lock withdrawal from non-owner | PASS |
| Transfer to zero address | `deploy.test.js` | Should revert transfer to zero address | PASS |
| Missing entity data file | `deploy.test.js` | Should fail loadLegalEntity with missing data file | PASS |
| Malformed bank data | `deploy.test.js` | Should fail loadBankAccounts with malformed data | PASS |
| Missing entity fields | `deploy.test.js` | Should fail loadLegalEntity with missing required fields | PASS |
| Invalid wallet format | `deploy.test.js` | Should fail loadLegalEntity with invalid wallet address format | PASS |
| Invalid routing number | `deploy.test.js` | Should fail loadBankAccounts with missing routing number | PASS |
| Null entityId fallback | `sql-api.test.js` | Should return empty fallback for null entityId | PASS |
| Empty string entityId | `sql-api.test.js` | Should return empty fallback for empty string entityId | PASS |
| Undefined entityId | `sql-api.test.js` | Should return empty fallback for undefined entityId | PASS |
| Numeric entityId | `sql-api.test.js` | Should return empty fallback for numeric entityId | PASS |
| Object entityId | `sql-api.test.js` | Should return empty fallback for object entityId | PASS |
| URL encoding of entityId | `sql-api.test.js` | Should URL-encode entityId with special characters | PASS |
| Auth header construction | `sql-api.test.js` | Should send Authorization header with Bearer token | PASS |
| No mainnet in config | `config.test.js` | Should not define mainnet or homestead network | PASS |
| Nonexistent tx hash fetch | `fetch.test.js` | Should return null for nonexistent transaction | PASS |
| Invalid tx hash format | `fetch.test.js` | Should reject invalid transaction hash | PASS |
| Wrong hash length | `fetch.test.js` | Should reject hash with wrong length | PASS |

## Test Totals
- **58 tests passing** (up from 55)
- **3 new tests added**: mainnet config guard, URL encoding, auth header
- All tests deterministic and locally executable
