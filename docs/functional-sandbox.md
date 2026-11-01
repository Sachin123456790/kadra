# Functional Angainor sandbox

This opt-in application makes the Control Room operate on persistent fund records. It has a separate backend entrypoint and tables. The earlier public, read-only demo and the legacy blockchain application are not the sandbox API.

## Run locally for no service subscription

Requirements: Node 22.13 or newer, npm, and LibreOffice (`soffice`) for DOCX conversion. PDF OCR is bundled locally in English. No Docker, PostgreSQL server, paid API key or wallet is required.

From the repository root:

```sh
npm ci --prefix backend
npm ci --prefix frontend
node scripts/run-sandbox.mjs
```

Open http://127.0.0.1:8081. Choose “Have an invitation? Create a sandbox”. The first startup generates a private invitation code in `backend/.sandbox/invite-code`. Use a password of at least 12 characters. Each registration creates its own organization and fictional Northstar fund. There is no shipped default account or password.

If a newer npm version refuses the official SheetJS tarball, use `npm ci --prefix backend --allow-remote=root`. Its pinned URL and integrity hash are in the lockfile. This uses the publisher's [documented distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), because the npm registry release is outdated.

Optional configuration goes in ignored `backend/.env.sandbox`, copied from `.env.sandbox.example`. The launcher reads this file; standalone `sandbox:start` does not load it automatically. `SANDBOX_DATABASE_URL` is the only external database setting recognized. The legacy `DATABASE_URL` is intentionally ignored.

Optional local AI:

```sh
OLLAMA_NO_CLOUD=1 ollama serve
ollama pull qwen3:4b-instruct-2507-q4_K_M
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M node scripts/run-sandbox.mjs
```

Run the model download in a second terminal while Ollama is serving. The model takes about 2.5 GB of disk space. An already downloaded model incurs no API charge. Without Ollama, source retrieval, reviewed notice-rule answers and deterministic record totals still work. Notice answers explicitly distinguish fund-wide and investor-specific rules. AI drafts are labeled and source identifiers are validated; this does not prove every generated assertion. Files and prompts are sent only to a loopback Ollama endpoint. Never configure a remotely executed model.

Local operation uses the host's disk, memory and electricity. This is not a free always-on cloud deployment. The Mac must remain available. No tunnel, public backend, billing account or paid resource is created by the launcher. Sharing the new interactive environment with a remote reviewer still requires a deliberate hosting or private access setup; do not publish Vite's development server.

## Working flows and acceptance checks

| Screen                    | Working behavior                                                                                            | Acceptance check                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign in                   | Invitation-gated account creation, hashed passwords, opaque cookie sessions, separate personal organization | Two accounts see different fund IDs; another account cannot open documents or artifacts by ID                                                                |
| Dashboard                 | Persistent selected fund records and summaries                                                              | Reload and restart the API; records and audit history remain                                                                                                 |
| Investors / Subscriptions | Create and revise investors and commitments                                                                 | Financial amounts reject extra decimals; a commitment cannot fall below funded plus reserved amounts                                                         |
| SPVs / Properties         | Create and revise vehicles and linked properties                                                            | A property must reference an SPV in the same fund; ownership is a decimal fraction in (0,1]                                                                  |
| Financial records         | Contributions, income, expenses, valuations and distribution postings; posted corrections use reversals     | Contributions respect commitment and approved-call balances; duplicate reversals fail                                                                        |
| Documents                 | PDF, scanned PDF, DOCX, XLSX and CSV upload; immutable original versions, status and bounded retries        | Uploaded text receives page or sheet/cell evidence; DOCX retains a PDF rendition; failed conversion keeps the original                                       |
| Waterfall Terms           | Typed taxonomy, extraction suggestions, scoped interpretations, effective dates, versioned rulebooks        | A conflicting interpretation for the same scope/date requires an explicit precedence decision; missing extraction remains unknown                            |
| Fund Brain                | Source search, optional local AI drafts and exact totals of structured commitments/contributions            | Unknown questions abstain; citations retain document version and page/cell; record totals retain all record revisions and a hash                             |
| Capital Calls             | Draft, edit, calculate, review, approve/reject, cancel unapproved drafts, export notices and receipt        | Allocations sum to the requested cents, exceptions apply, short notice blocks, input changes require recalculation, concurrent approvals cannot over-reserve |
| Distributions             | Saved, deterministic first-distribution scenarios                                                           | Return of capital + simple Actual/365 preference + residual split equals available proceeds; unsupported histories/terms block                               |
| Cap Table                 | Investor commitment, contribution and outstanding call summary; JSON export                                 | Contributions reduce the correct approved call balance and reversals restore it                                                                              |
| Activity / Exports        | Worker activity, review actions, approvals, downloadable PDF notices and JSON workflow receipts             | Evidence hashes can be recomputed from exported inputs and results; approval and audit updates are rejected by database triggers                             |
| Settings                  | Reset just this personal sandbox to a new generation                                                        | Private uploads remain in an archive; old processing cannot write into the new generation; other accounts are unaffected                                     |

