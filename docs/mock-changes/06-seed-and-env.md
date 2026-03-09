# Mock Change #13: Seed Data & Environment

## What Changed
Updated seed script to use real Sepolia wallet addresses (env-driven with fallbacks). Updated .env with all deployed contract addresses and investor wallet private keys.

## Files Modified
- `backend/prisma/seed.ts` -- Wallet addresses from `INVESTOR_${N}_ADDRESS` env vars
- `backend/.env` -- All real contract addresses, deployer key, 6 investor keys

## Environment Variables Added
```
CHAIN_ID=11155111
CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
DEPLOYER_PRIVATE_KEY=0x...
IDENTITY_REGISTRY_ADDRESS=0x55822888507cac67bE5C11516e00C4597E7c78fb
DOCUMENT_REGISTRY_ADDRESS=0x09BFB275f27FEB8b89A20844b84af2Fa68ba13a9
KADRA_TOKEN_ADDRESS=0x4bFe48Fe5A126f6A4f53BF95d82cF4881A1101Ef
INVESTOR_1_ADDRESS=0x47F430D7d898F8bf8BB6A89938C066C30a75D326
INVESTOR_1_PRIVATE_KEY=0x...
... (through INVESTOR_6)
```

## Items Remaining (Acceptable for Demo)
- **#8 MockParserAdapter**: Activate by setting `DOCUMENT_PARSER_PROVIDER=gemini` + `GEMINI_API_KEY`
- **#9 Ephemeral storage**: Set `SUPABASE_STORAGE_BUCKET` env to use Supabase storage
- **#10 Job stubs**: Background jobs not used in synchronous demo flow
- **#12 Total supply hardcoded**: 10000 tokens, acceptable for single-fund demo
