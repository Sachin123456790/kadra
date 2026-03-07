# Kadra Backend -- Development Guide

## Prerequisites

- **Node.js** 18+ (tested with 22.x)
- **PostgreSQL** 14+ running on `localhost:5432`
- **npm** (bundled with Node.js) or **pnpm**

---

## Setup

```bash
cd backend
npm install
```

Create a `.env` file (or copy from the example if available):

```bash
# .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kadra_dev
PORT=3000
```

Run the Prisma migration and seed:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Start the development server:

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1/health`.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/kadra_dev` | PostgreSQL connection string |
| `PORT` | No | `3000` | HTTP listen port |

The `PrismaService` falls back to the default connection string if `DATABASE_URL` is not set. In production, always set it explicitly.

---

## Key Commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript via `nest build` |
| `npm run start` | Start production server |
| `npm run start:dev` | Start with file watching (hot reload) |
| `npm run start:debug` | Start with debugger attached |
| `npm run start:prod` | Run compiled JS from `dist/` |
| `npm test` | Run all unit tests (Jest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests (separate Jest config) |
| `npm run lint` | Lint and auto-fix with ESLint |
| `npm run format` | Format with Prettier |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npx prisma migrate dev` | Create a new migration (development) |
| `npx prisma db seed` | Run the seed script |
| `npx prisma studio` | Open Prisma Studio (database GUI) |

---

## Testing

Tests use **Jest 30** with `ts-jest`. All tests are unit tests that mock `PrismaService` -- no live database connection is required.

- **11 test suites** across the codebase
- **99 tests** total
- Test files live alongside their modules at `src/modules/<name>/__tests__/<name>.service.spec.ts`
- Domain tests at `src/domain/__tests__/state-machines.spec.ts`

Run all tests:

```bash
npm test
```

Run a specific suite:

```bash
npx jest --testPathPattern=identity
```

### End-to-End Tests

The E2E test suite (`test/demo-flow.e2e-spec.ts`) runs the full 9-step demo flow (40 tests) against a real PostgreSQL database (typically Supabase). It boots the full NestJS application, seeds data via API calls, and walks through the complete lifecycle: fund overview, document upload, subscription creation, settlement validation, token minting, transfers (legal + illegal), distribution preview, and audit export.

**Prerequisites:**

- A seeded PostgreSQL database (run `npx prisma migrate deploy && npx prisma db seed` first)
- `DATABASE_URL` pointing at the database
- `CRON_SERVICE_TOKEN` set (the E2E test sends this header for job endpoints)

**Run:**

```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  CRON_SERVICE_TOKEN="your-token" \
  npm run test:e2e
```

The test file is at `test/demo-flow.e2e-spec.ts`.

---

## Project Structure

```
backend/
  prisma/
    schema.prisma              # 26 Prisma models
    seed.ts                    # Demo seed data (1 fund, 6 investors, wallets, eligibility, waterfall)
    migrations/                # SQL migrations
  src/
    main.ts                    # Bootstrap: Fastify adapter, global prefix, pipes, filters
    app.module.ts              # Root module (imports all domain modules + Prisma + ConfigModule)
    health.controller.ts       # /health and /version endpoints

    common/
      errors.ts                # AppError, ValidationError, NotFoundError, ConflictError, ExternalDependencyError
      dto/
        response.dto.ts        # SuccessResponse<T>, ErrorResponse, ResponseMeta
      filters/
        app-exception.filter.ts  # Global exception filter (catches AppError + HttpException)
      guards/
        service-token.guard.ts # ServiceTokenGuard (validates x-service-token header for cron endpoints)

    domain/
      enums.ts                 # 22 domain enums
      state-machines.ts        # 5 state machine definitions (generic factory)
      __tests__/
        state-machines.spec.ts

    prisma/
      prisma.module.ts         # @Global() module exporting PrismaService
      prisma.service.ts        # PrismaClient with @prisma/adapter-pg driver adapter

    adapters/
      storage/
        storage.adapter.ts     # DocumentStorageAdapter interface + STORAGE_ADAPTER token
        local-fs.adapter.ts    # Local filesystem implementation
        supabase-storage.adapter.ts  # Supabase Storage implementation (production)
      hash/
        hash.provider.ts       # HashProvider interface + HASH_PROVIDER token
        sha256.provider.ts     # SHA-256 implementation
      parser/
        parser.adapter.ts      # DocumentParserAdapter interface + PARSER_ADAPTER token
        mock-parser.adapter.ts # Mock parser returning deterministic demo fields
      blockchain/
        token-contract.adapter.ts      # TokenContractAdapter interface + TOKEN_CONTRACT_ADAPTER token
        mock-token-contract.adapter.ts # In-memory mock (deploy, mint, transfer, getBalance)

    modules/
      fund/
        fund.module.ts
        fund.controller.ts     # GET /admin/funds/:fundId/overview
        fund.service.ts
        __tests__/fund.service.spec.ts

      identity/
        identity.module.ts
        identity.controller.ts # GET /admin/funds/:fundId/investors, PUT /admin/funds/:fundId/eligibility
        identity.service.ts
        __tests__/identity.service.spec.ts

      documents/
        documents.module.ts    # Wires STORAGE_ADAPTER, HASH_PROVIDER, PARSER_ADAPTER
        documents.controller.ts # POST master-lpa upload, GET parse-status, GET hashes
        documents.service.ts
        __tests__/documents.service.spec.ts

      subscriptions/
        subscriptions.module.ts
        subscriptions.controller.ts # POST create, GET list
        subscriptions.service.ts
        __tests__/subscriptions.service.spec.ts

      settlements/
        settlements.module.ts
        settlements.controller.ts # POST payment-validations, POST settlement-confirmation
        settlements.service.ts
        __tests__/settlements.service.spec.ts

      tokenization/
        tokenization.module.ts  # Wires TOKEN_CONTRACT_ADAPTER
        tokenization.controller.ts # POST token-mint, POST transfers, GET validation/failed/successful
        tokenization.service.ts
        __tests__/
          tokenization.service.spec.ts
          transfer.service.spec.ts

      ownership/
        ownership.module.ts
        ownership.controller.ts # GET cap-table, GET ownership-history
        ownership.service.ts
        __tests__/ownership.service.spec.ts

      distribution/
        distribution.module.ts
        distribution.controller.ts # GET waterfall-configs/active, POST preview, POST runs
        distribution.service.ts
        __tests__/distribution.service.spec.ts

      audit/
        audit.module.ts
        audit.controller.ts    # POST audit-exports, GET audit-exports/:id
        audit.service.ts
        __tests__/audit.service.spec.ts

      jobs/
        jobs.module.ts         # Job infrastructure module
        jobs.controller.ts     # 5 POST endpoints (guarded by ServiceTokenGuard)
        jobs.service.ts        # Batch drain, single run, dead-letter retry, chain ingest, tx sync

  test/
    app.e2e-spec.ts            # E2E test stub
    demo-flow.e2e-spec.ts      # Full 9-step demo flow E2E (40 tests, requires real Postgres)
    jest-e2e.json              # E2E Jest config

  dist/                        # Compiled output (gitignored)
  node_modules/                # Dependencies (gitignored)
  package.json
  tsconfig.json
  tsconfig.build.json
  nest-cli.json
  eslint.config.mjs
  vercel.json                  # Vercel deployment config (dist/src/main.js via @vercel/node)
```

---

## Prisma v7 Driver Adapter Note

This project uses Prisma v7 with the `@prisma/adapter-pg` driver adapter. This means:

1. The `datasource db` block in `schema.prisma` has **no `url` property**. The connection string is passed programmatically in `PrismaService`:

   ```typescript
   const adapter = new PrismaPg({ connectionString });
   super({ adapter });
   ```

2. You cannot use `prisma db pull` or `prisma db push` without passing `--url` explicitly.

3. Migrations work normally via `npx prisma migrate deploy` (reads `DATABASE_URL` from environment).

---

## Common Development Tasks

### Adding a new module

1. Create `src/modules/<name>/<name>.module.ts`, `.controller.ts`, `.service.ts`.
2. Register the module in `src/app.module.ts` imports array.
3. Add tests at `src/modules/<name>/__tests__/<name>.service.spec.ts`.

### Adding a new Prisma model

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name <description>` to generate a migration.
3. Update seed data in `prisma/seed.ts` if needed.

### Swapping an adapter implementation

Change the `useClass` in the module's `providers` array. For example, to use a real Hardhat adapter:

```typescript
// src/modules/tokenization/tokenization.module.ts
{ provide: TOKEN_CONTRACT_ADAPTER, useClass: HardhatTokenContractAdapter }
```
