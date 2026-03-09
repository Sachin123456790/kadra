# Mock Change #11: ECDSA Mint Authorization

## What Changed
Migrated from ethers.js to viem for ECDSA signature generation in settlement confirmation.

## Files Modified
- `backend/src/modules/settlements/settlements.service.ts` (lines 310-328)

## How It Works Now
- Uses `privateKeyToAccount()` from `viem/accounts`
- Uses `keccak256()` and `encodePacked()` from `viem`
- Signs message with deployer's private key (real key from `DEPLOYER_PRIVATE_KEY` env)
- Signature is a real ECDSA signature that can be verified on-chain
