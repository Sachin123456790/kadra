# On-Chain Data Flow

This document traces the complete data flow from document upload through settlement to cap table projection, identifying what happens on-chain versus off-chain at each step.

---

## End-to-End Flow Diagram

```
Master LPA (PDF)
    |
    v
SHA-256 hash (off-chain, lib/document-hasher.js)
    |
    v
DocumentRegistry.registerDocument(hash, "MASTER_LPA")      <-- ON-CHAIN
    |   Emits: DocumentRegistered(hash, "MASTER_LPA", deployer, timestamp)
    |
    v
Investor registered
    |
    +-- IdentityRegistry.addInvestor(wallet)                <-- ON-CHAIN
    |       Emits: InvestorAdded(wallet)
    |
    +-- IdentityRegistry.setEligibility(wallet, true)       <-- ON-CHAIN
    |       Emits: EligibilityChanged(wallet, true)
    |
    v
Subscription created (off-chain, lib/subscription-ledger.js)
    |   Status: PENDING
    |   Fields: investorId, walletAddress, allocationPercent,
    |           lpaHash, fundName, capitalCommitted
    |
    v
Wire confirmation uploaded (off-chain)
    |
    v
3-way match validation (off-chain, lib/settlement-validator.js)
    |   Check 1: subscription.investorId == wire.investorId
    |   Check 2: subscription.capitalCommitted == wire.amount
    |   Check 3: subscription.lpaHash == wire.documentRef
    |   Check 4: subscription.status == "pending" (no double settlement)
    |
    v
Settlement confirmed (off-chain)
    |   Subscription status: PENDING --> SETTLED
    |   settledAt timestamp recorded
    |
    v
KadraToken.mint(investorWallet, tokenAmount)                <-- ON-CHAIN
    |   Emits: Transfer(address(0), investorWallet, amount)
    |   Only callable by contract owner (deployer)
    |
    v
Capital account created (off-chain, lib/capital-accounts.js)
    |   initialContribution, ownershipPercent, fundName
    |
    v
On-chain Transfer events emitted
    |   Ingested into token_position_events table
    |   Deduplicated by (chainId, txHash, logIndex)
    |
    v
Cap table projected from token balances
    |   balanceOf(address) / totalSupply() = ownership %
    |
    v
Transfer attempt (LP-to-LP)
    |
    +-- Backend pre-check (off-chain):
    |       - IdentityRegistry.isEligibleLP(sender) == true?
    |       - IdentityRegistry.isEligibleLP(recipient) == true?
    |       - KadraToken.balanceOf(sender) >= amount?
    |       - If any fail: PRECHECK_FAILED, no chain tx submitted
    |
    +-- KadraToken.transfer(recipient, amount)              <-- ON-CHAIN
    |       _update() override checks:
    |         - isEligibleLP(from) --> revert if false
    |         - isEligibleLP(to)   --> revert if false
    |       If both pass:
    |         Emits: Transfer(from, to, amount)
    |         Cap table updates instantly
    |       If either fails:
    |         Transaction reverts
    |         Off-chain record: CHAIN_REVERTED status
    |
    v
Updated cap table reflects new ownership distribution
```

---

## Step-by-Step Detail

### 1. Document Anchoring

The Master LPA (or any governing document) is hashed off-chain using SHA-256, then the hash is anchored on-chain.

```javascript
// Off-chain: compute hash
const { hash, algorithm, size } = hashFile("/path/to/master-lpa.pdf");
// hash = "0x<64-char-hex>"

// On-chain: anchor the hash
await documentRegistry.registerDocument(hash, "MASTER_LPA");
```

The `DocumentRegistry` stores:

| Field | Value |
|---|---|
| `docHash` | SHA-256 hash (bytes32) |
| `timestamp` | `block.timestamp` at registration |
| `docType` | String label (e.g., `"MASTER_LPA"`, `"LPA"`) |
| `uploader` | `msg.sender` (deployer address) |
| `exists` | `true` (immutable once set, prevents re-registration) |

The document itself is never stored on-chain. Only the hash is anchored, providing tamper-evident provenance.

### 2. Investor Registration

Each investor is registered in the `IdentityRegistry` with two flags:

```solidity
// Step 1: Add investor (sets isVerified = true)
identityRegistry.addInvestor(investorWallet);

// Step 2: Set LP eligibility (sets isEligible = true)
identityRegistry.setEligibility(investorWallet, true);
```

An investor must satisfy BOTH conditions to pass the `isEligibleLP()` check:

```solidity
function isEligibleLP(address investor) external view returns (bool) {
    return isVerified[investor] && isEligible[investor];
}
```

### 3. Subscription Creation (Off-Chain)

Subscription records are created in-memory and track the relationship between an investor, their capital commitment, and the governing document:

| Field | Example |
|---|---|
| `id` | `sub-001` |
| `investorId` | `investor-A` |
| `walletAddress` | `0x70997970C518...` |
| `allocationPercent` | `20` |
| `capitalCommitted` | `1000000` |
| `lpaHash` | `0x<sha256>` |
| `status` | `pending` |

### 4. Settlement Validation (Off-Chain)

The 3-way match validates that the wire confirmation aligns with the subscription:

```
Wire Confirmation
    +-- investorId      must match subscription.investorId
    +-- amount          must match subscription.capitalCommitted
    +-- documentRef     must match subscription.lpaHash
    +-- subscription    must be in "pending" status (no double settlement)
```

All four checks must pass. If any fail, the settlement is rejected with specific error messages.

**Payments are settled OFF-CHAIN.** The wire confirmation is a parsed document (mock bank wire in demo). Kadra does not claim on-chain payment settlement.

### 5. Token Minting (On-Chain)

After settlement validation passes, the subscription status flips to `settled` and tokens are minted:

```javascript
// Off-chain: update subscription
updateStatus(subscriptionId, "settled");

// On-chain: mint tokens
await kadraToken.mint(investorWallet, tokensToMint);
```

Token amounts use 18 decimals (standard ERC-20):

```
2,000 tokens = 2000 * 10^18 = 2000000000000000000000
```

### 6. Cap Table Projection

The cap table is derived directly from on-chain token balances:

```javascript
const balance = await kadraToken.balanceOf(investorAddress);
const totalSupply = await kadraToken.totalSupply();
const ownershipPercent = (balance * 10000n) / totalSupply / 100;
```

There is no separate ownership database. The token contract IS the ownership ledger.

### 7. Transfer Execution

Transfers between LPs follow the pre-check then execute pattern:

```
1. Off-chain pre-check:
   - isEligibleLP(sender)?
   - isEligibleLP(recipient)?
   - balanceOf(sender) >= amount?

2. If pre-check passes, submit to chain:
   - KadraToken.transfer(recipient, amount)
   - Contract enforces eligibility in _update() override

3. Record outcome:
   - MINED: transfer succeeded, cap table updated
   - CHAIN_REVERTED: pre-check passed but chain rejected
   - PRECHECK_FAILED: pre-check caught the issue, no chain tx
```

---

## Data Residency Summary

```
+-------------------+     +-------------------+     +-------------------+
|    OFF-CHAIN      |     |    ON-CHAIN        |     |     DERIVED       |
+-------------------+     +-------------------+     +-------------------+
| Source documents  |     | Document hashes   |     | Cap table %       |
| Subscription      |---->| Token balances    |---->| Ownership history |
|   records         |     | Transfer events   |     | Position events   |
| Wire confirmations|     | Identity flags    |     | Audit snapshots   |
| Capital accounts  |     | Mint events       |     |                   |
| Waterfall config  |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
```
