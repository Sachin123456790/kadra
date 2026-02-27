# Implementation Plan

## Phase 1: Project scaffold and smart contract — COMPLETED

- Hardhat project initialised with `@nomicfoundation/hardhat-toolbox`.
- `contracts/Lock.sol` (23 LOC): Time-locked ETH contract with `constructor(uint _unlockTime) payable` and `withdraw()`. Validates future unlock time, enforces owner-only withdrawal.
- `hardhat.config.js` (19 LOC): Configured for Sepolia with env-driven RPC URL and private key. `isValidPrivateKey()` guard prevents invalid key injection.
- `test/Lock.js` (41 LOC, 3 tests): Verifies unlockTime, owner address, and early-withdrawal revert.

## Phase 2: Coinbase SDK and environment validation — COMPLETED

- `lib/coinbase-sdk-helper.js` (33 LOC): Exports `getCoinbaseClient()` which dynamically imports `@coinbase/coinbase-sdk` and returns configured client for Sepolia (chainId 11155111). Also exports `NETWORK` and `CHAIN_ID` constants.
- `lib/validate-env.js` (64 LOC): Exports `validateEnv(requiredVars)` with pattern-based validation and descriptive error messages. Defines `DEPLOY_ENV_VARS` (RPC URL + private key), `TRANSFER_ENV_VARS` (+ target address), `SQL_ENV_VARS` (API key + endpoint).
- `.env.example` pattern established for required variables.
- `test/config.test.js` (186 LOC, 12 tests): Network config (Sepolia target, hardhat config), env validation (missing vars, invalid format, valid vars for deploy and SQL sets), legal entity simulation (required fields, company metadata), bank account simulation (required fields, verified filter).

## Phase 3: Deploy, transfer, and simulation data — COMPLETED

- `scripts/deploy.js` (111 LOC): Deploys Lock contract with 1-year unlock time and 0.0001 ETH. Executes ETH transfer to second signer (local) or `TRANSFER_TARGET_ADDRESS` (live testnet). Saves tx hash and receipt JSON to `EVIDENCE/task3/`.
- Mainnet guard (lines 9-19): `ALLOWED_NETWORKS = ["sepolia", "goerli", "hardhat", "localhost"]` — blocks non-allowlisted networks with `process.exitCode = 1`.
- `lib/legal-entity.js` (34 LOC): `loadLegalEntity()` loads `data/legal-entity.json`, validates required fields (name, taxId, jurisdiction, walletAddress, eoaAddress) and Ethereum address formats.
- `lib/bank-accounts.js` (48 LOC): `loadBankAccounts()` validates non-empty accounts array, required fields (id, holder, routingNumber, accountNumber, bankName, type, currency), and 9-digit routing number format. `getVerifiedAccounts()` filters by `verified === true`.
- `data/legal-entity.json`: Markus Holdings LLC (EIN-12-3456789, US-DE jurisdiction, Hardhat default addresses).
- `data/bank-accounts.json`: 2 JPMorgan Chase accounts (checking verified, savings unverified).
- `test/deploy.test.js` (188 LOC, 11 tests): Mainnet guard, simulation data availability, local deploy+transfer (asserts `receipt.status === 1`, `lockAddress` starts with 0x), revert on past unlock time, revert on non-owner withdrawal, zero-value transfer, zero-address transfer, entity fallback tests (missing file, malformed data, missing fields, invalid wallet format, bad routing number).

## Phase 4: Transaction history and SQL API — COMPLETED

- `scripts/fetch.js` (164 LOC): Fetches transactions via `eth_getTransactionByHash` (Hardhat provider RPC) and SQL API. Hash validation via `/^0x[0-9a-fA-F]{64}$/`. Edge cases: invalid hash rejection (lines 52-58), nonexistent transaction returns null (lines 61-76), main fetch with field validation (lines 93-138). SQL API integration (lines 141-156) skips gracefully when unconfigured.
- `lib/sql-api.js` (59 LOC): `fetchTransactionHistory(entityId, options)` — HTTP GET to `${endpoint}/v1/transactions?entityId=...` with Bearer auth. Error handling: 401/403 auth failure, 4xx client error with body extraction, 5xx server unavailable. Fallback: null/empty/non-string entityId returns `{ transactions: [], entityId: null, fallback: true }`. Supports dependency injection via `options.fetchFn`, `options.apiKey`, `options.endpoint`.
- `test/fetch.test.js` (75 LOC, 5 tests): Hash validation (valid/invalid/wrong length), `eth_getTransactionByHash` null for nonexistent, full data for real tx, response field validation.
- `test/sql-api.test.js` (282 LOC, 14 tests): Success response (parse + empty list), 4xx errors (400, 404, empty body 422), 5xx errors (500, 503), auth failure (401, 403), missing entity fallback (null, empty, undefined), non-string entityId (numeric, object), rate limiting (429), network errors (ECONNREFUSED), zero-balance response, missing config (empty apiKey, empty endpoint).

## Phase 5: MCP AgentKit server — COMPLETED

- `scripts/mcp-agentkit-server.mjs`: Model Context Protocol server using Coinbase AgentKit.
- Dependencies: `@coinbase/agentkit` ^0.2.0, `@coinbase/agentkit-model-context-protocol` ^0.2.0, `@modelcontextprotocol/sdk` ^1.17.4.
- Invoked via `npm run mcp:server`.

## Phase 6: Architecture documentation — COMPLETED

- `docs/architecture/README.md`: Navigation, project structure with LOC counts and test counts per file.
- `docs/architecture/DESIGN.md`: System design, component boundaries with key exports, data flows with line references, risks with test verification.
- `docs/architecture/implementation-plan.md`: This file — phased status with concrete code references.
- `EVIDENCE/T1_implementation_inventory.md`: Full file-by-file inventory with line counts and test mappings.

## Verification summary

| Gate | Command | Status |
|---|---|---|
| Install | `npm ci` | PASS |
| Compile | `npm run compile` | PASS |
| Test | `npm test` | PASS (45 tests) |
| README.md | `test -s docs/architecture/README.md` | PASS |
| DESIGN.md | `test -s docs/architecture/DESIGN.md` | PASS |
| implementation-plan.md | `test -s docs/architecture/implementation-plan.md` | PASS |
| Go gates | N/A (Node.js project) | SKIP (expected) |
