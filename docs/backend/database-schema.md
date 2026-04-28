# Angainor Backend -- Database Schema Reference

All models are defined in `prisma/schema.prisma`. The database is PostgreSQL, accessed via Prisma v7 with the `@prisma/adapter-pg` driver adapter.

Common conventions across all tables:
- `id` is a UUID primary key (`@default(uuid())`).
- Timestamps use `@db.Timestamptz()`.
- Soft deletes use `deletedAt` where applicable.
- `rowVersion` supports optimistic concurrency on core entities.
- Column names are `snake_case` (via `@map`); Prisma fields are `camelCase`.

---

## Fund Administration

### Fund

Table: `funds`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `code` | String | Unique fund code (e.g., `ANGAINOR-DEMO-001`) |
| `name` | String | Display name |
| `legalForm` | String | `LP` / `LLC` / `OTHER` |
| `jurisdictionCode` | String? | ISO jurisdiction (e.g., `US-DE`) |
| `baseCurrency` | Char(3) | Default `USD` |
| `status` | String | `DRAFT` / `ACTIVE` / `CLOSED` |
| `metadata` | Json | Extensible metadata |
| `createdAt` | Timestamptz | |
| `updatedAt` | Timestamptz | Auto-updated |
| `deletedAt` | Timestamptz? | Soft delete |
| `createdBy` | String? | |
| `updatedBy` | String? | |
| `rowVersion` | Int | Optimistic concurrency |

**Relations:** Has many eligibilities, documents, subscriptions, tokenContracts, tokenPositionEvents, tokenPositions, ownershipSnapshots, transferRequests, transferEvents, capitalAccounts, waterfallConfigs, distributionRuns, auditExports, systemEventLogs.

---

## Identity

### Investor

Table: `investors`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `externalRef` | String? | Unique external reference (e.g., `INV-001`) |
| `legalName` | String | Full legal name |
| `email` | String? | |
| `verificationStatus` | String | `UNKNOWN` / `VERIFIED` / `REVOKED` |
| `verificationProvider` | String? | KYC provider name |
| `verifiedAt` | Timestamptz? | |
| `metadata` | Json | |
| `createdAt` / `updatedAt` / `deletedAt` | Timestamptz | Standard timestamps |
| `rowVersion` | Int | |

**Relations:** Has many wallets, eligibilities, subscriptions, capitalAccounts, ownershipSnapshotRows, distributionLineItems.

### Wallet

Table: `wallets`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `investorId` | UUID | FK -> Investor |
| `chainId` | Int | EVM chain ID (e.g., `31337` for Hardhat) |
| `address` | String | Original address |
| `addressNorm` | String | Lowercased address (set in application code) |
| `isPrimary` | Boolean | One primary per investor+chain (enforced in app) |
| `walletStatus` | String | `ACTIVE` / `INACTIVE` / `BLOCKED` |
| `label` | String? | |

**Unique constraint:** `(chainId, addressNorm)`

**Index:** `(investorId, chainId)`

### InvestorFundEligibility

Table: `investor_fund_eligibility`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `investorId` | UUID | FK -> Investor |
| `walletId` | UUID | FK -> Wallet |
| `eligibilityStatus` | String | `NOT_SET` / `ELIGIBLE` / `REVOKED` |
| `effectiveAt` | Timestamptz? | When eligibility became active |
| `revokedAt` | Timestamptz? | When revoked |
| `reason` | String? | |
| `source` | String | Default `MANUAL` |
| `metadata` | Json | |

**Unique constraint:** `(fundId, walletId)` (approximation of partial unique where `deletedAt` is null)

**Index:** `(fundId, eligibilityStatus)`

---

## Documents

### Document

Table: `documents`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `documentType` | String | `MASTER_LPA` / `SUBSCRIPTION_RECORD` / `PAYMENT_RECEIPT` / `OTHER` |
| `storageProvider` | String | `LOCAL_FS` / `S3` |
| `storageKey` | String | Path or key in storage backend |
| `originalFilename` | String | |
| `mimeType` | String | |
| `byteSize` | BigInt | |
| `uploadedBy` | String? | |
| `uploadedAt` | Timestamptz | |
| `parseStatus` | String | `QUEUED` / `PROCESSING` / `COMPLETED` / `FAILED` |
| `linkedEntityType` | String? | Polymorphic link type |
| `linkedEntityId` | String? | Polymorphic link ID |
| `metadata` | Json | |

**Index:** `(fundId, documentType, uploadedAt DESC)`

