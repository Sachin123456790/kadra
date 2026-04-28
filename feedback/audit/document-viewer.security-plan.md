# Document Viewer — Security Plan & Audit

**Agent**: Auditor 4/6
**Date**: 2026-04-18
**Scope**: Admin + investor document content streaming and iframe-based preview.

## Per-Requirement Verdict

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Access control (4 unauthorized paths return NotFound, not Forbidden) | PASS | `investor-portal.service.ts:576-616` |
| 1a | Direct-link test | PASS | `investor-portal.service.spec.ts:237-249` |
| 1b | Governing-doc test | PASS | `investor-portal.service.spec.ts:251-264` |
| 1c | Not-found test | PASS | `investor-portal.service.spec.ts:266-272` |
| 1d | Cross-fund test (NotFoundError, not ForbiddenError) | PASS | spec:274-286; service line 591 returns `NotFoundError` |
| 1e | Linked-to-other-investor test (NotFoundError) | PASS | spec:288-301; service line 615 `NotFoundError` |
| 2 | MIME: Content-Type, Content-Disposition inline, RFC 5987 encoded filename, nosniff | PASS | `documents.controller.ts:98-116`, `investor-portal.controller.ts:201-217` — `filename="..."; filename*=UTF-8''<encoded>`, X-Content-Type-Options: nosniff set on BOTH Fastify and Express branches |
| 3 | Fastify + Express dual-adapter | PARTIAL | Angainor prod uses Fastify only (`main.ts` imports `FastifyAdapter`); the Express branch in both controllers is dead code in production. Minor: acceptable for testability but adds maintenance cost. |
| 4a | Blob URL revoked on close AND unmount | PASS | `DocumentViewerModal.tsx:80-94` — two separate useEffects: one watches `open` flag, one cleans up on unmount |
| 4b | Auth header from client config | PASS | `DocumentViewerModal.tsx:46-48` — reads `AUTH_TOKEN_KEY` from `@/config/constants`, sends as Bearer |
| 5a | Admin View button primary, opens modal | PASS | `DocumentsPage.tsx:248-254, 419, 1614-1623` |
| 5b | Investor View button + download | PASS | `InvestorDocuments.tsx:100-130, 546-555` — note: "Download" tab-column is placeholder (`toast.info("Download feature coming soon")`) — NOT a security issue, but cosmetic inconsistency (row action is "View" and opens modal; modal itself offers a real Download) |
| 6a | Admin endpoint guard: SupabaseAuthGuard + RolesGuard + @Roles(ADMIN_ROLES) | PASS | `documents.controller.ts:54-57` (applied at controller level, inherited by all routes including `:documentId/content`) |
| 6b | Investor endpoint guard: SupabaseAuthGuard + per-investor scoping | PASS | `investor-portal.controller.ts:24` (`@UseGuards(SupabaseAuthGuard)`) + explicit `assertInvestorCanAccessDocument` call before streaming (line 195-199) |
| 7 | TS clean + Jest pass | PASS | Backend + frontend `tsc --noEmit` clean; `investor-portal.service.spec`: 11/11; `documents` spec: 11/11 |

## Security Checklist

### Cross-investor access attempts
- [x] **All 4 unauthorized paths → NotFoundError (404), never 403.** Verified via spec cases (not-found, wrong fund, wrong investor, missing-and-no-subscription). This prevents existence-oracle attacks.
- [x] `assertInvestorCanAccessDocument` runs BEFORE `getDocumentContent` — no data leak if auth fails.

### Fund isolation
- [x] Line 591 (`doc.fundId !== fundId`) blocks investor of fund A from reading a document of fund B even with a valid document ID.
- [x] Subscription lookup at line 604 also scopes by `fundId` — defense in depth.

### MIME sniffing prevention
- [x] `X-Content-Type-Options: nosniff` set on both Fastify (`res.header`) and Express (`res.setHeader`) branches in BOTH controllers. Prevents browser-side MIME-sniff upgrading a text file into script execution.

### PDF XSS
- [x] PDFs rendered in `<iframe>` without a `sandbox` attribute (line 171-175). Browser's native PDF viewer runs in its own origin-segmented process and does not execute embedded JS with parent-document privileges. However, a blob URL shares the parent's origin (`blob:https://app/...`). **MINOR RISK**: if a PDF contains embedded JavaScript AND the user has a PDF engine that honors it, the JS would execute within the blob's origin. For Chrome/Edge/Firefox default PDF viewers this is disabled. Recommendation (non-blocking): add `sandbox="allow-same-origin"` or better for PDFs too; currently only HTML gets sandbox.
- [x] `window.open(blobUrl, "_blank", "noopener")` uses `noopener` — prevents `window.opener` reverse-tabnabbing.

