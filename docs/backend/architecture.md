# Kadra Backend -- Architecture Deep Dive

## Modular Monolith

The backend follows a **modular monolith** pattern: a single deployable NestJS application composed of discrete, loosely-coupled modules. Each module owns its controllers, services, and (where applicable) adapter bindings. Cross-module communication happens through NestJS dependency injection -- modules export their services, and consuming modules import them.

This structure preserves the option to extract modules into separate microservices later without rewriting business logic.

---

## Module Dependency Graph

```
AppModule
  |
  +-- ConfigModule (global)
  +-- PrismaModule (global)
  |
  +-- HealthController (root-level, no module)
  |
  +-- FundModule
  +-- IdentityModule
  +-- DocumentsModule -----> [STORAGE_ADAPTER, HASH_PROVIDER, PARSER_ADAPTER]
  +-- SubscriptionsModule
  +-- SettlementsModule
  +-- TokenizationModule ---> [TOKEN_CONTRACT_ADAPTER]
  +-- OwnershipModule
  +-- DistributionModule
  +-- AuditModule
  +-- JobsModule (skeleton)
```

All modules depend on `PrismaModule` (global, no explicit import needed). No domain module currently imports another domain module's exports -- each module queries the database directly through `PrismaService`.

---

## Adapter Pattern

Infrastructure concerns are isolated behind interfaces defined in `src/adapters/`. Each interface is paired with:

1. A **string injection token** (e.g., `STORAGE_ADAPTER`).
2. One or more **concrete implementations**.
3. A **module-level provider binding** that maps the token to the active implementation.

### DocumentStorageAdapter

```
src/adapters/storage/storage.adapter.ts
```

```typescript
interface DocumentStorageAdapter {
  save(key: string, data: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}
```

- Token: `STORAGE_ADAPTER`
- Implementation: `LocalFsStorageAdapter` -- writes to `<cwd>/storage/documents/`
- Bound in: `DocumentsModule`

### HashProvider

```
src/adapters/hash/hash.provider.ts
```

```typescript
interface HashProvider {
  hash(data: Buffer): string;
}
```

- Token: `HASH_PROVIDER`
- Implementation: `Sha256HashProvider` -- uses Node.js `crypto.createHash('sha256')`
- Bound in: `DocumentsModule`

### DocumentParserAdapter

```
src/adapters/parser/parser.adapter.ts
```

```typescript
interface DocumentParserAdapter {
  parse(data: Buffer, documentType: string): Promise<ExtractedField[]>;
}
```

Where `ExtractedField` is:

```typescript
{
  fieldName: string;
  fieldValueText?: string;
  fieldValueNumeric?: number;
  confidence: number;
  sourcePage?: number;
}
```

- Token: `PARSER_ADAPTER`
- Implementation: `MockParserAdapter` -- returns 8 hardcoded fields for demo
- Bound in: `DocumentsModule`

### TokenContractAdapter

```
src/adapters/blockchain/token-contract.adapter.ts
```

```typescript
interface TokenContractAdapter {
  deploy(input: DeployInput): Promise<{ contractAddress: string; txHash: string; blockNumber: number }>;
  mint(input: MintInput): Promise<{ txHash: string; blockNumber: number }>;
  transfer(input: TransferInput): Promise<{ txHash: string; blockNumber: number }>;
  getBalance(contractAddress: string, walletAddress: string): Promise<string>;
}
```

- Token: `TOKEN_CONTRACT_ADAPTER`
- Implementation: `MockTokenContractAdapter` -- in-memory balance tracking, deterministic tx hashes
- Bound in: `TokenizationModule`

---

## State Machine Design

All state machines are created by a single generic factory in `src/domain/state-machines.ts`:

```typescript
function createStateMachine<T extends string>(transitions: TransitionMap<T>) {
  return {
    canTransition(from: T, to: T): boolean;
    assertTransition(from: T, to: T): void;    // throws Error on invalid
    allowedTransitions(from: T): T[];
  };
}
```

### Subscription State Machine

```
DRAFT --> PENDING --> SETTLED --> CLOSED
                 \--> REJECTED
```

### Settlement State Machine

```
REQUESTED --> VERIFYING --> PASSED
                       \--> FAILED
```

### Transfer State Machine

```
REQUESTED --> PRECHECK_FAILED
         \--> SUBMITTED --> MINED
                       \--> CHAIN_REVERTED
```

### Distribution Run State Machine

```
QUEUED --> RUNNING --> COMPLETED
                  \--> FAILED
```

### Export State Machine

```
QUEUED --> BUILDING --> READY --> EXPIRED
                   \--> FAILED
```

---

## Error Taxonomy

All domain errors extend the base `AppError` class defined in `src/common/errors.ts`.

```
AppError (base)
  |-- ValidationError    (400)  code: "VALIDATION_ERROR"
  |-- NotFoundError      (404)  code: "{ENTITY}_NOT_FOUND"
  |-- ConflictError      (409)  code: custom
  |-- ExternalDependencyError (503)  code: "EXTERNAL_DEPENDENCY_ERROR"
```

`AppError` carries:

