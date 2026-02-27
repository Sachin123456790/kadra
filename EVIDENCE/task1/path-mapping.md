# Requested-File to Actual-File Mapping

| Requested Path (from scope) | Actual Path | Status |
|---|---|---|
| `hardhat.config.js` | `hardhat.config.js` | Exists |
| `scripts/deploy.js` | `scripts/deploy.js` | Exists |
| `scripts/deploy.ts` | N/A | Does not exist; project uses `.js` |
| `scripts/fetch.js` | `scripts/fetch.js` | Exists |
| `lib/coinbase-sdk-helper.js` | `lib/coinbase-sdk-helper.js` | Exists |
| `lib/validate-env.js` | `lib/validate-env.js` | Exists |
| `lib/legal-entity.js` | `lib/legal-entity.js` | Exists |
| `lib/bank-accounts.js` | `lib/bank-accounts.js` | Exists |
| `src/utils/sqlApi.ts` | N/A | Does not exist; will create as `lib/sql-api.js` per project conventions |
| `test/config.test.js` | `test/config.test.js` | Exists |
| `test/deploy.test.js` | `test/deploy.test.js` | Exists |
| `test/fetch.test.js` | `test/fetch.test.js` | Exists |
| `.env.example` | `.env.example` | Exists |
| `docs/architecture/DESIGN.md` | N/A | Directory exists but file is MISSING |
| `docs/architecture/implementation-plan.md` | N/A | Directory exists but file is MISSING |

## Language Convention

- Project uses **JavaScript** (`.js`) with `"type": "commonjs"` in `package.json`.
- No TypeScript compilation is configured (no `tsconfig.json`).
- All new files will use `.js` extension following existing conventions.
- The scope reference to `src/utils/sqlApi.ts` is mapped to `lib/sql-api.js`.

## Architecture Doc Status

- `docs/architecture/` directory exists but is empty.
- Neither `DESIGN.md` nor `implementation-plan.md` is present.
- This is acknowledged; implementation proceeds using existing code patterns as the source of truth.
