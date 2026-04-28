# IdentityRegistry Contract

**File**: `contracts/IdentityRegistry.sol`
**License**: MIT
**Solidity**: `^0.8.24`
**Inherits**: `Ownable` (OpenZeppelin v5)

## Purpose

The IdentityRegistry contract manages investor identity verification and Limited Partner (LP) eligibility for a single fund. It acts as the on-chain whitelist that the AngainorToken contract queries before allowing any token transfer.

An investor must satisfy two conditions to be considered an eligible LP:

1. **Verified** -- identity has been confirmed (`isVerified[address] == true`)
2. **Eligible** -- LP eligibility has been granted (`isEligible[address] == true`)

Both flags must be `true` for `isEligibleLP()` to return `true`.

## Deployment Model

The contract does not include a `fundId` or multi-fund scoping mechanism. Each fund deployment gets its own IdentityRegistry instance. This is a deliberate design choice -- one contract per fund.

## State Variables

```solidity
mapping(address => bool) public isVerified;
mapping(address => bool) public isEligible;
```

| Variable | Type | Description |
|---|---|---|
| `isVerified` | `mapping(address => bool)` | Whether the investor's identity has been verified |
| `isEligible` | `mapping(address => bool)` | Whether the investor has LP eligibility for this fund |

Both mappings are `public`, so Solidity auto-generates getter functions.

## Constructor

```solidity
constructor() Ownable(msg.sender) {}
```

Sets the deployer as the contract owner via OpenZeppelin's `Ownable(msg.sender)`.

## Functions

### `addInvestor(address investor)`

```solidity
function addInvestor(address investor) external onlyOwner
```

Marks an address as identity-verified. Does not grant LP eligibility -- that requires a separate call to `setEligibility()`.

- **Access**: `onlyOwner`
- **Effect**: Sets `isVerified[investor] = true`
- **Emits**: `InvestorAdded(investor)`

### `removeInvestor(address investor)`

```solidity
function removeInvestor(address investor) external onlyOwner
```

Revokes both identity verification and LP eligibility for the given address. This is a complete removal -- the investor will fail all `isEligibleLP()` checks and will be unable to send or receive tokens.

- **Access**: `onlyOwner`
- **Effect**: Sets `isVerified[investor] = false` and `isEligible[investor] = false`
- **Emits**: `InvestorRemoved(investor)`

### `setEligibility(address investor, bool eligible)`

```solidity
function setEligibility(address investor, bool eligible) external onlyOwner
```

Grants or revokes LP eligibility for an address. The investor must also be verified (via `addInvestor()`) for `isEligibleLP()` to return `true`.

- **Access**: `onlyOwner`
- **Effect**: Sets `isEligible[investor] = eligible`
- **Emits**: `EligibilityChanged(investor, eligible)`

### `isEligibleLP(address investor)`

```solidity
function isEligibleLP(address investor) external view returns (bool)
```

Returns `true` only if the address is both verified and eligible. This is the function that AngainorToken calls in its `_update()` hook to enforce transfer restrictions.

- **Access**: Public (view)
- **Returns**: `isVerified[investor] && isEligible[investor]`

## Events

```solidity
event InvestorAdded(address indexed investor);
event InvestorRemoved(address indexed investor);
event EligibilityChanged(address indexed investor, bool eligible);
```

| Event | Parameters | Emitted By |
|---|---|---|
| `InvestorAdded` | `investor` (indexed) | `addInvestor()` |
| `InvestorRemoved` | `investor` (indexed) | `removeInvestor()` |
| `EligibilityChanged` | `investor` (indexed), `eligible` | `setEligibility()` |

## Typical Registration Flow

```
1. owner calls addInvestor(walletAddress)      -> isVerified = true
2. owner calls setEligibility(walletAddress, true) -> isEligible = true
3. isEligibleLP(walletAddress) now returns true
4. AngainorToken transfers to/from this address are permitted
```

## Integration with AngainorToken

AngainorToken holds a reference to the IdentityRegistry via the `IIdentityRegistry` interface:

```solidity
interface IIdentityRegistry {
    function isEligibleLP(address investor) external view returns (bool);
}
```

Every token transfer (excluding mints from the zero address) calls `isEligibleLP()` on both the sender and recipient. If either check fails, the transfer reverts.
