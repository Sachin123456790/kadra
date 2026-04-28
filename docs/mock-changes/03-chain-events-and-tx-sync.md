# Mock Change #5-6: Chain Event Ingestion & TX Sync

## What Changed
Replaced stub implementations that always returned 0 with real viem-based chain queries.

## Files Modified
- `backend/src/modules/jobs/jobs.service.ts`

## How It Works Now

### ingestChainEvents()
- Uses `publicClient.getContractEvents()` to fetch real Transfer events from AngainorToken
- Scans from the last processed block to current block
- Creates `tokenPositionEvent` records for each Transfer event found
- Returns actual count of ingested events

### syncPendingTransactions()
- Queries `tokenPositionEvent` records with `ingestStatus: 'PENDING'`
- Calls `publicClient.getTransactionReceipt()` for each pending txHash
- Updates status to `CONFIRMED` (success) or `REVERTED` (failed)
- Returns actual counts of confirmed/reverted transactions
