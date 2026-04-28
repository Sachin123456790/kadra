# On-Chain Event Catalog

This document catalogs every event emitted by the Angainor smart contracts, their parameters, when they fire, and how the backend ingests them.

---

## IdentityRegistry Events

### `InvestorAdded`

```solidity
event InvestorAdded(address indexed investor);
```

| Parameter | Type | Indexed | Description |
|---|---|---|---|
| `investor` | `address` | Yes | Wallet address of the newly added investor. |

**Emitted when:** `addInvestor(address)` is called by the contract owner. Sets `isVerified[investor] = true`.

**Backend interpretation:** Investor identity has been registered on-chain. The investor is verified but not yet eligible for transfers until `setEligibility` is also called.

---

### `InvestorRemoved`

```solidity
event InvestorRemoved(address indexed investor);
```

| Parameter | Type | Indexed | Description |
|---|---|---|---|
| `investor` | `address` | Yes | Wallet address of the removed investor. |

**Emitted when:** `removeInvestor(address)` is called by the contract owner. Sets both `isVerified[investor] = false` and `isEligible[investor] = false`.

**Backend interpretation:** Investor has been fully deregistered. Any subsequent transfer attempts involving this address will revert.

---

### `EligibilityChanged`

```solidity
event EligibilityChanged(address indexed investor, bool eligible);
```

| Parameter | Type | Indexed | Description |
|---|---|---|---|
| `investor` | `address` | Yes | Wallet address of the investor. |
| `eligible` | `bool` | No | New eligibility state (`true` = eligible LP, `false` = ineligible). |

**Emitted when:** `setEligibility(address, bool)` is called by the contract owner.

**Backend interpretation:** The investor's LP eligibility flag has changed. When `eligible = true` and the investor is also verified, they can participate in transfers. When `eligible = false`, transfers to/from this address will revert.

---

## DocumentRegistry Events

### `DocumentRegistered`

```solidity
event DocumentRegistered(
    bytes32 indexed docHash,
    string docType,
    address indexed uploader,
    uint256 timestamp
);
```

| Parameter | Type | Indexed | Description |
|---|---|---|---|
| `docHash` | `bytes32` | Yes | SHA-256 hash of the registered document. |
| `docType` | `string` | No | Document type label (e.g., `"MASTER_LPA"`, `"LPA"`). |
| `uploader` | `address` | Yes | Address that registered the document (contract owner). |
| `timestamp` | `uint256` | No | Block timestamp at registration (`block.timestamp`). |

**Emitted when:** `registerDocument(bytes32, string)` is called by the contract owner. The function reverts if the document hash has already been registered (`"Document already registered"`).

**Backend interpretation:** A new document has been cryptographically anchored on-chain. The hash can be used to verify the original document's integrity at any point in the future. Documents are immutable once registered -- the same hash cannot be re-registered.

---

## AngainorToken Events

AngainorToken inherits from OpenZeppelin's ERC-20 implementation. The following events are emitted by the inherited `_update()` function (called by `transfer`, `transferFrom`, and `_mint`).

### `Transfer`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

| Parameter | Type | Indexed | Description |
|---|---|---|---|
| `from` | `address` | Yes | Sender address. `address(0)` for mint operations. |
| `to` | `address` | Yes | Recipient address. `address(0)` for burn operations. |
| `value` | `uint256` | No | Token amount (18 decimals). |

**Emitted when:** Any token movement occurs -- minting, transferring, or burning.

#### Event Subtypes by Address Pattern

| `from` | `to` | Meaning |
|---|---|---|
| `address(0)` | investor wallet | **Mint** -- new tokens created and assigned to investor. Only callable by contract owner via `mint()`. |
| investor wallet | investor wallet | **Transfer** -- LP-to-LP ownership transfer. Both parties must pass `isEligibleLP()`. |
| investor wallet | `address(0)` | **Burn** -- tokens destroyed. Bypasses eligibility check. |

#### Transfer Restriction Enforcement

For non-mint/non-burn transfers (where both `from` and `to` are non-zero), the `_update()` override enforces:

```solidity
if (from != address(0) && to != address(0)) {
    require(
        identityRegistry.isEligibleLP(from),
        "Transfer blocked: sender is not an approved Limited Partner"
    );
    require(
        identityRegistry.isEligibleLP(to),
        "Transfer blocked: recipient is not an approved Limited Partner"
    );
}
```

If either check fails, the transaction reverts and NO `Transfer` event is emitted.

### `Approval`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

| Parameter | Type | Indexed | Description |
|---|---|---|---|
| `owner` | `address` | Yes | Token holder granting approval. |
| `spender` | `address` | Yes | Address authorized to spend tokens. |
| `value` | `uint256` | No | Approved amount (18 decimals). |

**Emitted when:** `approve()` or `transferFrom()` modifies allowances. Standard ERC-20 behavior inherited from OpenZeppelin.

---

## Event Ingestion (Backend)

The backend indexes on-chain events into the `token_position_events` table for fast querying and cap table projection.

### Ingestion Pipeline

```
Chain (Hardhat / Sepolia)
    |
    |  Poll for Transfer events on AngainorToken
    |
    v
Event Parser
    |  Extract: from, to, value, txHash, blockNumber, logIndex
    |
    v
Event Classifier
    |  from == address(0)  -->  MINT
    |  to == address(0)    -->  BURN
    |  otherwise           -->  TRANSFER
    |
    v
token_position_events table
    |  Deduplicated by (chainId, txHash, logIndex) unique constraint
    |
    v
Cap Table Projection
    |  Sum positions per investor from event stream
    |  Cross-reference with balanceOf() for verification
```

### Event Type Mapping

| Chain Event Pattern | Backend Event Type | Description |
|---|---|---|
| `Transfer(address(0), to, value)` | `MINT` | New tokens minted to investor after settlement. |
| `Transfer(from, to, value)` | `TRANSFER` | LP-to-LP ownership transfer. |
| `Transfer(from, address(0), value)` | `BURN` | Tokens destroyed. |
| Manual correction | `ADJUSTMENT` | Off-chain reconciliation adjustment (no chain event). |
| Full resync | `SYNC` | Backend re-indexed all events from chain. |

### Deduplication

Events are uniquely identified by the tuple `(chainId, txHash, logIndex)`. This ensures that:

- Re-processing the same block does not create duplicate records.
- Events from different chains (e.g., Hardhat local vs Sepolia) are kept separate.
- Multiple events within the same transaction (e.g., batch mints) are individually tracked.

### Projection

The cap table is projected by replaying the event stream:

```
For each investor address:
    position = SUM(MINT values to address)
             + SUM(TRANSFER values to address)
             - SUM(TRANSFER values from address)
             - SUM(BURN values from address)
             + SUM(ADJUSTMENT values)
```

This projection should always match `AngainorToken.balanceOf(address)`. Any discrepancy triggers a `SYNC` event to re-index from chain.
