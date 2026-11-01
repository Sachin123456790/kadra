# Shareable Control Room demo

This branch adds an isolated, read-only interface demo. All fixture records are hand-authored and fictional. No exported fund data is included. The normal application remains the default when demo mode is absent.

Deploy a separate Vercel project from this branch with root directory `frontend`, the Vite preset, `npm run build`, and output directory `dist`.

Set both environment variables on the demo project:

```text
VITE_DEMO_MODE=true
ANGAINOR_DEMO_MODE=true
```

Use `/login` or `/dashboard` as the entry link. The demo has a one-click entry and does not ask visitors for credentials. Its session token is a UI fixture, not an access control. Protect the deployment with Vercel's access controls and share its protected link with reviewers.

The same-origin `/api/v1` routes serve only the synthetic fixture handler. The handler returns 404 unless explicitly enabled, rejects writes except opening a demo session, and has no database, external network, or wallet dependency. The frontend blocks writes and uploads before sending them. Do not connect production secrets or storage to this project.

Supported review paths include the dashboard, source list and previews, workspace search, investor and subscription lists, waterfall terms, and theme switching. Uploads, approvals, settlement, distributions, minting, and persistent edits are unavailable.

Run `node --test demo/handler.test.mjs` for server isolation checks and `npm test` for frontend checks. Build with `VITE_DEMO_MODE=true npm run build` for the hosted demo.