**Relations:** Has many hashes, extractedFields, governedSubscriptions, settlementEvidence.

### DocumentHash

Table: `document_hashes`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `documentId` | UUID | FK -> Document (cascade delete) |
| `hashAlgorithm` | String | `SHA256` |
| `hashHex` | Char(64) | Hex-encoded hash |
| `isPrimary` | Boolean | Default `true` |
| `computedAt` | Timestamptz | |
| `anchoredOnchain` | Boolean | Default `false` |
| `anchorChainId` | Int? | |
| `anchorTxHash` | String? | |
| `anchorBlockNumber` | BigInt? | |
| `anchorConfirmedAt` | Timestamptz? | |

**Unique constraint:** `(hashAlgorithm, hashHex)`

**Index:** `(anchorTxHash)`

### ExtractedDocumentField

Table: `extracted_document_fields`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `documentId` | UUID | FK -> Document (cascade delete) |
| `extractionRunRef` | String | Groups fields from a single extraction run |
| `fieldName` | String | |
| `fieldPath` | String? | JSONPath or XPath |
| `fieldValueText` | String? | |
| `fieldValueNumeric` | Decimal(30,10)? | |
| `fieldValueDate` | Date? | |
| `fieldValueJson` | Json? | |
| `normalizedValue` | String? | |
| `confidence` | Decimal(5,4)? | 0.0000 to 1.0000 |
| `sourcePage` | Int? | |
| `sourceBbox` | Json? | Bounding box coordinates |

**Indexes:** `(documentId, fieldName)`, `(extractionRunRef)`

---

## Subscriptions

### Subscription

Table: `subscriptions`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `subscriptionRef` | String | Unique human-readable reference |
| `fundId` | UUID | FK -> Fund |
| `investorId` | UUID | FK -> Investor |
| `walletId` | UUID | FK -> Wallet |
| `governingDocumentId` | UUID | FK -> Document |
| `governingHashId` | UUID | FK -> DocumentHash |
| `allocationPct` | Decimal(9,6) | Ownership percentage |
| `committedAmount` | Decimal(20,2) | Capital committed |
| `currency` | Char(3) | Default `USD` |
| `status` | String | `DRAFT` / `PENDING` / `SETTLED` / `REJECTED` / `CLOSED` |
| `pendingReason` | String? | |
| `settledAt` | Timestamptz? | |
| `rejectedAt` | Timestamptz? | |

**Indexes:** `(fundId, status)`, `(investorId, status)`, `(walletId)`

---

## Settlements

### SettlementRecord

Table: `settlement_records`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `subscriptionId` | UUID | FK -> Subscription (cascade delete) |
| `status` | String | `REQUESTED` / `VERIFYING` / `PASSED` / `FAILED` |
| `validatorVersion` | String? | |
| `expectedAmount` | Decimal(20,2) | |
| `receivedAmount` | Decimal(20,2)? | |
| `expectedCurrency` / `receivedCurrency` | Char(3) | |
| `checkAmountMatch` | Boolean? | 3-way check result |
| `checkInvestorMatch` | Boolean? | 3-way check result |
| `checkReferenceMatch` | Boolean? | 3-way check result |
| `checkHashMatch` | Boolean? | 3-way check result |
| `checkNoDoubleSettlement` | Boolean? | 3-way check result |
| `failureReasonCode` | String? | `SettlementFailureCode` enum |
| `failureReasonText` | String? | |
| `validatedAt` | Timestamptz? | |
| `validatedBy` | String? | |

**Index:** `(subscriptionId, status, createdAt DESC)`

### SettlementEvidence

Table: `settlement_evidence`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `settlementRecordId` | UUID | FK -> SettlementRecord (cascade delete) |
| `evidenceType` | String | `PAYMENT_DOCUMENT` / `WIRE_RECEIPT` / `TX_PROOF` / `MANUAL_ATTESTATION` |
| `documentId` | UUID? | FK -> Document |
| `documentHashId` | UUID? | FK -> DocumentHash |
| `externalReference` | String? | |
| `providedBy` | String? | |
| `providedAt` | Timestamptz | |
| `notes` | String? | |
| `metadata` | Json | |

**Index:** `(settlementRecordId, evidenceType)`

---

## Tokenization

### TokenContract

Table: `token_contracts`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `chainId` | Int | |
| `contractAddress` | String | |
| `contractAddressNorm` | String | Lowercased (set in app code) |
| `tokenStandard` | String | Default `ERC-3643` |
| `deploymentStatus` | String | `NOT_DEPLOYED` / `DEPLOYING` / `DEPLOYED` / `FAILED` |
| `deploymentTxHash` | String? | |
| `deployedBlockNumber` | BigInt? | |
| `deployedAt` | Timestamptz? | |
| `identityRegistryAddress` | String? | |
| `transferRestrictionsEnabled` | Boolean | Default `true` |