The synthetic fund has USD 10 million of commitments across six investors, USD 2 million of dated contributions, two SPVs, two properties and three actual synthetic PDFs. Birch has a 15 calendar day notice exception; Cedar is excused from acquisitions. The seed rulebook explicitly permits pro rata redistribution among eligible investors. Its fictional decisions are labeled as fixtures.

## Runtime and evidence model

React, the existing Control Room styles, TanStack Query, NestJS and PostgreSQL semantics are reused. `VITE_SANDBOX_MODE=true` selects the new frontend. `backend/src/sandbox/main.ts` loads only the sandbox module, excluding unsafe legacy globally scoped routes. The legacy global reset endpoint is also disabled.

PGlite stores a real PostgreSQL database at `backend/.sandbox/postgres`. Run one API/worker process against that directory. For a later hosted PostgreSQL instance, set a separate `SANDBOX_DATABASE_URL`; schema initialization currently requires privilege to create the nonlogin application role and set it on transactions. That hosted path has not been integration-tested against an external server. Use a migration owner and restricted runtime connection before production.

`schema.ts` is the executable schema. UUID primary keys identify users, organizations, funds, records, document versions, sources, facts, rulebooks, calls, calculation runs, decisions, jobs and artifacts. Financial records use `numeric(20,2)` with required USD currency in validated data. Percentages use decimal fractions and Decimal arithmetic. Dates are calendar dates; audit timestamps are timezone-aware. Composite organization/fund foreign keys prevent cross-tenant evidence links. Investor, SPV, property and financial fields are validated typed JSON records for this demo; this is not a full accounting ledger or the final normalized production model.

Uploaded originals are stored privately as database bytes with SHA-256, logical document ID and version. This keeps a small demo deployable without a separate object-storage service. Sources retain the exact text and page or sheet/cell locator. DOCX page numbers refer explicitly to the retained PDF rendition. OCR confidence and review flags stay on the source. Section headings are not guaranteed; the UI does not invent them.

The taxonomy preserves the supplied 23 keys and adds capital-call controls and catch-up mechanics. Local patterns suggest only a few recognized terms. Other terms remain `NOT_EXTRACTED`; a reviewer can enter a typed interpretation backed by a source. Completing document review explicitly rejects unaccepted suggestions. Published rulebooks preserve effective dates, investor scope, decision reason, reviewer and source ID. Later effective rules take precedence within the same scope; investor rules override fund rules where the supported calculation consumes them. Human review is still required to identify provisions that pattern extraction misses.

Capital-call runs freeze the call revision, investor/financial revisions, positions, full rulebook, original document versions and hashes, and source evidence. Inputs and results have canonical hashes and immutable database fields. Approval re-reads those inputs within an organization lock, compares hashes, records the decision, and reserves capacity. Notices are draft PDFs only. A JSON receipt contains the frozen run, calculations, evidence and approval. Rejection retains the exact reviewed run and creates a new draft revision.

Document jobs are persisted, leased, fenced by attempt and sandbox generation, and limited to three attempts. Failed jobs can be retried explicitly. Expired final leases become visible failures. Successful extraction inserts sources and facts atomically. A reset cancels old jobs and archives funds instead of deleting uploads. Audit rows, sources, answers, rulebooks and approval decisions are append-only. The database owner can still alter database structure; this is not an independently controlled or blockchain-backed proof system.

## Access and API

Every request resolves a session and organization membership. Roles are owner, editor, reviewer, approver and reader. A personal sandbox owner can perform all demo actions, including explicitly labeled self-approval. The schema supports multiple memberships, but team invitation and fund-specific grants are not exposed yet: all funds in the personal organization share the membership role. No investor portal is enabled. Tenant-scoped database operations set a non-bypass RLS role plus organization context. Auth and background workers use a trusted server connection. Files have no public storage URL.

API base: `/api/v1/sandbox`. Responses are JSON unless downloading content. Mutations require a unique `Idempotency-Key` except login, logout, registration and question submission. Reusing the same key and body returns the previous result; changing the body with that key returns 409. The UI disables pending submits and shows API failures. Cookies are HttpOnly and SameSite=Strict. A future HTTPS host must set `SANDBOX_SECURE_COOKIE=true`, explicit allowed origins, and same-origin API routing.

