# Path Mapping: Requested vs Actual

| Requested Path | Actual Path | Status |
|---|---|---|
| `hardhat.config.js` | `hardhat.config.js` | EXISTS |
| `scripts/deploy.js` | `scripts/deploy.js` | EXISTS |
| `scripts/deploy.ts` | N/A | NOT FOUND (JS project, not TS) |
| `scripts/fetch.js` | `scripts/fetch.js` | EXISTS |
| `scripts/fetch.ts` | N/A | NOT FOUND (JS project, not TS) |
| `lib/sql-api.js` | `lib/sql-api.js` | EXISTS |
| `src/utils/sqlApi.ts` | `lib/sql-api.js` | REMAPPED (TS path does not exist) |
| `lib/validate-env.js` | `lib/validate-env.js` | EXISTS |
| `lib/legal-entity.js` | `lib/legal-entity.js` | EXISTS |
| `lib/bank-accounts.js` | `lib/bank-accounts.js` | EXISTS |
| `lib/coinbase-sdk-helper.js` | `lib/coinbase-sdk-helper.js` | EXISTS (not in scope list but present) |
| `test/*.js` | `test/Lock.js`, `test/config.test.js`, `test/fetch.test.js`, `test/sql-api.test.js`, `test/deploy.test.js` | EXISTS |
| `.env.example` | `.env.example` | EXISTS (confirmed in repo) |
| `docs/architecture/DESIGN.md` | N/A | MISSING (directory empty) |
| `docs/architecture/implementation-plan.md` | N/A | MISSING (directory empty) |
| `data/bank-accounts.json` | `data/bank-accounts.json` | EXISTS |
| `data/legal-entity.json` | `data/legal-entity.json` | EXISTS |

## Key observations
- Project is pure JavaScript (CommonJS), not TypeScript.
- No `src/` directory exists; all source is under `lib/` and `scripts/`.
- Architecture docs directory exists but is empty.
- `features/` folder does NOT exist inside the project (task files are external).
