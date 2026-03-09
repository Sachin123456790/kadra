# Kadra — Mock/Fake/Stub Inventory

Everything that needs to become real before an investor demo. Ordered by severity.

**Last updated:** 2026-03-08 — See `docs/mock-changes/` for detailed change documentation.

---

## CRITICAL — Blockchain Operations Are Fully Simulated

### 1. MockTokenContractAdapter -- FIXED
**File:** `backend/src/adapters/blockchain/mock-token-contract.adapter.ts` (DELETED)
- `deploy()` — returns fake contract address (SHA-256 of name+timestamp), no actual Solidity deployment
- `mint()` — updates in-memory map (wiped on Vercel cold start), returns fake txHash
- `transfer()` — returns fake txHash, no on-chain execution
- `getBalance()` — reads in-memory map (always empty after cold start)
- `genTxHash()` — `SHA-256(randomUUID())` — not real, not on BaseScan

**Fix:** Replace with real adapter using viem/permissionless. Deploy actual KadraToken.sol + IdentityRegistry.sol + DocumentRegistry.sol to Sepolia. Generate real wallets for investors.

### 2. SepoliaTokenContractAdapter (also mock despite the name) -- FIXED
**File:** `backend/src/adapters/blockchain/sepolia-token-contract.adapter.ts` (DELETED)
- `deploy()` — derives deterministic address from hash, never calls Solidity constructor
- `mint()` — generates fake txHash via keccak256, never calls contract
- `transfer()` — same fake txHash pattern
- `getBalance()` — always returns `'0'`, comment says "In production, would call ERC-20 balanceOf"

**Fix:** Rewrite to actually call deployed contracts via viem.

### 3. Adapter Selection Logic -- FIXED
**File:** `backend/src/modules/tokenization/tokenization.module.ts`
- `isRemoteChain()` selects Mock (localhost) vs Sepolia (remote RPC)
- Even "Sepolia" adapter is mock — both paths are fake

**Fix:** Single real adapter that always talks to Sepolia.

---

## HIGH — Missing Chain Integration

### 4. Document On-Chain Anchoring (stub) -- FIXED
**File:** `backend/src/modules/documents/documents.service.ts`
- `anchorOnChain()` generates fake anchor txHash via `ethers.keccak256()`
- Never actually calls `DocumentRegistry.registerDocument()` on-chain
- Skips anchoring entirely if RPC URL is localhost

**Fix:** Call actual DocumentRegistry contract to register document hash on Sepolia.

### 5. Chain Event Ingestion (stub) -- FIXED
**File:** `backend/src/modules/jobs/jobs.service.ts`
- `ingestChainEvents()` — always returns 0 events, comment says "Stub: real implementation will use ethers to fetch events"

**Fix:** Use viem to poll for Transfer/Mint events from deployed contracts.

### 6. Transaction Confirmation Tracking (stub) -- FIXED
**File:** `backend/src/modules/jobs/jobs.service.ts`
- `syncPendingTransactions()` — always returns 0 confirmed/reverted, comment says "Stub: real implementation will check tx receipts"

**Fix:** Poll `eth_getTransactionReceipt` for pending txs.

### 7. IdentityRegistry Address Hardcoded as Null -- FIXED
**File:** `backend/src/modules/tokenization/tokenization.service.ts`
- `identityRegistryAddress: '0x0000000000000000000000000000000000000000'` — "Mock for MVP"
- Means KadraToken is deployed without a real identity registry reference

**Fix:** Pass actual deployed IdentityRegistry address.

---

## MEDIUM — Parser & Storage

### 8. MockParserAdapter (document extraction)
**File:** `backend/src/adapters/parser/mock-parser.adapter.ts`
- Returns hardcoded extraction: "Kadra Demo Fund I", allocation=20%, pref_return=8%, gp_promote=20%
- Every uploaded document returns identical fields regardless of content
- GeminiParserAdapter exists but requires `DOCUMENT_PARSER_PROVIDER=gemini` + `GEMINI_API_KEY`

**Fix:** Set env vars to activate GeminiParserAdapter, or accept mock for demo (extraction is supplementary).

### 9. Storage on Vercel (ephemeral)
**File:** `backend/src/adapters/storage/local-fs.adapter.ts` (lines 8-10)
- Uses `/tmp/` on Vercel — files lost on cold start
- SupabaseStorageAdapter exists as alternative

**Fix:** Already partially addressed (Supabase bucket created). Ensure `SUPABASE_STORAGE_BUCKET` env is set.

---

## LOW — Acceptable for Demo

### 10. Job Execution Router (all stubs)
**File:** `backend/src/modules/jobs/jobs.service.ts` (lines 236-256)
- `executeJob()` logs `[STUB]` for: document.parse, settlement.validate, token.mint, transfer.submit, export.bundle.generate
- These are async background jobs, not used in the synchronous demo flow

### 11. ECDSA Mint Authorization Signature -- FIXED (migrated to viem)
**File:** `backend/src/modules/settlements/settlements.service.ts`
- Now uses viem (`privateKeyToAccount`, `keccak256`, `encodePacked`) instead of ethers.js
- Real ECDSA signature with deployer's private key

### 12. Total Supply Hardcoded
**File:** `backend/src/modules/tokenization/tokenization.service.ts` (line 110)
- `const totalSupply = 10000` — hardcoded, should be fund-configurable
- Acceptable for single-fund demo

### 13. Seed Data & Demo Constants
- `backend/prisma/seed.ts` — 1 fund, 6 investors, hardcoded wallet addresses
- `frontend/src/config/constants.ts` — `DEFAULT_FUND_CODE = 'KADRA-DEMO-001'`
- `data/` — mock investor/wire/fund JSON files for Hardhat scripts
- These are intentional demo fixtures, not production mocks

---

## Execution Order (recommended)

| Step | Items | What to Do |
|------|-------|------------|
| 1 | #1, #2, #3, #7 | Build real viem adapter, deploy contracts to Sepolia, generate funded wallets |
| 2 | #4 | Wire DocumentRegistry anchoring into documents.service |
| 3 | #8 | Activate Gemini parser (or skip for demo) |
| 4 | #5, #6 | Event ingestion & tx tracking (nice-to-have for demo) |
| 5 | #9 | Verify Supabase storage is active |
| 6 | #10-13 | Accept as-is for demo |

---

## Prerequisites

- **Sepolia RPC URL** (Alchemy/Infura)
- **Deployer wallet** with Sepolia ETH (for gas)
- **5 investor wallets** with private keys (for signing real transfers)
- viem + permissionless packages installed
