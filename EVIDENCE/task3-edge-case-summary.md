# Task 3: Edge Case to Test Mapping

## SQL API Edge Cases (test/sql-api.test.js)

| Edge Case | Test Name | Status |
|---|---|---|
| 4xx: 400 Bad Request | "Should throw on 400 bad request" | PASS |
| 4xx: 404 Not Found | "Should throw on 404 not found" | PASS |
| 4xx: Empty error body (422) | "Should handle empty error body on 4xx" | PASS |
| 4xx: 429 Rate Limiting | "Should throw on 429 too many requests" | PASS (NEW) |
| 5xx: 500 Internal Server Error | "Should throw on 500 internal server error" | PASS |
| 5xx: 503 Service Unavailable | "Should throw on 503 service unavailable" | PASS |
| Auth: 401 Expired Token | "Should throw on 401 unauthorized (expired token)" | PASS |
| Auth: 403 Forbidden | "Should throw on 403 forbidden" | PASS |
| Fallback: null entityId | "Should return empty fallback for null entityId" | PASS |
| Fallback: empty string entityId | "Should return empty fallback for empty string entityId" | PASS |
| Fallback: undefined entityId | "Should return empty fallback for undefined entityId" | PASS |
| Fallback: numeric entityId | "Should return empty fallback for numeric entityId" | PASS (NEW) |
| Fallback: object entityId | "Should return empty fallback for object entityId" | PASS (NEW) |
| Network: fetch connection error | "Should propagate network/fetch errors" | PASS (NEW) |
| Success: zero-balance txn | "Should return parsed data for zero-balance transaction list" | PASS (NEW) |
| Config: missing API key | "Should throw when apiKey is not set" | PASS |
| Config: missing endpoint | "Should throw when endpoint is not set" | PASS |

## Simulation / Deploy Edge Cases (test/deploy.test.js)

| Edge Case | Test Name | Status |
|---|---|---|
| Testnet-only guard | "Should only allow testnet networks" | PASS |
| Past unlock time revert | "Should revert Lock deploy with past unlock time" | PASS |
| Non-owner withdrawal revert | "Should revert Lock withdrawal from non-owner" | PASS |
| Zero-value transfer | "Should succeed with zero-value ETH transfer" | PASS |
| Zero address transfer | "Should revert transfer to zero address" | PASS |
| Missing data file | "Should fail loadLegalEntity with missing data file" | PASS |
| Malformed bank data | "Should fail loadBankAccounts with malformed data" | PASS |
| Missing required fields | "Should fail loadLegalEntity with missing required fields" | PASS |
| Invalid wallet address format | "Should fail loadLegalEntity with invalid wallet address format" | PASS (NEW) |
| Invalid routing number | "Should fail loadBankAccounts with missing routing number" | PASS (NEW) |

## Fetch Edge Cases (test/fetch.test.js)

| Edge Case | Test Name | Status |
|---|---|---|
| Valid hash accepted | "Should accept valid transaction hash" | PASS |
| Invalid hash rejected | "Should reject invalid transaction hash" | PASS |
| Wrong-length hash rejected | "Should reject hash with wrong length" | PASS (NEW) |
| Nonexistent tx returns null | "Should return null for nonexistent transaction" | PASS |
| Real tx returns data | "Should return transaction data for real transaction" | PASS |
| Required fields validated | "Should validate required fields in transaction response" | PASS |

## Summary
- Total tests: 55 (was 47, added 8 new)
- All tests use mocks/stubs — no live external dependencies
- All assertions target specific error messages for determinism
