# Angainor Backend -- API Endpoint Reference

All endpoints are prefixed with `/api/v1` (set in `src/main.ts` via `app.setGlobalPrefix`).

Every response follows the envelope pattern:

```json
{
  "data": { ... },
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" }
}
```

List endpoints include `"count": <number>` in `meta`.

Error responses use:

```json
{
  "error": { "code": "...", "message": "..." },
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" }
}
```

---

## Health

| Method | Path | Description | Source |
|---|---|---|---|
| GET | `/api/v1/health` | Health check. Returns `{ status: "ok", timestamp }`. | `src/health.controller.ts` |
| GET | `/api/v1/version` | Version info. Returns `{ version: "0.1.0", name: "angainor-api" }`. | `src/health.controller.ts` |

---

## Fund

| Method | Path | Description | Source |
|---|---|---|---|
| GET | `/api/v1/admin/funds/:fundId/overview` | Fund overview with aggregate statistics. | `src/modules/fund/fund.controller.ts` |

### GET `/api/v1/admin/funds/:fundId/overview`

**Response `data`:**

```typescript
{
  fundId: string;
  fundName: string;
  status: string;                 // FundStatus
  lpCount: number;
  eligibleWalletCount: number;
  pendingSubscriptions: number;
  settledSubscriptions: number;
  totalCommittedAmount: string;   // Decimal as string
  totalSettledAmount: string;     // Decimal as string
  tokenContract: {
    chainId: number;
    contractAddress: string;
    deploymentStatus: string;     // ContractDeploymentStatus
  } | null;
}
```

---

## Identity

| Method | Path | Description | Source |
|---|---|---|---|
| GET | `/api/v1/admin/funds/:fundId/investors` | List fund investors with eligibility. | `src/modules/identity/identity.controller.ts` |
| PUT | `/api/v1/admin/funds/:fundId/eligibility` | Grant or revoke wallet eligibility for a fund. | `src/modules/identity/identity.controller.ts` |

### GET `/api/v1/admin/funds/:fundId/investors`

**Query parameters:**

| Name | Type | Description |
|---|---|---|
| `eligibilityStatus` | string (optional) | Filter by `EligibilityStatus` |
| `verificationStatus` | string (optional) | Filter by `VerificationStatus` |
| `search` | string (optional) | Free-text search on investor name/email |

**Response `data`:** Array of investor objects with nested wallet and eligibility data.

### PUT `/api/v1/admin/funds/:fundId/eligibility`

**Request body:**

```typescript
{
  investorId: string;
  walletId: string;
  status: string;      // "ELIGIBLE" | "REVOKED"
  reason?: string;
}
```

**Response `data`:** Updated `InvestorFundEligibility` record.

---

## Documents

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/admin/funds/:fundId/documents/master-lpa` | Upload Master LPA (multipart file). | `src/modules/documents/documents.controller.ts` |
| GET | `/api/v1/admin/documents/:documentId/parse-status` | Get document parse status and extracted fields. | `src/modules/documents/documents.controller.ts` |
| GET | `/api/v1/admin/documents/:documentId/hashes` | Get document hash records. | `src/modules/documents/documents.controller.ts` |

### POST `/api/v1/admin/funds/:fundId/documents/master-lpa`

**Content-Type:** `multipart/form-data`

Upload a single file. Max size: 50 MB (configured in `src/main.ts`).

**Response `data`:**

```typescript
{
  documentId: string;
  fundId: string;
  documentType: "MASTER_LPA";
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  byteSize: string;
  parseStatus: string;
  hashHex: string;
  hashAlgorithm: "SHA256";
  extractedFields: ExtractedField[];
}
```

### GET `/api/v1/admin/documents/:documentId/parse-status`

**Response `data`:**

```typescript
{
  documentId: string;
  parseStatus: string;       // ParseStatus
  extractedFields: Array<{
    fieldName: string;
    fieldValueText?: string;
    fieldValueNumeric?: number;
    confidence: number;
    sourcePage?: number;
  }>;
}
```

### GET `/api/v1/admin/documents/:documentId/hashes`

**Response `data`:** Array of `DocumentHash` records for the document.

---

## Subscriptions

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/admin/funds/:fundId/subscriptions` | Create subscription records. | `src/modules/subscriptions/subscriptions.controller.ts` |
| GET | `/api/v1/admin/funds/:fundId/subscriptions` | List fund subscriptions. | `src/modules/subscriptions/subscriptions.controller.ts` |

### POST `/api/v1/admin/funds/:fundId/subscriptions`

**Request body:**

```typescript
{
  governingDocumentId: string;
  items: Array<{
    investorId: string;
    walletId: string;
    allocationPct: number;
    committedAmount: number;
    currency?: string;
  }>;
}
```

**Response `data`:** Array of created `Subscription` records.

### GET `/api/v1/admin/funds/:fundId/subscriptions`

**Query parameters:**

