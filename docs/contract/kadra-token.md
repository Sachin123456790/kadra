# KadraToken Contract

**File**: `contracts/KadraToken.sol`
**License**: MIT
**Solidity**: `^0.8.24`
**Inherits**: `ERC20`, `Ownable` (OpenZeppelin v5)

## Purpose

KadraToken is an ERC-20 security token that enforces transfer restrictions via the IdentityRegistry contract. It represents fractional ownership in a private real estate fund. Both the sender and recipient of any transfer must be verified, eligible Limited Partners -- otherwise the transaction reverts immediately.

This implements the ERC-3643 security token pattern: compliance rules are hardcoded into the token contract itself, not enforced externally after the fact.

## Interface Dependency

The contract depends on the `IIdentityRegistry` interface, defined in the same file:

```solidity
interface IIdentityRegistry {
    function isEligibleLP(address investor) external view returns (bool);
}
```

This interface is satisfied by the `IdentityRegistry` contract.

## State Variables

```solidity
IIdentityRegistry public identityRegistry;
```

| Variable | Type | Description |
|---|---|---|
| `identityRegistry` | `IIdentityRegistry` | Reference to the deployed IdentityRegistry contract |

The `identityRegistry` address is set once in the constructor and cannot be changed after deployment.

## Constructor

```solidity
constructor(
    string memory name,
    string memory symbol,
    address _identityRegistry
) ERC20(name, symbol) Ownable(msg.sender)
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Token name (e.g., `"Kadra Demo Fund I"`) |
| `symbol` | `string` | Token symbol (e.g., `"KDRA"`) |
| `_identityRegistry` | `address` | Address of the deployed IdentityRegistry contract |

The constructor initializes the ERC-20 token with the given name and symbol, sets the deployer as owner, and stores the IdentityRegistry address.

## Functions

### `mint(address to, uint256 amount)`

```solidity
function mint(address to, uint256 amount) external onlyOwner
```

Mints new tokens to the specified address. This is the only way to create new tokens -- there is no public or self-service minting.

- **Access**: `onlyOwner`
- **Effect**: Calls the internal `_mint(to, amount)` which triggers `_update(address(0), to, amount)`
- **Note**: The `_update` override skips the eligibility check when `from == address(0)` (mint operation). The recipient does not need to be an eligible LP to receive minted tokens. Transfer restriction enforcement applies only to subsequent transfers.

### `_update(address from, address to, uint256 value)`

```solidity
function _update(address from, address to, uint256 value) internal override
```

Overrides the OpenZeppelin ERC-20 `_update` function, which is the single internal entry point for all token movements (mints, transfers, burns).

**Transfer restriction logic:**

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
super._update(from, to, value);
```

| Condition | Behavior |
|---|---|
| `from == address(0)` | Mint operation -- no eligibility check |
| `to == address(0)` | Burn operation -- no eligibility check |
| Both non-zero | Transfer -- both `from` and `to` must pass `isEligibleLP()` |

If either check fails, the transaction reverts with a descriptive error message. There is no pending state, no approval queue -- the transfer is rejected immediately and atomically.

## Revert Messages

| Message | Trigger |
|---|---|
| `"Transfer blocked: sender is not an approved Limited Partner"` | Sender is not verified or not eligible in IdentityRegistry |
| `"Transfer blocked: recipient is not an approved Limited Partner"` | Recipient is not verified or not eligible in IdentityRegistry |

## Demo Configuration

In the Kadra demo deployment (`scripts/deploy-kadra.js`), the token is configured as follows:

| Property | Value |
|---|---|
| Name | `Kadra Demo Fund I` |
| Symbol | `KDRA` |
| Decimals | `18` (ERC-20 default, not overridden) |
| Total Supply | `10,000 KDRA` (minted across 5 investors) |
| Per Investor | `2,000 KDRA` (20% ownership each) |

Token amounts use 18 decimals internally. `2,000 KDRA` is represented as `2000 * 10^18` in raw `uint256` values.

## Transfer Scenarios

### Legal Transfer (LP-to-LP)

Both sender and recipient are registered in IdentityRegistry with `isVerified == true` and `isEligible == true`. The transfer succeeds, and the cap table updates reflect the new ownership distribution.

### Illegal Transfer (LP-to-non-LP)

The recipient is not in the IdentityRegistry or lacks LP eligibility. The `_update` override calls `identityRegistry.isEligibleLP(to)` which returns `false`. The transaction reverts immediately.

### Illegal Transfer (removed LP as sender)

If an LP is removed from the IdentityRegistry (via `removeInvestor()`), they can no longer send tokens. The `_update` override calls `identityRegistry.isEligibleLP(from)` which returns `false`. The transaction reverts.

## Inherited ERC-20 Functions

All standard ERC-20 functions are available via the OpenZeppelin base contract:

- `name()`, `symbol()`, `decimals()`, `totalSupply()`
- `balanceOf(address)`, `allowance(address, address)`
- `transfer(address, uint256)`, `approve(address, uint256)`, `transferFrom(address, address, uint256)`

All transfer paths (`transfer`, `transferFrom`) route through `_update()`, so transfer restrictions apply uniformly.