### HTML documents
- [x] HTML branch (line 186-193) uses `sandbox=""` (empty value = **maximum** restriction: no scripts, no same-origin, no forms, no top-navigation). This is stricter than `sandbox="allow-same-origin"` and is the correct default. No `allow-scripts` present — good.

### Download filename injection
- [x] RFC 5987: `filename*=UTF-8''<encodeURIComponent(filename)>` — handles unicode and percent-encodes CR/LF, `"`, `;`.
- [x] Fallback `filename="..."` strips raw `"` via `.replace(/"/g, '')` (line 100, 203). **MINOR**: does not strip CR/LF from the filename; `encodeURIComponent` in the RFC-5987 portion covers it, and browsers prefer the `filename*=` directive, but the unencoded fallback is theoretically injectable if a filename contained `\r\nSet-Cookie:...`. Since filenames originate from `doc.originalFilename` (user-uploaded), this is worth hardening. Recommend replacing with a stricter whitelist (`.replace(/[\r\n"]/g, '')`).

### Auth / CSRF
- [x] No cookies — Bearer token via `Authorization` header only (frontend `DocumentViewerModal.tsx:46-48`). CSRF not applicable.
- [x] Token sourced from `localStorage` via the same key the API client uses (`AUTH_TOKEN_KEY`). Standard for this app.
- [x] Signed tokens validated by `SupabaseAuthGuard` before controller runs.

### Rate limiting
- [ ] **GAP**: Grep for `Throttler|rate-limit|RateLimit` in `backend/src` returned no files. No global rate limiter detected. The content endpoint will accept unlimited requests — a malicious authenticated investor could script a scrape of any doc IDs they enumerate (though 404s gate content). Recommendation (non-blocking, platform-wide): add `@nestjs/throttler` with a modest per-IP default. This is not specific to the new feature.

### Focus trap / ESC / modal a11y
- [x] Dialog uses shadcn/Radix `Dialog` + `DialogContent`, which provide focus trap, ESC-to-close, and `aria-modal` by default. Close button has `aria-label="Close preview"` (line 148).

## Vulnerabilities Found

### HIGH
_(none)_

### MEDIUM
_(none)_

### LOW
1. **Filename header CR/LF hardening** (`documents.controller.ts:100`, `investor-portal.controller.ts:203`): Fallback `filename="..."` only strips `"`. If an attacker upload stored `\r\n` in `originalFilename`, technically valid HTTP framing depends on the server splitting/escaping header values. Fastify's header serializer already rejects CRLF, so exploitability is bounded, but belt-and-suspenders suggests `.replace(/[\r\n"]/g, '')`.
2. **PDF iframe has no sandbox** (`DocumentViewerModal.tsx:171`): Relies on browser PDF viewer's own sandbox. Add `sandbox="allow-same-origin"` to be explicit. (Cannot use empty sandbox on PDFs — would break native viewer.)
3. **Dead Express branch** in both controllers. Angainor runs Fastify exclusively in prod. Minor maintenance overhead.
4. **No rate limiting**. Platform-wide gap — not new in this feature — but the content endpoint streams files, so abuse potential is higher (bandwidth + storage-backend load).

### Cosmetic
- Investor `InvestorDocuments.tsx:262-269` has a dummy "Download" column with `toast.info("Download feature coming soon")`. The modal itself has a working download. Either remove the duplicate column or wire it to the modal's download path.

## Test Results
- Backend `tsc --noEmit`: clean (no output)
- Frontend `tsc --noEmit`: clean (no output)
- `npm test -- investor-portal.service.spec`: **11/11 PASS** (including all 5 `assertInvestorCanAccessDocument` cases)
- `npm test -- documents`: **11/11 PASS**

## Final Verdict

**SHIP IT** — with two small follow-ups tracked (non-blocking):
1. Harden fallback `filename` in Content-Disposition (`.replace(/[\r\n"]/g, '')`).
2. Add `sandbox="allow-same-origin"` to the PDF iframe for belt-and-suspenders.

The core security requirement — preventing cross-investor document access and leaking document existence — is correctly implemented. All unauthorized paths return `NotFoundError`, subscription/fund scoping is correct, iframe sandbox for HTML is maximally strict, and Bearer-token auth avoids CSRF exposure.