| Name | Type | Description |
|---|---|---|
| `status` | string (optional) | Filter by `SubscriptionStatus` |
| `investorId` | string (optional) | Filter by investor ID |
| `subscriptionRef` | string (optional) | Filter by subscription reference |

**Response `data`:** Array of `Subscription` records with related investor and wallet data.

---

## Settlements

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/admin/subscriptions/:subscriptionId/payment-validations` | 3-way settlement validation. | `src/modules/settlements/settlements.controller.ts` |
| POST | `/api/v1/admin/subscriptions/:subscriptionId/settlement-confirmation` | Confirm settlement, flip subscription to SETTLED. | `src/modules/settlements/settlements.controller.ts` |

### POST `/api/v1/admin/subscriptions/:subscriptionId/payment-validations`

**Request body:**

```typescript
{
  paymentDocumentId: string;
  declaredAmount: string;
  declaredCurrency: string;
  declaredReference: string;
}
```

**Response `data`:** `SettlementRecord` with check results (`checkAmountMatch`, `checkInvestorMatch`, `checkReferenceMatch`, `checkHashMatch`, `checkNoDoubleSettlement`, `status`, `failureReasonCode`).

### POST `/api/v1/admin/subscriptions/:subscriptionId/settlement-confirmation`

**Request body:**

```typescript
{
  settlementRecordId: string;
}
```

**Response `data`:** Updated `Subscription` with `status: "SETTLED"` and `settledAt` timestamp.

---

## Tokenization

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/admin/subscriptions/:subscriptionId/token-mint` | Mint tokens for a settled subscription. | `src/modules/tokenization/tokenization.controller.ts` |

**Response `data`:** Token position event with `txHash`, `blockNumber`, `tokenAmount`, and updated token position.

---

## Transfers

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/investor/funds/:fundId/transfers` | Request LP-to-LP transfer. | `src/modules/tokenization/tokenization.controller.ts` |
| GET | `/api/v1/transfers/:transferRequestId/validation` | Transfer validation status. | `src/modules/tokenization/tokenization.controller.ts` |
| GET | `/api/v1/admin/funds/:fundId/transfers/failed` | Failed transfer log. | `src/modules/tokenization/tokenization.controller.ts` |
| GET | `/api/v1/admin/funds/:fundId/transfers/successful` | Successful transfer log. | `src/modules/tokenization/tokenization.controller.ts` |

### POST `/api/v1/investor/funds/:fundId/transfers`

**Request body:**

```typescript
{
  fromWalletAddress: string;
  toWalletAddress: string;
  tokenAmount: string;
  reason?: string;
}
```

**Response `data`:** `TransferRequest` record with `requestStatus`, precheck results, and (if successful) `submittedTxHash`.

### GET `/api/v1/transfers/:transferRequestId/validation`

**Response `data`:** Transfer request with precheck details, current status, and related transfer events.

### GET `/api/v1/admin/funds/:fundId/transfers/failed`

**Response `data`:** Array of failed transfer requests (`PRECHECK_FAILED` or `CHAIN_REVERTED`) with failure reason codes and text.

### GET `/api/v1/admin/funds/:fundId/transfers/successful`

**Response `data`:** Array of successfully mined transfer requests.

---

## Ownership

| Method | Path | Description | Source |
|---|---|---|---|
| GET | `/api/v1/admin/funds/:fundId/cap-table` | Current cap table. | `src/modules/ownership/ownership.controller.ts` |
| GET | `/api/v1/admin/funds/:fundId/ownership-history` | Ownership history events. | `src/modules/ownership/ownership.controller.ts` |

### GET `/api/v1/admin/funds/:fundId/cap-table`

**Query parameters:**

| Name | Type | Description |
|---|---|---|
| `asOfTimestamp` | string (optional) | Point-in-time cap table (ISO-8601) |
| `includePending` | string (optional) | Include pending allocations (default: `true`) |

**Response `data`:** Ownership snapshot with rows containing `walletAddress`, `settledTokenBalance`, `ownershipPct`, `pendingAllocationPct`, and investor details.

### GET `/api/v1/admin/funds/:fundId/ownership-history`

**Query parameters:**

| Name | Type | Description |
|---|---|---|
| `walletAddress` | string (optional) | Filter by wallet address |
| `investorId` | string (optional) | Filter by investor ID |
| `from` | string (optional) | Start timestamp (ISO-8601) |
| `to` | string (optional) | End timestamp (ISO-8601) |

**Response `data`:** Array of ownership-change events (mints, transfers, burns) ordered by block timestamp.

---

## Distribution

| Method | Path | Description | Source |
|---|---|---|---|
| GET | `/api/v1/admin/funds/:fundId/waterfall-configs/active` | Active waterfall configuration. | `src/modules/distribution/distribution.controller.ts` |
| POST | `/api/v1/admin/funds/:fundId/distributions/preview` | Preview distribution (dry run). | `src/modules/distribution/distribution.controller.ts` |
| POST | `/api/v1/admin/funds/:fundId/distributions/runs` | Execute distribution run. | `src/modules/distribution/distribution.controller.ts` |

### GET `/api/v1/admin/funds/:fundId/waterfall-configs/active`

**Response `data`:** Active `WaterfallConfig` with nested `tiers` array.

### POST `/api/v1/admin/funds/:fundId/distributions/preview`

**Request body:**

```typescript
{
  waterfallConfigId: string;
  asOfTimestamp: string;              // ISO-8601
  grossDistributableAmount: string;   // Decimal as string
  currency?: string;                  // Default "USD"
}
```

**Response `data`:** Preview breakdown with per-investor line items, tier allocations, pref amounts, and return-of-capital amounts. No records are persisted.

### POST `/api/v1/admin/funds/:fundId/distributions/runs`

**Request body:** Same shape as preview.

**Response `data`:** Persisted `DistributionRun` with `runStatus`, `totalGrossAmount`, `totalNetAmount`, and nested `lineItems`.

---

## Audit

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/admin/funds/:fundId/audit-exports` | Request audit export. | `src/modules/audit/audit.controller.ts` |
| GET | `/api/v1/admin/audit-exports/:auditExportId` | Get export status and artifact path. | `src/modules/audit/audit.controller.ts` |