**Unique constraint:** `(chainId, contractAddressNorm)`

**Index:** `(fundId, chainId)`

### TokenPositionEvent

Table: `token_position_events`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `tokenContractId` | UUID | FK -> TokenContract |
| `chainId` | Int | |
| `blockNumber` | BigInt | |
| `blockTimestamp` | Timestamptz | |
| `txHash` | String | |
| `logIndex` | Int | |
| `eventType` | String | `MINT` / `TRANSFER` / `BURN` / `ADJUSTMENT` / `SYNC` |
| `fromWalletAddress` | String? | |
| `toWalletAddress` | String? | |
| `tokenAmount` | Decimal(38,18) | |
| `relatedSubscriptionId` | UUID? | FK -> Subscription |
| `relatedTransferRequestId` | UUID? | FK -> TransferRequest |
| `ingestStatus` | String | `PENDING` / `CONFIRMED` / `REORGED` |
| `rawEvent` | Json | |

**Unique constraint:** `(chainId, txHash, logIndex)`

**Indexes:** `(tokenContractId, blockNumber DESC, logIndex DESC)`, `(fundId, blockTimestamp DESC)`, `(toWalletAddress)`, `(fromWalletAddress)`

### TokenPosition

Table: `token_positions`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `tokenContractId` | UUID | FK -> TokenContract |
| `walletId` | UUID? | FK -> Wallet |
| `walletAddress` | String | |
| `walletAddressNorm` | String | Lowercased |
| `settledTokenBalance` | Decimal(38,18) | Default `0` |
| `lastEventId` | UUID? | FK -> TokenPositionEvent |
| `asOfBlockNumber` | BigInt? | |
| `asOfTimestamp` | Timestamptz? | |

**Unique constraint:** `(tokenContractId, walletAddressNorm)`

**Index:** `(fundId, settledTokenBalance DESC)`

---

## Ownership

### OwnershipSnapshot

Table: `ownership_snapshots`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `tokenContractId` | UUID? | FK -> TokenContract |
| `snapshotType` | String | `ON_DEMAND` / `RUN_START` / `RUN_END` / `SCHEDULED` |
| `asOfBlockNumber` | BigInt? | |
| `asOfTimestamp` | Timestamptz | |
| `source` | String | Default `EVENTS_REBUILD` |
| `generatedBy` | String? | |

**Index:** `(fundId, asOfTimestamp DESC)`

### OwnershipSnapshotRow

Table: `ownership_snapshot_rows`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `snapshotId` | UUID | FK -> OwnershipSnapshot (cascade delete) |
| `investorId` | UUID? | FK -> Investor |
| `walletId` | UUID? | FK -> Wallet |
| `walletAddress` | String | |
| `settledTokenBalance` | Decimal(38,18) | Default `0` |
| `ownershipPct` | Decimal(9,6)? | |
| `pendingAllocationPct` | Decimal(9,6)? | |

**Unique constraint:** `(snapshotId, walletAddress)`

**Index:** `(snapshotId, ownershipPct DESC)`

---

## Transfers

### TransferRequest

Table: `transfer_requests`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `tokenContractId` | UUID | FK -> TokenContract |
| `requestedBy` | String? | |
| `correlationId` | String? | Unique (nullable) |
| `fromWalletId` | UUID? | FK -> Wallet |
| `fromWalletAddress` | String | |
| `toWalletId` | UUID? | FK -> Wallet |
| `toWalletAddress` | String | |
| `tokenAmount` | Decimal(38,18) | |
| `requestStatus` | String | `REQUESTED` / `PRECHECK_FAILED` / `SUBMITTED` / `MINED` / `CHAIN_REVERTED` |
| `precheckPassed` | Boolean? | |
| `precheckReasonCode` | String? | `TransferFailureCode` enum |
| `precheckReasonText` | String? | |
| `submittedTxHash` | String? | |
| `submittedAt` | Timestamptz? | |
| `finalizedAt` | Timestamptz? | |

**Indexes:** `(fundId, requestStatus, createdAt DESC)`, `(submittedTxHash)`

### TransferEvent

