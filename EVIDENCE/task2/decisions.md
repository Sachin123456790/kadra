# Task 2: Dependency and Configuration Decisions

Generated: 2026-02-26 (fresh session)

## Dependency Audit

| Requested Package | Decision | Rationale |
|---|---|---|
| `@coinbase/wallet-sdk` | **SKIPPED** | Already using `@coinbase/coinbase-sdk` (line 24 of package.json) |
| `@nomicfoundation/hardhat-toolchain` | **SKIPPED** | Already using `@nomicfoundation/hardhat-toolbox` ^6.1.2 (equivalent) |
| `@types/pg` | **SKIPPED** | Project is JavaScript, not TypeScript; no type definitions needed |
| `pg` | **SKIPPED** | SQL API uses HTTP fetch (built-in), not direct PostgreSQL connections |

## Environment Variable Contract

| Variable | File | Status |
|---|---|---|
| `SEPOLIA_RPC_URL` | `.env.example:4`, `lib/validate-env.js:31` | EXISTS (primary) |
| `TESTNET_RPC` | `.env.example:5` | EXISTS (alias, per scope requirement) |
| `SQL_API_KEY` | `.env.example:38`, `lib/validate-env.js:53` | EXISTS |
| `SQL_API_ENDPOINT` | `.env.example:40`, `lib/validate-env.js:58` | EXISTS |
| `DEPLOYER_PRIVATE_KEY` | `.env.example:9`, `lib/validate-env.js:36` | EXISTS |

## Testnet Safety

- `hardhat.config.js` only defines `sepolia` network (chainId 11155111)
- No `mainnet` network path exists
- `DEPLOYER_PRIVATE_KEY` validated with regex before use — placeholder values are safely ignored
- `scripts/deploy.js` has explicit `ALLOWED_NETWORKS` guard blocking non-testnet networks

## SQL Env Validation Tests (test/config.test.js)

4 tests cover SQL env vars:
1. Missing `SQL_API_KEY` -> throws
2. Missing `SQL_API_ENDPOINT` -> throws
3. Invalid `SQL_API_ENDPOINT` format -> throws
4. Valid SQL env vars -> passes

## Acceptance Criteria Check

- [x] Dependency decisions explicit and evidence-backed (all 4 audited)
- [x] `.env.example` documents SQL/testnet vars with placeholders only
- [x] Env validation tests cover missing/invalid new variables
- [x] Hardhat config remains testnet-safe (no mainnet default)
- [x] Compile and tests pass (47/47, exit code 0)
