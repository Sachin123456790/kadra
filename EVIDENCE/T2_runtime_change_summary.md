# Task 2 Runtime Change Summary

## Files Edited
| File | Change | Reason |
|------|--------|--------|
| `hardhat.config.js` | Added `TESTNET_RPC` fallback in Sepolia network URL | Scope requires `TESTNET_RPC` as recognized env var; `.env.example` already lists it |

## Pre-existing Coverage (no changes needed)
| Requirement | Status | Location |
|-------------|--------|----------|
| Testnet-only config | Already present | `hardhat.config.js` - only `sepolia` network defined |
| Deploy mainnet guard | Already present | `scripts/deploy.js:9-20` - ALLOWED_NETWORKS blocklist |
| SQL API env-driven | Already present | `lib/sql-api.js:17-18` - reads from options or process.env |
| SQL API 4xx handling | Already present | `lib/sql-api.js:46-49` |
| SQL API 5xx handling | Already present | `lib/sql-api.js:51-53` |
| SQL API 401/403 handling | Already present | `lib/sql-api.js:42-44` |
| SQL API entity fallback | Already present | `lib/sql-api.js:27-30` |
| Mockable fetch injection | Already present | `lib/sql-api.js:19` - `options.fetchFn` |
| .env.example complete | Already present | All required keys listed |
| No hardcoded secrets | Verified | All sensitive values use process.env |
| Console-only output | Verified | No UI components, all output via console.log/error |

## Env Vars Verified in .env.example
- `SEPOLIA_RPC_URL` / `TESTNET_RPC`
- `DEPLOYER_PRIVATE_KEY`
- `COINBASE_API_KEY_NAME` / `COINBASE_API_KEY_SECRET`
- `SQL_API_KEY`
- `SQL_API_ENDPOINT`

## Compile Result
Passes (`npm run compile` — "Nothing to compile", artifacts already built).