### POST `/api/v1/admin/funds/:fundId/audit-exports`

**Request body:**

```typescript
{
  exportType?: string;               // "AUDIT_PACKET" | "CAP_TABLE" | "EVENT_LOG" | "DISTRIBUTION_REPORT"
  asOfTimestamp?: string;            // ISO-8601
  includeDocuments?: boolean;
  includeDistributionRuns?: boolean;
}
```

**Response `data`:** Created `AuditExport` record with `status: "QUEUED"`.

### GET `/api/v1/admin/audit-exports/:auditExportId`

**Response `data`:** `AuditExport` with current `status`, `artifactPath` (when `READY`), `checksumSha256`, and `manifestJson`.

---

## Jobs (Cron / Admin)

All jobs endpoints require the `x-service-token` header matching the `CRON_SERVICE_TOKEN` environment variable. They are protected by `ServiceTokenGuard` (`src/common/guards/service-token.guard.ts`). If `CRON_SERVICE_TOKEN` is not set, the guard is bypassed (development mode).

| Method | Path | Description | Source |
|---|---|---|---|
| POST | `/api/v1/admin/jobs/run` | Drain queued jobs in batch. | `src/modules/jobs/jobs.controller.ts` |
| POST | `/api/v1/admin/jobs/:jobId/run` | Run a single job by ID. | `src/modules/jobs/jobs.controller.ts` |
| POST | `/api/v1/admin/jobs/:jobId/retry` | Re-enqueue a dead-lettered job. | `src/modules/jobs/jobs.controller.ts` |
| POST | `/api/v1/admin/jobs/chain-ingest` | Ingest on-chain events from deployed contracts (stub). | `src/modules/jobs/jobs.controller.ts` |
| POST | `/api/v1/admin/jobs/tx-sync` | Sync pending transfer transaction receipts (stub). | `src/modules/jobs/jobs.controller.ts` |

### POST `/api/v1/admin/jobs/run`

Drains up to `batchSize` queued jobs ordered by priority (desc) then scheduled time (asc). Jobs exceeding `maxAttempts` are moved to the `jobs_dead_letter` table.

**Headers:** `x-service-token: <CRON_SERVICE_TOKEN>`

**Request body:**

```typescript
{
  batchSize?: number;    // Default: 10
  jobTypes?: string[];   // Optional filter by job type
}
```

**Response `data`:**

```typescript
{
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}
```

### POST `/api/v1/admin/jobs/:jobId/run`

Runs a single job. The job must be in `QUEUED` or `FAILED` status.

**Headers:** `x-service-token: <CRON_SERVICE_TOKEN>`

**Response `data`:**

```typescript
{
  jobId: string;
  status: string;     // "COMPLETED" | "FAILED"
  error?: string;
}
```

### POST `/api/v1/admin/jobs/:jobId/retry`

Re-enqueues a dead-lettered job by creating a new `Job` row with `status: QUEUED` and `attempts: 0`.

**Headers:** `x-service-token: <CRON_SERVICE_TOKEN>`

**Response `data`:** The newly created `Job` record.

### POST `/api/v1/admin/jobs/chain-ingest`

Ingests on-chain events for deployed token contracts. Currently a stub that logs and returns counts.

**Headers:** `x-service-token: <CRON_SERVICE_TOKEN>`

**Request body:**

```typescript
{
  fundId?: string;     // Optional: scope to a single fund
}
```

**Response `data`:**

```typescript
{
  contractsProcessed: number;
  eventsIngested: number;
}
```

### POST `/api/v1/admin/jobs/tx-sync`

Checks pending transfer transactions for confirmation or revert. Currently a stub.

**Headers:** `x-service-token: <CRON_SERVICE_TOKEN>`

**Response `data`:**

```typescript
{
  checked: number;
  confirmed: number;
  reverted: number;
}
```
