# On-Chain Architecture Overview

This document describes what Angainor stores on-chain versus off-chain, how contracts are organized per fund, which networks are targeted, and how the backend interfaces with the blockchain layer.

---

## On-Chain vs Off-Chain Boundary

Angainor draws a strict line between what is canonical on-chain and what lives off-chain. The chain is the settlement layer and system of record for ownership. Everything else -- documents, workflows, calculations -- stays off-chain with cryptographic links back to the chain.

### On-Chain Canonical

These records live on the blockchain and are the single source of truth:

| Record | Contract | Description |
|---|---|---|
| Settled token balances | `AngainorToken` (ERC-20) | `balanceOf(address)` is the canonical ownership ledger. |
| Transfer and mint execution facts | `AngainorToken` | Every `Transfer` event (including mints where `from == address(0)`) is immutable and timestamped. |
| Document hash anchors | `DocumentRegistry` | SHA-256 hash of the source document, document type, uploader address, and block timestamp. The document itself is NOT stored on-chain. |
| Identity eligibility state | `IdentityRegistry` | Per-address `isVerified` and `isEligible` flags that gate token transfers. |

### Off-Chain Canonical

These records are managed by the backend and are NOT stored on-chain:

| Record | Component | Description |
|---|---|---|
| Source documents (PDFs) | File storage | Master LPA, wire confirmations, legal docs. Only their SHA-256 hashes are anchored on-chain. |
| Document extraction and parsing | `lib/document-hasher.js` | SHA-256 computation, metadata extraction. |
| Subscription records | `lib/subscription-ledger.js` | Investor subscriptions with status (`pending` / `settled`), allocation %, capital committed, LPA hash reference. |
| Settlement validation | `lib/settlement-validator.js` | 3-way match (investor identity, capital amount, document reference). Payments are settled OFF-CHAIN. |
| Eligibility workflow | Backend logic | Investor onboarding, KYC decisions, and the workflow that leads to calling `addInvestor()` and `setEligibility()` on-chain. |
| Waterfall configuration | `lib/fund-manager.js` | Preferred return, IRR hurdle, GP promote. Display-only -- no on-chain distributions. |
| Capital accounts | `lib/capital-accounts.js` | Per-investor contribution tracking, ownership %, capital returned. |
| Audit exports | Backend | CSV cap tables, PDF hash registries, settlement timelines, transfer logs. |

### Derived (Computed from Chain Events)

| Record | Source | Description |
|---|---|---|
| Cap table projections | `AngainorToken.balanceOf()` | Ownership percentages computed from token balances and total supply. |
| Ownership snapshots | `Transfer` events | Historical ownership reconstructed by replaying the event stream. |
| Token position events | Event ingestion | Backend indexes chain events into `token_position_events` for fast querying and projection. |

---

## One-Contract-Per-Fund Model

Each fund gets its own isolated set of three contracts:

```
Fund "Angainor Demo Fund I"
  +-- IdentityRegistry   (investor whitelist + LP eligibility for this fund)
  +-- DocumentRegistry    (document hash anchors for this fund's legal docs)
  +-- AngainorToken          (ERC-20 security token representing ownership in this fund)
```

**Why per-fund isolation:**

- Transfer restrictions are fund-specific. An investor eligible in Fund A is not automatically eligible in Fund B.
- Document anchors are scoped to the fund's governing documents.
- Token supply represents ownership in exactly one fund entity.
- Clean audit trail -- every contract address maps to exactly one legal entity.

The `AngainorToken` constructor takes the `IdentityRegistry` address as a parameter, permanently linking the token's transfer restriction logic to that fund's identity registry:

```solidity
constructor(
    string memory name,
    string memory symbol,
    address _identityRegistry
) ERC20(name, symbol) Ownable(msg.sender) {
    identityRegistry = IIdentityRegistry(_identityRegistry);
}
```

---

## Chain Targets

| Network | Chain ID | Usage | Configuration |
|---|---|---|---|
| Hardhat local | 31337 | Development, testing, demo | Default network. Auto-mine enabled. 20 deterministic signers. |
| Sepolia testnet | 11155111 | Testnet deployment | Requires `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` env vars. |
| Mainnet | -- | **Blocked** | Deploy scripts include a mainnet guard. Never deploy to mainnet. |

The Hardhat configuration in `hardhat.config.js`:

```javascript
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.TESTNET_RPC || "",
      accounts: isValidPrivateKey(process.env.DEPLOYER_PRIVATE_KEY)
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 11155111,
    },
  },
};
```

---

## Adapter Pattern

The backend is designed so that application services never import `ethers` or Hardhat directly. All chain interaction goes through a `TokenContractAdapter` interface.

```
Application Service  -->  TokenContractAdapter  -->  Chain (Hardhat / Sepolia)
                              |
                     +--------+--------+
                     |                 |
              MockAdapter      HardhatAdapter
            (tests, dev)       (local node, testnet)
```

**Rules:**

1. Only the adapter layer imports `ethers`, `hardhat`, or any chain library.
2. Application services call adapter methods (`deploy`, `mint`, `transfer`, `getBalance`).
3. Reverted transactions are represented as off-chain records with `CHAIN_REVERTED` status, not swallowed exceptions.
4. Pre-check failures (e.g., ineligible recipient detected before submitting to chain) produce `PRECHECK_FAILED` status with no chain transaction.

See [adapter-interface.md](./adapter-interface.md) for the full interface specification.

---

## Related Documents

- [Data Flow](./data-flow.md) -- end-to-end flow from document upload to cap table
- [Event Catalog](./events.md) -- all on-chain events and their backend ingestion
- [Adapter Interface](./adapter-interface.md) -- `TokenContractAdapter` specification
- [Transfer Enforcement](./transfer-enforcement.md) -- ERC-3643 style restriction model
- [Hardhat Configuration](./hardhat-config.md) -- compiler, networks, signer conventions