| Method/path suffix                                                          | Purpose and inputs                                                                            | Role / principal errors                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| POST `/auth/register`, `/auth/login`, `/auth/logout`; GET `/auth/me`        | Name/email/password/invitation; create or resolve cookie session                              | Public registration is invitation-gated; 401 invalid session, 403 bad invitation, 429 throttled |
| GET `/state?fundId=…`                                                       | Active organization funds, records, rules, jobs, runs and recent activity                     | Any member; 404 unknown or archived active fund                                                 |
| POST `/funds`                                                               | Name and USD currency; returns fund UUID                                                      | Owner/editor; 422 unsupported currency                                                          |
| POST `/funds/:fundId/records/:kind`; PUT same plus `/:id`                   | Validated record data; revision required for update                                           | Owner/editor; 422 invalid reference/capacity, 409 stale revision                                |
| POST `/funds/:fundId/records/:id/reverse`                                   | Reason; appends reversal                                                                      | Owner/editor; 409 already reversed                                                              |
| POST `/funds/:fundId/documents`                                             | Multipart file, type, optional effective date and replaced document ID                        | Owner/editor; 413 quota, 415 format                                                             |
| GET `/funds/:fundId/sources`, `/documents/:id/content`                      | Source passages and private original/rendition; optional documentId / original=true           | Any member of owning organization; 404 otherwise                                                |
| POST `/funds/:fundId/jobs/:id/retry`                                        | Retry bounded failed processing                                                               | Owner/editor; 422 exhausted/nonfailed job                                                       |
| POST `/funds/:fundId/rules`                                                 | Key/value, source, investor scope, effective date, base version, reason, explicit replacement | Owner/reviewer; 409 conflict/stale version, 422 evidence/type                                   |
| POST `/funds/:fundId/documents/:id/review`                                  | Review reason; reject remaining suggestions and finish review                                 | Owner/reviewer; 422 not processed                                                               |
| POST `/funds/:fundId/questions`                                             | Question and as-of date; saves evidence-backed answer or abstention                           | Any member; local AI failure falls back visibly to evidence search                              |
| POST `/funds/:fundId/calls`; PUT same plus `/:id`                           | Amount, purpose, dates; update revision/reason or cancel flag                                 | Owner/editor; 409 locked/stale draft                                                            |
| POST `/funds/:fundId/calls/:id/calculate`                                   | Call revision; returns immutable run ID and checks                                            | Owner/editor; failed checks produce BLOCKED, not fabricated success                             |
| POST `/funds/:fundId/runs/:id/approve` or `/reject`                         | Exact input/result hashes and reason                                                          | Owner/approver; 409 stale inputs or nonreviewable run                                           |
| POST `/funds/:fundId/runs/:id/export`; GET `/funds/:fundId/artifacts[/:id]` | Generate draft notices/receipt, list and privately download                                   | Owner/editor to generate, member to read; 422 approval required                                 |
| POST `/funds/:fundId/scenarios`; GET `/funds/:fundId/report`                | Amount/date scenario or current investor summary                                              | Owner/editor for scenarios; 422 unsupported waterfall                                           |
| POST `/reset`; GET `/archive`                                               | Current generation and literal RESET; retrieve archived private uploads                       | Owner resets; 409 stale generation                                                              |

Unexpected server errors are sanitized and include a request ID. Monetary input is a decimal string, never a JavaScript float. Financial calculations use Decimal with 40-digit working precision and cent-level rounding. Largest remainder allocation uses stable investor IDs to break cent ties.

## Boundaries and next work

Implemented calculations deliberately support commitment-based USD capital calls, calendar-day notices, explicit investor excuses, explicit eligible-investor redistribution and non-recallable capital. They block unsupported bases, business-day calendars, inactive investor treatment and dates predating any posted financial record. Historical commitment reconstruction, multiple currencies, fee offsets, equalization and complex default remedies need additional reviewed rule types and test cases.

Distribution results are aggregate simulations only: first distribution, return of all contributed capital, simple Actual/365 preference, no catch-up and LP/GP residual split. No distribution approval/posting workflow, per-investor waterfall or investor report package is represented as complete. Spreadsheets currently become cited evidence; they do not automatically post a financial import. Subscription screens manage commitment records, not e-signing or KYC.

Next implementation order: (1) reviewed spreadsheet mapping/import and evidence links for manual financial records, (2) team invitations plus fund-specific permissions and two-person approvals, (3) structured conflict/missing-information queue beyond the current review controls, (4) expanded waterfall and investor reporting, (5) private hosted runtime and backups. Harden before untrusted public upload: process-isolated parser limits, malware scanning, comprehensive archive-bomb defense, network/file isolation for LibreOffice, deletion/retention controls, monitoring, password recovery and independent security review. The 10 MB upload, 80-page PDF, 20-sheet/1,000-row/50-column spreadsheet and 100 MB organization quotas are demo bounds, not a comprehensive hostile-file defense.

No blockchain, tokenization, payments, emailed notices or external accounting integrations are enabled. No claims are made about legal correctness of a human interpretation or an AI draft. The original private export is not in this public repository.

## Verification

```sh
npm run sandbox:test --prefix backend
npm run build:sandbox --prefix frontend
```

The sandbox tests exercise two-tenant API and RLS isolation, invitation sessions, CSRF, roles, idempotency, exact money, stale inputs, concurrent approval capacity, immutable evidence, investor exceptions, OCR, DOCX rendition, spreadsheet citations, document review, record totals, scenario limits, failed leases, reset isolation and persistence after restart. The legacy frontend has pre-existing TypeScript errors in wallet/onboarding code; the sandbox has a separate typecheck configuration and builds independently.

Credential hygiene: a local Vercel credential file and runtime cache were already tracked in the inherited repository. This change removes those paths from the current tree and ignores `Library/`. The old credentials still require revocation and any desired history cleanup by the repository owner. Do not copy their values into issues, logs or this document.
