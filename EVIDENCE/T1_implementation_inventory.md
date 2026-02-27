# Implementation Code Inventory

Baseline snapshot of concrete feature code in `/Users/chinmay_shringi/Desktop/markus`.

## Coinbase SDK Integration

**File**: `lib/coinbase-sdk-helper.js` (33 lines)
- Exports: `getCoinbaseClient()`, `NETWORK`, `CHAIN_ID`
- Dynamically imports `@coinbase/coinbase-sdk` and initializes client with env credentials
- Targets Sepolia testnet (chainId 11155111)
- Credential validation: requires `COINBASE_API_KEY_NAME` and `COINBASE_API_KEY_SECRET`

**File**: `scripts/mcp-agentkit-server.mjs`
- MCP server using `@coinbase/agentkit` and `@coinbase/agentkit-model-context-protocol`
- Exposes Coinbase AgentKit actions over Model Context Protocol

**Test evidence**: `test/config.test.js` lines 9-18 verify NETWORK=sepolia, CHAIN_ID=11155111, and hardhat config includes sepolia network.

## Hardhat Testnet Simulation

**Contract**: `contracts/Lock.sol` (23 lines)
- Solidity ^0.8.24 Lock contract with time-locked ETH and owner-only withdrawal
- Constructor validates future unlock time, stores owner address
- `withdraw()` enforces time lock and owner check

**File**: `scripts/deploy.js` (111 lines)
- Deploys Lock contract, executes ETH transfer, saves evidence artifacts
- Mainnet guard: blocks non-allowlisted networks (`ALLOWED_NETWORKS = ["sepolia", "goerli", "hardhat", "localhost"]`)
- Loads simulation data from `lib/legal-entity.js` and `lib/bank-accounts.js`
- Validates env vars via `lib/validate-env.js` on live testnet

**Test evidence**: `test/deploy.test.js` (188 lines)
- Tests mainnet guard, simulation data loading, local deploy+transfer, revert scenarios
- `test/Lock.js` (41 lines): unlockTime, owner, early-withdrawal revert

## SQL Transaction History

**File**: `lib/sql-api.js` (59 lines)
- Exports: `fetchTransactionHistory(entityId, options)`
- HTTP GET to `${SQL_API_ENDPOINT}/v1/transactions?entityId=...` with Bearer auth
- Error handling: 401/403 auth failure, 4xx client error, 5xx server error
- Fallback: missing/invalid entityId returns `{ transactions: [], fallback: true }`
- Dependency injection: `options.fetchFn`, `options.apiKey`, `options.endpoint` for testing

**File**: `scripts/fetch.js` (164 lines)
- Uses `eth_getTransactionByHash` via Hardhat provider for on-chain tx data
- Integrates SQL API via `lib/sql-api.js` for off-chain transaction history
- Edge-case handling: invalid hash rejection, nonexistent transaction, SQL API skip when unconfigured

**Test evidence**: `test/sql-api.test.js` (282 lines)
- 14 test cases covering: success response, 4xx errors, 5xx errors, auth failure (401/403),
  missing entity fallback, non-string entityId types, rate limiting (429), network errors,
  zero-balance transactions, missing config
- Uses mock fetch injection — no external calls during `npm test`

**Test evidence**: `test/fetch.test.js` (75 lines)
- Hash validation (valid/invalid/wrong length)
- `eth_getTransactionByHash` returns null for nonexistent, returns full data for real tx
- Response field validation (hash, from, to, blockNumber)

## Environment Validation

**File**: `lib/validate-env.js` (64 lines)
- Exports: `validateEnv()`, `DEPLOY_ENV_VARS`, `TRANSFER_ENV_VARS`, `SQL_ENV_VARS`
- Pattern-based validation with descriptive error messages
- Tested in `test/config.test.js` (missing vars, invalid format, valid vars)

## Simulation Data

**File**: `lib/legal-entity.js` (34 lines) — loads and validates `data/legal-entity.json`
**File**: `lib/bank-accounts.js` (48 lines) — loads and validates `data/bank-accounts.json`
**Fixtures**: `data/legal-entity.json`, `data/bank-accounts.json`

## Summary

| Feature | Implementation files | Test files | LOC (impl) | LOC (test) |
|---|---|---|---|---|
| Coinbase SDK | coinbase-sdk-helper.js, mcp-agentkit-server.mjs | config.test.js | 33+ | 186 |
| Hardhat testnet | Lock.sol, deploy.js, validate-env.js | Lock.js, deploy.test.js, config.test.js | 198 | 415 |
| SQL transaction history | sql-api.js, fetch.js | sql-api.test.js, fetch.test.js | 223 | 357 |
| Simulation data | legal-entity.js, bank-accounts.js | deploy.test.js (entity tests) | 82 | incl. above |
