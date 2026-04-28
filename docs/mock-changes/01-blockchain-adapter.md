# Mock Change #1-3: Blockchain Adapter Migration

## What Changed
Replaced `MockTokenContractAdapter` and `SepoliaTokenContractAdapter` (both fully simulated) with a single `ViemTokenContractAdapter` that executes real on-chain transactions on Sepolia.

## Files Changed

### Deleted
- `backend/src/adapters/blockchain/mock-token-contract.adapter.ts` -- in-memory mock, wiped on cold start
- `backend/src/adapters/blockchain/sepolia-token-contract.adapter.ts` -- fake despite the name, never called contracts

### Created
- `backend/src/adapters/blockchain/viem-client.provider.ts` -- Central viem client factory (publicClient, deployerWalletClient, investor wallet clients)
- `backend/src/adapters/blockchain/viem-token-contract.adapter.ts` -- Real adapter: deploy returns pre-deployed address, mint/transfer/getBalance call real contracts
- `backend/src/adapters/blockchain/abi/angainor-token.abi.ts` -- AngainorToken ABI extracted from Hardhat artifacts
- `backend/src/adapters/blockchain/abi/identity-registry.abi.ts` -- IdentityRegistry ABI
- `backend/src/adapters/blockchain/abi/document-registry.abi.ts` -- DocumentRegistry ABI

### Modified
- `backend/src/modules/tokenization/tokenization.module.ts` -- Removed isRemoteChain() conditional; always uses ViemTokenContractAdapter
- `backend/src/modules/tokenization/tokenization.service.ts` -- Uses real IDENTITY_REGISTRY_ADDRESS from env
- `backend/src/modules/jobs/jobs.module.ts` -- Added ViemClientProvider
- `backend/src/modules/jobs/jobs.service.ts` -- Real chain event ingestion via publicClient.getContractEvents()

## Deployed Contracts (Sepolia)

| Contract | Address | Deploy TX Block |
|----------|---------|-----------------|
| IdentityRegistry | `0x55822888507cac67bE5C11516e00C4597E7c78fb` | 10411784 |
| DocumentRegistry | `0x09BFB275f27FEB8b89A20844b84af2Fa68ba13a9` | 10411785 |
| AngainorToken (KDRA) | `0x4bFe48Fe5A126f6A4f53BF95d82cF4881A1101Ef` | 10411786 |

## Wallets Generated

| Role | Address |
|------|---------|
| Deployer | `0xf4965cB352c5370530900a08ba03285d3811347A` |
| Investor 1 (Alpine) | `0x47F430D7d898F8bf8BB6A89938C066C30a75D326` |
| Investor 2 (Bridgewater) | `0xd11B2Ab28610F2E22Db7B51cd26DfF91618f2A5C` |
| Investor 3 (Cascade) | `0xe552DE75e93Eca51c2b58BC3b0bA6628DC3eadc6` |
| Investor 4 (Dominion) | `0xBCA2A58A8827C4b6b66Fc08258761951A21f70c7` |
| Investor 5 (Evergreen) | `0x8031B890dd4a302FBF6f1a9E50ce7848DBC3B027` |
| Investor 6 (Foxglove) | `0xaB427a8b61aa17f672D902F593f13Fe8945f1513` |

All 5 eligible investors verified on-chain via IdentityRegistry.setEligibleLP().

## How It Works Now

- **deploy()**: Returns the pre-deployed AngainorToken address from `ANGAINOR_TOKEN_ADDRESS` env var
- **mint()**: Deployer wallet calls `angainorToken.write.mint(toAddress, amount)` -- real on-chain mint
- **transfer()**: Looks up investor private key from env, signs real ERC-20 transfer
- **getBalance()**: Calls `angainorToken.read.balanceOf(address)` on real contract