Table: `transfer_events`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `transferRequestId` | UUID? | FK -> TransferRequest (cascade delete) |
| `fundId` | UUID | FK -> Fund |
| `tokenContractId` | UUID? | FK -> TokenContract |
| `eventKind` | String | `REQUESTED` / `PRECHECK_FAILED` / `SUBMITTED` / `MINED` / `CHAIN_REVERTED` / `INDEXED` |
| `txHash` | String? | |
| `blockNumber` | BigInt? | |
| `blockTimestamp` | Timestamptz? | |
| `reasonCode` | String? | |
| `reasonText` | String? | |
| `payload` | JsonB | |

**Indexes:** `(transferRequestId, createdAt)`, `(fundId, createdAt DESC)`, `(txHash)`

---

## Capital

### CapitalAccount

Table: `capital_accounts`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `investorId` | UUID | FK -> Investor |
| `openingBalance` | Decimal(20,2) | Default `0` |
| `initialContribution` | Decimal(20,2) | Default `0` |
| `contributedAt` | Timestamptz? | |
| `capitalReturned` | Decimal(20,2) | Default `0` |
| `accruedPref` | Decimal(20,2) | Default `0` |
| `residualAllocation` | Decimal(20,2) | Default `0` |
| `endingCapitalBalance` | Decimal(20,2) | Default `0` |
| `asOfDate` | Date | |
| `isCurrent` | Boolean | Default `true` |

**Unique constraint:** `(fundId, investorId, isCurrent)`

**Index:** `(fundId, asOfDate DESC)`

---

## Distribution

### WaterfallConfig

Table: `waterfall_configs`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `version` | String | e.g., `1.0` |
| `isActive` | Boolean | Only one active per fund (enforced in app) |
| `derivedFromDocumentHashId` | UUID? | FK -> DocumentHash |
| `calculationBasis` | String | `IRR` / `MULTIPLE` |
| `distributionFrequency` | String | `MONTHLY` / `QUARTERLY` / `ANNUAL` / `MANUAL` |
| `catchUpEnabled` | Boolean | Default `false` |
| `gpPromotePct` | Decimal(9,6)? | |
| `prefReturnPct` | Decimal(9,6)? | |
| `rulesJson` | Json | Full waterfall rules definition |
| `effectiveAt` | Timestamptz | |
| `retiredAt` | Timestamptz? | |

**Unique constraint:** `(fundId, version)`

### WaterfallTier

Table: `waterfall_tiers`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `waterfallConfigId` | UUID | FK -> WaterfallConfig (cascade delete) |
| `tierOrder` | SmallInt | Execution order |
| `tierName` | String | e.g., `Return of Capital` |
| `hurdleType` | String | `NONE` / `IRR` / `MULTIPLE` / `PERCENT` |
| `hurdleValue` | Decimal(18,6)? | |
| `lpSharePct` | Decimal(9,6) | |
| `gpSharePct` | Decimal(9,6) | |
| `catchUp` | Boolean | Default `false` |
| `rulesJson` | Json | Tier-specific overrides |

**Unique constraint:** `(waterfallConfigId, tierOrder)`

### DistributionRun

Table: `distribution_runs`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `waterfallConfigId` | UUID | FK -> WaterfallConfig |
| `ownershipSnapshotId` | UUID | FK -> OwnershipSnapshot |
| `runStatus` | String | `QUEUED` / `RUNNING` / `COMPLETED` / `FAILED` |
| `asOfTimestamp` | Timestamptz | |
| `triggeredBy` | String? | |
| `startedAt` | Timestamptz? | |
| `completedAt` | Timestamptz? | |
| `totalGrossAmount` | Decimal(20,2)? | |
| `totalNetAmount` | Decimal(20,2)? | |
| `currency` | Char(3) | Default `USD` |
| `failureReason` | String? | |

**Index:** `(fundId, runStatus, createdAt DESC)`

### DistributionLineItem

Table: `distribution_line_items`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `distributionRunId` | UUID | FK -> DistributionRun (cascade delete) |
| `investorId` | UUID | FK -> Investor |
| `walletId` | UUID? | FK -> Wallet |
| `capitalAccountId` | UUID? | FK -> CapitalAccount |
| `grossAmount` | Decimal(20,2) | |
| `netAmount` | Decimal(20,2) | |
| `currency` | Char(3) | Default `USD` |
| `ownershipPctUsed` | Decimal(9,6)? | |
| `prefAmount` | Decimal(20,2) | Default `0` |
| `returnOfCapitalAmount` | Decimal(20,2) | Default `0` |
| `promoteAmount` | Decimal(20,2) | Default `0` |
| `tierBreakdown` | Json | Per-tier allocation detail |

