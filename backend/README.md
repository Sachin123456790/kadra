# Angainor Backend

NestJS 11 + Fastify + Prisma v7 + PostgreSQL API for the Angainor fund settlement platform.

## Stack

- NestJS 11 (Fastify adapter locally, Express on Vercel)
- Prisma v7 with `@prisma/adapter-pg`
- PostgreSQL (Supabase in production, local Postgres for dev)
- Local bcrypt + JWT auth (no Supabase Auth)
- viem for on-chain reads + admin-side mints
- pdfmake + marked for notice / GP-admin export PDFs
- Multer (Vercel) / `@fastify/multipart` (local) for file uploads

## Modules

| Module | Purpose |
|---|---|
| `auth` | Signup, login, JWT validation, role guards |
| `fund` | Fund CRUD, waterfall config, activity feed |
| `identity` | Investor registry, KYC/accreditation, wallet linking, **bulk CSV/XLSX import** |
| `documents` | Upload, SHA-256 hashing, parse status, hash verification |
| `subscriptions` | Subscription lifecycle |
| `settlements` | 3-way wire match + auto-mint with retries |
| `tokenization` | ERC-3643 deploy / mint (server-side) + transfer (frontend-signed) |
| `ownership` | Cap table, ownership snapshots, capital accounts |
| `distribution` | Waterfall distribution calculation + line items |
| `capital-calls` | Capital call issuance + payment response tracking |
| `notices` | Markdown-driven notice generation, pdfmake renderer, delivery tracking |
| `audit` | Audit export, event log, document provenance, GP/Admin export PDF |
| `investor-portal` | Investor self-service: dashboard, profile, wallet link, documents |
| `jobs` | Background job scheduling |

## Setup

```bash
npm install
cp .env.example .env       # set DATABASE_URL, JWT_SECRET, RPC_URL, deployer key, etc.
npm run prisma:migrate     # apply migrations against local DB
npm run start:dev          # http://localhost:3000
```

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start API in watch mode |
| `npm run start:prod` | Production mode |
| `npm test` | Run Jest unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Coverage report |
| `npx prisma migrate dev --config prisma/prisma.config.ts --name <name>` | Create + apply a migration |

## Auth & Roles

- Roles: `admin`, `platform_admin`, `fund_admin`, `operations_analyst`, `investor`.
- Admin routes: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...ADMIN_ROLES)`.
- Investor routes: `@UseGuards(JwtAuthGuard)` with email-scoped data; unauthorized access returns `NotFoundError` (no existence oracle).
- Public endpoints: marked with `@Public()`.

## Vercel Gotcha (Important)

The Vercel build uses Express + Multer (not Fastify). Every upload endpoint MUST be registered in `src/vercel.ts`:

```ts
server.post(/.*\/admin\/<route>.*/, upload.single('file'));
```

Otherwise `req.file` is undefined and uploads fail silently.

## Prisma Migrate Against Supabase

Use port **5432** (session pooler), not 6543 (transaction pooler). The transaction pooler does not support advisory locks and migrations hang indefinitely.

```bash
DATABASE_URL='postgresql://...@aws-0-us-west-2.pooler.supabase.com:5432/postgres' \
  npx prisma migrate deploy --config prisma/prisma.config.ts
```

## Production

Deployed to Vercel serverless: https://backend-kappa-olive-96.vercel.app

See the project root `README.md` for full architecture context.
