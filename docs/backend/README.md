# Kadra Backend -- Overview

Kadra's backend is a **NestJS 11 modular monolith** running on the **Fastify** HTTP adapter. It exposes a versioned REST API (`/api/v1`) that drives the full lifecycle of a private real estate fund: document upload, investor identity management, subscription tracking, off-chain settlement validation, token minting, LP-to-LP transfers, distribution waterfall calculations, and audit export generation.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | NestJS | 11.x |
| HTTP adapter | Fastify (`@nestjs/platform-fastify`) | 11.x |
| ORM | Prisma | 7.x |
| DB driver adapter | `@prisma/adapter-pg` (driver-adapter mode) | 7.x |
| Database | PostgreSQL | 14+ |
| Validation | `class-validator` + `class-transformer` | 0.15 / 0.5 |
| File upload | `@fastify/multipart` | 9.x |
| UUID generation | `uuid` | 13.x |
| Language | TypeScript | 5.7 |
| Test runner | Jest (`ts-jest`) | 30.x |

---

## Module Map

The application is composed of **10 domain modules**, a global **Prisma module**, and a root-level **HealthController**.

| Module | Responsibility |
|---|---|
| `fund` | Fund entity overview and aggregate statistics |
| `identity` | Investor registry, wallet management, fund eligibility grant/revoke |
| `documents` | Master LPA upload, SHA-256 hashing, document parse status, extracted fields |
| `subscriptions` | Subscription record creation and querying (per-fund, per-investor) |
| `settlements` | 3-way payment validation (amount, investor, reference) and settlement confirmation |
| `tokenization` | ERC-3643 token contract deployment, minting, LP-to-LP transfers, transfer validation |
| `ownership` | Cap table computation, ownership history event log |
| `distribution` | Waterfall configuration, distribution preview, distribution run execution |
| `audit` | Audit export request and status tracking |
| `jobs` | Async job infrastructure: batch drain, single run, dead-letter retry, chain event ingestion (stub), transaction sync (stub) |

All modules are registered in `src/app.module.ts`. The `PrismaModule` is `@Global()`, making `PrismaService` available to every module without explicit imports.

---

## Adapter Interfaces

The backend uses an **adapter pattern** to isolate infrastructure concerns behind interfaces. Each adapter is injected via a NestJS custom provider token.

| Adapter Interface | Token | Current Implementation | Purpose |
|---|---|---|---|
| `DocumentStorageAdapter` | `STORAGE_ADAPTER` | `LocalFsStorageAdapter` (local) / `SupabaseStorageAdapter` (when `SUPABASE_URL` is set) | Save/read/check document files on disk or in Supabase Storage |
| `HashProvider` | `HASH_PROVIDER` | `Sha256HashProvider` | Compute SHA-256 hash of document buffers |
| `DocumentParserAdapter` | `PARSER_ADAPTER` | `MockParserAdapter` | Extract structured fields from uploaded documents |
| `TokenContractAdapter` | `TOKEN_CONTRACT_ADAPTER` | `MockTokenContractAdapter` | Deploy, mint, transfer, and query ERC-3643 token balances |

Swapping implementations (e.g., S3 storage, a real Hardhat/ethers adapter) requires only changing the `useClass` binding in the owning module.

---

## State Machines

Five domain state machines are defined in `src/domain/state-machines.ts` using a generic `createStateMachine<T>()` factory. Each exposes `canTransition(from, to)`, `assertTransition(from, to)`, and `allowedTransitions(from)`.

| State Machine | States |
|---|---|
| `subscriptionStateMachine` | DRAFT -> PENDING -> SETTLED / REJECTED -> CLOSED |
| `settlementStateMachine` | REQUESTED -> VERIFYING -> PASSED / FAILED |
| `transferStateMachine` | REQUESTED -> PRECHECK_FAILED / SUBMITTED -> MINED / CHAIN_REVERTED |
| `distributionRunStateMachine` | QUEUED -> RUNNING -> COMPLETED / FAILED |
| `exportStateMachine` | QUEUED -> BUILDING -> READY / FAILED -> EXPIRED |

---

## Domain Enums

22 enums are defined in `src/domain/enums.ts`:

`FundStatus`, `LegalForm`, `VerificationStatus`, `WalletStatus`, `EligibilityStatus`, `DocumentType`, `StorageProvider`, `ParseStatus`, `HashAlgorithm`, `SubscriptionStatus`, `SettlementStatus`, `SettlementFailureCode`, `ContractDeploymentStatus`, `TokenEventType`, `TransferRequestStatus`, `TransferFailureCode`, `DistributionRunStatus`, `ExportStatus`, `WaterfallBasis`, `DistributionFrequency`, `JobStatus`

(21 listed above; the 22nd is the implicit enum values for `SettlementEvidence.evidenceType` which is stored as a string column rather than a TypeScript enum.)

---

## Error Handling

A global `AppExceptionFilter` (registered in `src/main.ts`) catches all exceptions and returns a consistent envelope:

```typescript
// Error response shape
{
  error: { code: string; message: string },
  meta:  { requestId: string; timestamp: string }
}
```

The error taxonomy in `src/common/errors.ts`:

| Class | HTTP Status | Code Pattern |
|---|---|---|
| `AppError` (base) | configurable | custom `code` string |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `NotFoundError` | 404 | `{ENTITY}_NOT_FOUND` |
| `ConflictError` | 409 | custom code |
| `ExternalDependencyError` | 503 | `EXTERNAL_DEPENDENCY_ERROR` |

Standard NestJS `HttpException` instances are also caught and mapped.

---

## Response Envelope

All successful responses follow the `SuccessResponse<T>` shape defined in `src/common/dto/response.dto.ts`:

```typescript
{
  data: T,
  meta: { requestId: string; timestamp: string }
}
```

List endpoints add a `count` field to `meta`.

---

## Key Files

| Path | Purpose |
|---|---|
| `src/main.ts` | Bootstrap: Fastify adapter, global prefix, validation pipe, exception filter |
| `src/app.module.ts` | Root module registering all 10 domain modules + Prisma + Health |
| `src/domain/enums.ts` | All 22 domain enums |
| `src/domain/state-machines.ts` | 5 state machine definitions |
| `src/common/errors.ts` | AppError hierarchy |
| `src/common/dto/response.dto.ts` | Response envelope DTOs |
| `src/common/filters/app-exception.filter.ts` | Global exception filter |
| `src/prisma/prisma.service.ts` | PrismaClient with `@prisma/adapter-pg` driver adapter |
| `src/adapters/storage/supabase-storage.adapter.ts` | Supabase Storage adapter (production file storage) |
| `src/common/guards/service-token.guard.ts` | ServiceTokenGuard for cron/admin job endpoints |
| `src/modules/jobs/jobs.service.ts` | Job runner: batch drain, single run, dead-letter retry, chain ingest, tx sync |
| `src/modules/jobs/jobs.controller.ts` | 5 POST endpoints for job management (guarded by `ServiceTokenGuard`) |
| `test/demo-flow.e2e-spec.ts` | Full 9-step demo flow E2E test (40 tests, runs against real Postgres) |
| `vercel.json` | Vercel deployment config (`dist/src/main.js` via `@vercel/node`) |
| `prisma/schema.prisma` | 26 Prisma models |
| `prisma/seed.ts` | Demo seed data |
