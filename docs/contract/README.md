# Angainor Smart Contract Overview

Angainor uses four Solidity smart contracts to implement a blockchain-based settlement engine for private real estate funds. The contracts enforce investor identity verification, transfer restrictions, and document provenance on-chain, following the ERC-3643 security token pattern.

## Contracts

| Contract | File | Purpose |
|---|---|---|
| `IdentityRegistry` | `contracts/IdentityRegistry.sol` | Investor identity verification and LP eligibility management |
| `AngainorToken` | `contracts/AngainorToken.sol` | ERC-20 security token with transfer restrictions via IdentityRegistry |
| `DocumentRegistry` | `contracts/DocumentRegistry.sol` | Immutable on-chain document hash anchoring with timestamps |
| `Lock` | `contracts/Lock.sol` | Time-locked ETH contract (Hardhat scaffold, used for Sepolia testnet deployment) |

## Technology

- **Solidity**: `^0.8.24`
- **OpenZeppelin**: v5.4.0 (`ERC20`, `Ownable`)
- **Toolchain**: Hardhat v2.28.6 with `@nomicfoundation/hardhat-toolbox`
- **Local Chain ID**: `31337` (Hardhat Network)
- **Testnet**: Sepolia (chain ID `11155111`)

## Design Pattern

The contracts implement an ERC-3643-style security token architecture:

```
IdentityRegistry (identity + eligibility)
        |
        v
AngainorToken (ERC-20 + transfer hooks query IdentityRegistry)
        |
        v
DocumentRegistry (document hash anchoring, independent)
```

### Ownership Model

All three Angainor contracts inherit from OpenZeppelin's `Ownable` (v5). The deployer address (`msg.sender`) becomes the contract owner. Owner-only functions control:

- **IdentityRegistry**: Adding/removing investors, setting LP eligibility
- **AngainorToken**: Minting tokens to investor wallets
- **DocumentRegistry**: Registering document hashes

The `Lock` contract uses its own ownership pattern (deployer stored as `owner` in constructor).

### Transfer Enforcement

Token transfers are enforced deterministically at the smart contract level. The `AngainorToken._update()` override queries `IdentityRegistry.isEligibleLP()` for both sender and recipient on every transfer. Non-eligible transfers revert immediately -- there is no pending or approval state.

### Document Provenance

Documents (e.g., Master LPA) are hashed off-chain using SHA-256. The resulting hash is anchored on-chain via `DocumentRegistry.registerDocument()`, creating an immutable, time-stamped record. Once registered, a document hash cannot be modified or removed.

## Demo Token

In the Angainor demo deployment, the token is configured as:

| Property | Value |
|---|---|
| Name | Angainor Demo Fund I |
| Symbol | KDRA |
| Decimals | 18 (ERC-20 default) |
| Total Supply | 10,000 KDRA |
| Distribution | 2,000 KDRA per investor (5 investors, 20% each) |

## Contract Documentation

- [IdentityRegistry](identity-registry.md) -- Investor identity and LP eligibility
- [AngainorToken](angainor-token.md) -- ERC-20 security token with transfer restrictions
- [DocumentRegistry](document-registry.md) -- On-chain document hash anchoring
- [Testing Guide](testing.md) -- Test suite reference (123 tests)
- [Deployment Guide](deployment.md) -- Local and Sepolia deployment instructions
