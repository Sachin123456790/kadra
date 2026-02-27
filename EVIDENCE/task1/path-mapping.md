# Requested-File to Actual-File Mapping

Generated: 2026-02-26 (fresh session)

## Architecture Documents

| Requested Path | Status | Verification |
|---|---|---|
| `docs/architecture/DESIGN.md` | **MISSING** | `[ -f docs/architecture/DESIGN.md ] && echo present || echo missing` -> missing |
| `docs/architecture/implementation-plan.md` | **MISSING** | `[ -f docs/architecture/implementation-plan.md ] && echo present || echo missing` -> missing |

Directory exists but is empty. Not a blocker; implementation uses existing code patterns as source of truth.

## Source File Mapping

| Requested Path (scope doc) | Actual Path | Status |
|---|---|---|
| `hardhat.config.js` | `hardhat.config.js` | EXISTS |
| `scripts/deploy.js` | `scripts/deploy.js` | EXISTS |
| `scripts/deploy.ts` | N/A | JS convention; no TS in project |
| `scripts/fetch.js` | `scripts/fetch.js` | EXISTS |
| `lib/coinbase-sdk-helper.js` | `lib/coinbase-sdk-helper.js` | EXISTS |
| `lib/validate-env.js` | `lib/validate-env.js` | EXISTS |
| `lib/legal-entity.js` | `lib/legal-entity.js` | EXISTS |
| `lib/bank-accounts.js` | `lib/bank-accounts.js` | EXISTS |
| `src/utils/sqlApi.ts` | `lib/sql-api.js` | MAPPED to JS convention |
| `test/config.test.js` | `test/config.test.js` | EXISTS |
| `test/deploy.test.js` | `test/deploy.test.js` | EXISTS |
| `test/fetch.test.js` | `test/fetch.test.js` | EXISTS |
| `.env.example` | `.env.example` | EXISTS |
| `package.json` | `package.json` | EXISTS |

## Additional Files

| Path | Purpose |
|---|---|
| `test/sql-api.test.js` | SQL API edge-case tests (14 tests) |
| `test/Lock.js` | Default Hardhat Lock contract tests |
| `contracts/Lock.sol` | Solidity Lock contract |
| `data/legal-entity.json` | Legal entity simulation data |
| `data/bank-accounts.json` | Bank account simulation data |

## Language Convention

- Project uses **JavaScript** (`.js`) with `"type": "commonjs"` in `package.json`.
- No TypeScript compilation configured (no `tsconfig.json`).
- Scope reference to `src/utils/sqlApi.ts` is mapped to `lib/sql-api.js`.
