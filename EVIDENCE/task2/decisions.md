# Task 2 Dependency and Configuration Decisions

## Dependency Audit

| Requested Package | Decision | Rationale |
|---|---|---|
| `@coinbase/wallet-sdk` | SKIPPED | Already using `@coinbase/coinbase-sdk` which covers SDK functionality |
| `@nomicfoundation/hardhat-toolchain` | SKIPPED | Already using `@nomicfoundation/hardhat-toolbox` (equivalent) |
| `@types/pg` | SKIPPED | Project is JavaScript, not TypeScript; no type definitions needed |
| `pg` | SKIPPED | SQL API module will use HTTP fetch (built-in), not direct PostgreSQL connections |

## Environment Variable Additions

| Variable | Purpose | Status |
|---|---|---|
| `TESTNET_RPC` | Alias for SEPOLIA_RPC_URL per scope requirement | Added to .env.example |
| `SQL_API_KEY` | API key for SQL transaction history endpoint | Added to .env.example and validate-env.js |
| `SQL_API_ENDPOINT` | Base URL for SQL data API | Added to .env.example and validate-env.js |

## Security Notes

- Replaced hardcoded Coinbase secrets in .env.example with placeholder values
- `.env` remains gitignored (contains actual credentials)
- Hardhat config validates private key format before use (no Error HH8 from placeholders)
- No mainnet network paths exist in hardhat.config.js

## Test Coverage

- 4 new SQL env validation tests added to config.test.js
- Tests cover: missing SQL_API_KEY, missing SQL_API_ENDPOINT, invalid endpoint format, valid vars
- All 26 tests pass