**Unique constraint:** `(distributionRunId, investorId, walletId)`

**Index:** `(distributionRunId, grossAmount DESC)`

---

## Audit

### AuditExport

Table: `audit_exports`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fundId` | UUID | FK -> Fund |
| `exportType` | String | `AUDIT_PACKET` / `CAP_TABLE` / `EVENT_LOG` / `DISTRIBUTION_REPORT` |
| `status` | String | `QUEUED` / `BUILDING` / `READY` / `FAILED` / `EXPIRED` |
| `requestedBy` | String? | |
| `requestedAt` | Timestamptz | |
| `startedAt` | Timestamptz? | |
| `completedAt` | Timestamptz? | |
| `expiresAt` | Timestamptz? | |
| `artifactStorageProvider` | String | `LOCAL_FS` / `S3` |
| `artifactPath` | String? | |
| `manifestJson` | Json | Contents manifest |
| `checksumSha256` | Char(64)? | |
| `errorMessage` | String? | |

**Index:** `(fundId, status, requestedAt DESC)`

---

## System

### SystemEventLog

Table: `system_event_log`

| Field | Type | Notes |
|---|---|---|
| `id` | BigInt | PK (autoincrement) |
| `eventId` | UUID | Unique, auto-generated |
| `eventType` | String | e.g., `DOCUMENT_UPLOADED`, `SETTLEMENT_PASSED` |
| `eventVersion` | Int | Default `1` |
| `aggregateType` | String | e.g., `Subscription`, `Fund` |
| `aggregateId` | String? | |
| `fundId` | UUID? | FK -> Fund |
| `sourceContext` | String | Originating module/service |
| `correlationId` | String? | |
| `causationId` | String? | |
| `idempotencyKey` | String? | Unique (nullable) |
| `payloadJson` | Json | Event payload |
| `metadataJson` | Json | |
| `chainId` | Int? | |
| `txHash` | String? | |
| `blockNumber` | BigInt? | |
| `occurredAt` | Timestamptz | When the event happened |
| `recordedAt` | Timestamptz | When it was written |
| `isReplayed` | Boolean | Default `false` |

**Indexes:** `(eventType, occurredAt DESC)`, `(aggregateType, aggregateId, occurredAt DESC)`, `(fundId, occurredAt DESC)`, `(txHash)`

### Job

Table: `jobs`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `jobType` | String | |
| `payload` | Json | |
| `status` | String | `QUEUED` / `RUNNING` / `COMPLETED` / `FAILED` |
| `priority` | Int | Default `0` |
| `attempts` | Int | Default `0` |
| `maxAttempts` | Int | Default `3` |
| `lastError` | String? | |
| `lockedBy` | String? | Worker ID |
| `lockedAt` | Timestamptz? | |
| `scheduledAt` | Timestamptz | |
| `startedAt` | Timestamptz? | |
| `completedAt` | Timestamptz? | |

**Indexes:** `(status, priority DESC, scheduledAt)`, `(jobType, status)`

### JobDeadLetter

Table: `jobs_dead_letter`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `originalJobId` | String | Reference to original job |
| `jobType` | String | |
| `payload` | Json | |
| `attempts` | Int | |
| `lastError` | String? | |
| `failedAt` | Timestamptz | |

**Index:** `(jobType, failedAt DESC)`

---

## Seed Data

The seed script (`prisma/seed.ts`) creates the following demo data:

| Entity | Count | Details |
|---|---|---|
| Fund | 1 | "Angainor Demo Fund I", code `ANGAINOR-DEMO-001`, LP form, `US-DE` jurisdiction, `ACTIVE` status |
| Investors | 6 | Alpine Capital Partners, Bridgewater Associates, Cascade Investment LLC, Dominion Capital Group, Evergreen Holdings Ltd (all `VERIFIED`), Foxglove Ventures (`UNKNOWN`) |
| Wallets | 6 | One per investor, chain `31337` (Hardhat local), deterministic addresses `0x0000...0001` through `0x0000...0006` |
| Eligibility records | 5 | First 5 investors marked `ELIGIBLE` for the demo fund; Foxglove Ventures has no eligibility record |
| Waterfall config | 1 | Version `1.0`, `isActive: true`, calculation basis `IRR`, frequency `QUARTERLY`, 8% preferred return, 20% GP promote |
| Waterfall tiers | 4 (via `rulesJson`) | Return of Capital (100% LP), Preferred Return at 8% IRR (100% LP), GP Catch-up (100% GP), Carried Interest (80% LP / 20% GP) |
