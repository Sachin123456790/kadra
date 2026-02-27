# Design Document

## System overview

Markus is a Node.js/Hardhat project that:

1. **Deploys and interacts with Solidity contracts** on the Sepolia testnet via Hardhat.
2. **Integrates the Coinbase SDK** for off-chain wallet and account operations.
3. **Queries a SQL data API** for transaction history, with env-driven configuration.
4. **Exposes an MCP server** (`scripts/mcp-agentkit-server.mjs`) for AI-agent interaction through the Coinbase AgentKit.

All runtime behaviour is configured through environment variables validated at startup by `lib/validate-env.js`.

## Testnet-only constraints and secret handling

- **Mainnet guard**: `scripts/deploy.js:9-19` explicitly blocks execution on any network not in the allowlist (`sepolia`, `goerli`, `hardhat`, `localhost`). Verified by `test/deploy.test.js` "Should only allow testnet networks".
- **Secret management**: Private keys (`DEPLOYER_PRIVATE_KEY`), API credentials (`COINBASE_API_KEY_NAME`, `COINBASE_API_KEY_SECRET`, `SQL_API_KEY`), and RPC URLs are loaded from `.env` via `dotenv`. No secrets are committed to the repository.
- **Validation**: `lib/validate-env.js` (64 LOC) checks presence and format of required variables before any operation. Separate validation sets exist for deploy (`DEPLOY_ENV_VARS`), transfer (`TRANSFER_ENV_VARS`), and SQL API (`SQL_ENV_VARS`). Tested by 12 cases in `test/config.test.js`.

## Coinbase SDK and Hardhat interaction boundaries

| Layer | Responsibility | Module | Key exports |
|---|---|---|---|
| **Smart contracts** | On-chain logic (Lock contract with time-locked withdrawals) | `contracts/Lock.sol` (23 LOC) | `constructor(uint)`, `withdraw()` |
| **Hardhat scripts** | Contract deployment, ETH transfers, transaction fetching | `scripts/deploy.js` (111 LOC), `scripts/fetch.js` (164 LOC) | Hardhat run scripts |
| **Coinbase SDK helper** | SDK client initialisation for Sepolia, credential validation | `lib/coinbase-sdk-helper.js` (33 LOC) | `getCoinbaseClient()`, `NETWORK`, `CHAIN_ID` |
| **MCP AgentKit server** | Exposes Coinbase AgentKit actions over Model Context Protocol | `scripts/mcp-agentkit-server.mjs` | `npm run mcp:server` |
| **SQL API client** | Transaction history fetch with auth and error handling | `lib/sql-api.js` (59 LOC) | `fetchTransactionHistory(entityId, options)` |
| **Simulation data** | Legal entity and bank account fixtures for test scenarios | `lib/legal-entity.js` (34 LOC), `lib/bank-accounts.js` (48 LOC) | `loadLegalEntity()`, `getVerifiedAccounts()` |

Hardhat provides the EVM runtime and Ethers.js provider. The Coinbase SDK operates independently for wallet-level actions. The two do not share state at runtime; they are connected through shared environment configuration and the deploy script's use of simulation data.

### Concrete implementation evidence

**Coinbase SDK** (`lib/coinbase-sdk-helper.js`):
- Dynamically imports `@coinbase/coinbase-sdk`, constructs client with `apiKeyName` and `privateKey` from env
- Returns configured Coinbase instance targeting Sepolia (chainId `11155111`)
- Test: `test/config.test.js` lines 9-18 verify `NETWORK === "sepolia"` and `CHAIN_ID === 11155111`

**Hardhat testnet simulation** (`scripts/deploy.js`):
- Deploys `Lock` contract with 1-year unlock time and 0.0001 ETH locked value
- Executes ETH transfer to second signer on local network or `TRANSFER_TARGET_ADDRESS` on live testnet
- Saves tx hash and receipt JSON to `EVIDENCE/task3/`
- Tests in `test/deploy.test.js`: full deploy+transfer on local Hardhat asserts `receipt.status === 1`, validates `lockAddress` format, verifies revert on past unlock time and non-owner withdrawal

**SQL transaction history** (`lib/sql-api.js`):
- `fetchTransactionHistory(entityId, options)` makes GET to `${endpoint}/v1/transactions?entityId=...` with Bearer token
- Error handling: 401/403 auth failure, 4xx client error with body, 5xx server unavailable
- Fallback: missing/invalid/non-string entityId returns `{ transactions: [], fallback: true }`
- Dependency injection: `options.fetchFn`, `options.apiKey`, `options.endpoint` for test isolation
- Tests in `test/sql-api.test.js`: 14 cases covering success, empty list, 400/404/422, 500/503, 401/403 auth, null/empty/undefined/numeric/object entityId, 429 rate limit, network errors, zero-balance, missing config

## SQL API data flow and fallback handling

```
scripts/fetch.js (164 LOC)
  ├── Hash validation: /^0x[0-9a-fA-F]{64}$/ (line 16)
  ├── eth_getTransactionByHash (via Hardhat provider, line 23-26)
  │     ├── Edge case: invalid hash → rejected before RPC call (lines 52-58)
  │     ├── Edge case: zero hash → provider returns null (lines 61-76)
  │     └── Main fetch: tx data with field validation (lines 93-138)
  └── lib/sql-api.js → fetchTransactionHistory(entityId) (lines 141-156)
        ├── GET ${SQL_API_ENDPOINT}/v1/transactions?entityId=...
        ├── Auth: Bearer ${SQL_API_KEY}
        ├── Error handling:
        │     401/403 → auth failure (expired/invalid token)
        │     4xx     → client error with body
        │     5xx     → service unavailable
        └── Fallback: missing/invalid entityId → { transactions: [], fallback: true }
```

- The SQL API client (`lib/sql-api.js`) supports dependency injection for testing (`options.fetchFn`, `options.apiKey`, `options.endpoint`).
- When `SQL_API_KEY` or `SQL_API_ENDPOINT` are not set, the fetch script skips the SQL API call gracefully (`fetch.js:141-156`).
- Tests in `test/fetch.test.js`: hash validation (valid/invalid/wrong length), `eth_getTransactionByHash` returns null for nonexistent tx, returns full data for real tx with field validation.

## Risks and mitigations

| Risk | Mitigation | Verified by |
|---|---|---|
| Accidental mainnet deployment | Network allowlist in `deploy.js:9`; `hardhat.config.js` only configures Sepolia | `test/deploy.test.js` mainnet guard test |
| Secret leakage | All secrets via `.env`; `.gitignore` excludes `.env`; `validate-env.js` fails fast | `test/config.test.js` env validation tests |
| SQL API unavailability | Fallback response for missing entity; error classes for auth and server errors | `test/sql-api.test.js` (14 test cases) |
| Testnet RPC instability | Local Hardhat network for all tests; live testnet only for `:sepolia` scripts | All tests run on local Hardhat EVM |
| Stale simulation data | Fixtures validated at load time by `legal-entity.js` and `bank-accounts.js` | `test/deploy.test.js` entity/bank fallback tests |
| Test environment leakage | Injected mocks (SQL API) and Hardhat's in-memory EVM; no external calls | `test/sql-api.test.js` uses `mockFetch()` |
| Invalid transaction hashes | Hash format validation via regex before RPC call | `test/fetch.test.js` hash validation tests |
| Bank account data integrity | `bank-accounts.js` validates required fields and 9-digit routing number | `test/deploy.test.js` routing number test |
