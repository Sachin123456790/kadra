# Mock Change #4: Document On-Chain Anchoring

## What Changed
Replaced fake `anchorOnChain()` (ethers.keccak256 of a string) with real calls to the deployed DocumentRegistry contract on Sepolia.

## Files Changed

### Created
- `backend/src/adapters/blockchain/viem-document-registry.adapter.ts` -- Real adapter that calls `DocumentRegistry.registerDocument(docHash, docType)` on-chain

### Modified
- `backend/src/modules/documents/documents.service.ts` -- Injected `DOCUMENT_REGISTRY_ADAPTER`; `anchorOnChain()` now calls real contract
- `backend/src/modules/documents/documents.module.ts` -- Added ViemClientProvider, ViemDocumentRegistryAdapter, DOCUMENT_REGISTRY_ADAPTER to providers

## How It Works Now

1. Document uploaded -> SHA-256 hash computed
2. `documentRegistry.documentExists(hash)` checked to avoid duplicate anchoring
3. `documentRegistry.registerDocument(hash, 'MASTER_LPA')` called on Sepolia
4. Real txHash and blockNumber stored in `document_hash` table
5. Document hash is verifiable on BaseScan at the DocumentRegistry address