| Property | Type | Description |
|---|---|---|
| `code` | `string` | Machine-readable error code |
| `message` | `string` | Human-readable description |
| `statusCode` | `number` | HTTP status (default 500) |
| `details` | `Record<string, unknown>?` | Optional structured details |

The global `AppExceptionFilter` catches all exceptions (including NestJS `HttpException`) and serializes them into the standard error envelope.

---

## Domain Enums

All 22 enums are defined in `src/domain/enums.ts`:

| Enum | Values |
|---|---|
| `FundStatus` | `DRAFT`, `ACTIVE`, `CLOSED` |
| `LegalForm` | `LP`, `LLC`, `OTHER` |
| `VerificationStatus` | `UNKNOWN`, `VERIFIED`, `REVOKED` |
| `WalletStatus` | `ACTIVE`, `INACTIVE`, `BLOCKED` |
| `EligibilityStatus` | `NOT_SET`, `ELIGIBLE`, `REVOKED` |
| `DocumentType` | `MASTER_LPA`, `SUBSCRIPTION_RECORD`, `PAYMENT_RECEIPT`, `OTHER` |
| `StorageProvider` | `LOCAL_FS`, `S3` |
| `ParseStatus` | `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `HashAlgorithm` | `SHA256` |
| `SubscriptionStatus` | `DRAFT`, `PENDING`, `SETTLED`, `REJECTED`, `CLOSED` |
| `SettlementStatus` | `REQUESTED`, `VERIFYING`, `PASSED`, `FAILED` |
| `SettlementFailureCode` | `AMOUNT_MISMATCH`, `INVESTOR_MISMATCH`, `REFERENCE_MISMATCH`, `HASH_MISMATCH`, `DOUBLE_SETTLEMENT`, `UNKNOWN` |
| `ContractDeploymentStatus` | `NOT_DEPLOYED`, `DEPLOYING`, `DEPLOYED`, `FAILED` |
| `TokenEventType` | `MINT`, `TRANSFER`, `BURN`, `ADJUSTMENT`, `SYNC` |
| `TransferRequestStatus` | `REQUESTED`, `PRECHECK_FAILED`, `SUBMITTED`, `MINED`, `CHAIN_REVERTED` |
| `TransferFailureCode` | `RECIPIENT_NOT_ELIGIBLE`, `SENDER_NOT_ELIGIBLE`, `INSUFFICIENT_BALANCE`, `CONTRACT_REVERT`, `UNKNOWN` |
| `DistributionRunStatus` | `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` |
| `ExportStatus` | `QUEUED`, `BUILDING`, `READY`, `FAILED`, `EXPIRED` |
| `WaterfallBasis` | `IRR`, `MULTIPLE` |
| `DistributionFrequency` | `MONTHLY`, `QUARTERLY`, `ANNUAL`, `MANUAL` |
| `JobStatus` | `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `DEAD_LETTERED` |

Note: `SettlementEvidence.evidenceType` uses string values (`PAYMENT_DOCUMENT`, `WIRE_RECEIPT`, `TX_PROOF`, `MANUAL_ATTESTATION`) that are not represented as a TypeScript enum but are documented in the Prisma schema.

---

## Async Job Infrastructure

The `JobsModule` and its associated Prisma models (`Job`, `JobDeadLetter`) provide the **skeleton** for a Postgres-backed job queue using an outbox pattern:

- Jobs are created as rows in the `jobs` table with `status: QUEUED`.
- A worker process (not yet implemented) would poll for unlocked jobs, lock them (`lockedBy`, `lockedAt`), execute, and update status.
- Failed jobs exceeding `maxAttempts` would be moved to the `jobs_dead_letter` table.
- Job types (document parsing, audit export building, distribution run execution) are planned but not yet wired.

Current state: `JobsService` and `JobsController` are empty shells.

---

## Auth Guards (Planned)

The following guards are planned but **not yet wired** into the request pipeline:

| Guard | Purpose |
|---|---|
| `AuthGuard` | Validate JWT / session token |
| `RoleGuard` | Enforce role-based access (admin vs. investor) |
| `FundScopeGuard` | Ensure the authenticated user has access to the requested fund |
| `WalletOwnershipGuard` | Ensure the authenticated investor owns the wallet used in transfer requests |

Currently, all endpoints are unauthenticated. The `/admin/*` and `/investor/*` path prefixes indicate the intended access level.

---

## Known Gaps

| Area | Status |
|---|---|
| Jobs module | Skeleton only -- `JobsService` and `JobsController` are empty |
| Worker application | Not created -- no background job processor exists |
| Auth guards | Defined in plan, not implemented or wired |
| Real blockchain adapter | `MockTokenContractAdapter` is used -- no Hardhat/ethers adapter exists |
| PDF parsing | `MockParserAdapter` returns hardcoded fields -- no real PDF extraction |
| S3 storage adapter | Only `LocalFsStorageAdapter` is implemented |
| On-chain hash anchoring | `DocumentHash.anchoredOnchain` field exists but no service writes to chain |
| System event log writes | `SystemEventLog` table exists but no service emits events |
| Capital account updates | `CapitalAccount` table exists but is not updated by settlement or distribution flows |
| Frontend | Not part of this package -- will be a separate Next.js application |
