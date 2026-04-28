# Transfer Restriction Model

This document describes how Angainor enforces transfer restrictions on its ERC-20 security token, following the ERC-3643 pattern of on-chain identity-gated transfers.

---

## Overview

The `AngainorToken` contract overrides the internal `_update()` function inherited from OpenZeppelin's ERC-20 implementation. This hook is called on every token movement -- mints, transfers, and burns. For regular transfers (where both sender and recipient are non-zero addresses), the contract queries the `IdentityRegistry` to verify that both parties are approved Limited Partners.

This is deterministic enforcement: the rules execute before the transfer can succeed, not after. There is no pending state, no manual approval queue, and no way to bypass the check.

---

## On-Chain Enforcement Logic

### AngainorToken._update() Override

```solidity
function _update(address from, address to, uint256 value) internal override {
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
}
```

### IdentityRegistry.isEligibleLP()

```solidity
function isEligibleLP(address investor) external view returns (bool) {
    return isVerified[investor] && isEligible[investor];
}
```

An address passes the eligibility check only when BOTH conditions are true:

| Flag | Set By | Meaning |
|---|---|---|
| `isVerified[addr]` | `addInvestor(addr)` | Identity has been registered in the system. |
| `isEligible[addr]` | `setEligibility(addr, true)` | Address is approved as a Limited Partner for this fund. |

---

## Transfer Decision Matrix

| Scenario | `from` | `to` | Eligibility Check | Outcome |
|---|---|---|---|---|
| Mint | `address(0)` | investor | Skipped | Succeeds (only owner can call `mint()`) |
| Burn | investor | `address(0)` | Skipped | Succeeds |
| LP-to-LP transfer | eligible LP | eligible LP | Both pass | Succeeds |
| LP-to-non-LP transfer | eligible LP | non-eligible | Recipient fails | Reverts |
| Non-LP-to-LP transfer | non-eligible | eligible LP | Sender fails | Reverts |
| Non-LP-to-non-LP transfer | non-eligible | non-eligible | Sender fails | Reverts |

### Why Mints Bypass the Check

The `from == address(0)` condition means tokens are being created, not transferred from an existing holder. Minting is restricted to the contract owner via the `onlyOwner` modifier on the `mint()` function. This is intentional: the deployer must be able to mint tokens to investors after settlement, even though the deployer wallet itself may not be an LP.

### Why Burns Bypass the Check

The `to == address(0)` condition means tokens are being destroyed. Burns are allowed regardless of the sender's eligibility status. This enables administrative token destruction if needed.

---

## Revert Messages

The contract emits descriptive revert messages that identify exactly which check failed:

| Revert Message | Cause |
|---|---|
| `"Transfer blocked: sender is not an approved Limited Partner"` | `isEligibleLP(from)` returned `false`. The sender is either not verified, not eligible, or both. |
| `"Transfer blocked: recipient is not an approved Limited Partner"` | `isEligibleLP(to)` returned `false`. The recipient is either not verified, not eligible, or both. |

The sender check executes first. If the sender is ineligible, the transaction reverts immediately without checking the recipient.

---

## Backend Pre-Check (Off-Chain)

Before submitting a transfer to the chain, the backend performs an off-chain pre-check to avoid wasting gas on transactions that will revert.

### Pre-Check Steps

```
1. Query IdentityRegistry.isEligibleLP(sender)
   --> If false: PRECHECK_FAILED, reason: "sender not eligible LP"

2. Query IdentityRegistry.isEligibleLP(recipient)
   --> If false: PRECHECK_FAILED, reason: "recipient not eligible LP"

3. Query AngainorToken.balanceOf(sender)
   --> If balance < amount: PRECHECK_FAILED, reason: "insufficient balance"

4. All checks pass: submit transfer to chain
```

### Transfer Record Statuses

Every transfer attempt -- successful or not -- is recorded as a first-class entity:

| Status | Chain TX | Gas Cost | Description |
|---|---|---|---|
| `PRECHECK_FAILED` | Not submitted | None | Off-chain validation caught the problem. |
| `CHAIN_REVERTED` | Submitted | Gas spent | Pre-check passed but chain reverted (race condition or state change between pre-check and execution). |
| `MINED` | Submitted | Gas spent | Transfer confirmed. `Transfer` event emitted. |

### Why Record Failed Transfers

Failed transfers are valuable audit evidence:

- They prove the enforcement system is working.
- They document unauthorized transfer attempts.
- They provide a complete timeline of all transfer activity, not just successful ones.
- They are included in audit exports alongside successful transfers.

---

## Eligibility State Changes

The contract owner can modify eligibility at any time:

```solidity
// Grant eligibility
identityRegistry.setEligibility(investorAddress, true);

// Revoke eligibility
identityRegistry.setEligibility(investorAddress, false);

// Full removal (clears both isVerified and isEligible)
identityRegistry.removeInvestor(investorAddress);
```

**Effect on existing token holders:** An investor who holds tokens but loses eligibility can no longer transfer those tokens. The tokens remain in their wallet, but any `transfer()` call where they are the sender will revert. They also cannot receive new tokens via transfer (but could still receive tokens via mint if the owner calls `mint()` directly, since mints bypass the check).

---

## Comparison to ERC-3643

Angainor's transfer restriction model follows the spirit of ERC-3643 (Security Token Standard) but with a simplified implementation:

| Feature | ERC-3643 | Angainor Implementation |
|---|---|---|
| Identity registry | ONCHAINID (claim-based) | Simple `isVerified` + `isEligible` mapping |
| Transfer compliance | Modular compliance contract | Single `_update()` override |
| Transfer pre-check | `canTransfer()` view function | Backend pre-check via `isEligibleLP()` + `balanceOf()` |
| Forced transfers | Agent role with `forcedTransfer()` | Not implemented |
| Recovery | Recovery agent | Not implemented |
| Pause | Pausable modifier | Not implemented |

The simplified approach is appropriate for the current fund administration use case where the contract owner (fund administrator) has full control over the identity registry and token minting.

---

## Test Coverage

Transfer enforcement is tested in the E2E test suite (`test/e2e-angainor.test.js`):

| Test | Description |
|---|---|
| Section H: LP-to-LP Token Transfer | Verifies 500 KDRA transfer between two eligible LPs succeeds. |
| Section I: Illegal Transfer to Non-LP | Verifies transfer from LP to non-LP outsider reverts with `"recipient is not an approved Limited Partner"`. |
| Section I: Transfer from Non-LP | Verifies transfer from non-LP (who received tokens via mint) to LP reverts with `"sender is not an approved Limited Partner"`. |

Additional unit tests in `test/angainor-token.test.js` cover edge cases for the token contract's transfer restriction logic.
