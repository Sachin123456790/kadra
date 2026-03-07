# Backend-Chain Adapter Interface

This document specifies the `TokenContractAdapter` interface that decouples the Kadra backend from direct blockchain library dependencies. All chain interaction flows through this adapter layer.

---

## Design Rationale

The adapter pattern enforces a clean separation:

```
+---------------------+       +------------------------+       +------------------+
|  Application Layer  | ----> |  TokenContractAdapter  | ----> |  Blockchain      |
|  (services, routes) |       |  (interface)           |       |  (Hardhat/Sepolia)|
+---------------------+       +------------------------+       +------------------+
                                        ^
                                        |
                              +---------+---------+
                              |                   |
                     MockTokenContract    HardhatTokenContract
                        Adapter              Adapter
```

**Rules:**

1. Only the adapter layer imports `ethers`, `hardhat`, or any chain library.
2. Application services call adapter methods exclusively. They never construct transactions or decode event logs directly.
3. Reverted transactions produce structured error responses, not raw exceptions.
4. The adapter is swappable at runtime -- tests use the mock, deployment uses the real adapter.

---

## Interface Definition

```typescript
interface TokenContractAdapter {
  /**
   * Deploy a new KadraToken contract linked to an IdentityRegistry.
   * Also deploys the IdentityRegistry and DocumentRegistry for the fund.
   */
  deploy(input: DeployInput): Promise<DeployOutput>;

  /**
   * Mint tokens to an investor wallet after settlement validation.
   * Only callable by the contract owner (deployer).
   */
  mint(input: MintInput): Promise<TxOutput>;

  /**
   * Transfer tokens between two LP wallets.
   * Both sender and recipient must be eligible LPs.
   */
  transfer(input: TransferInput): Promise<TxOutput>;

  /**
   * Query the token balance of a wallet address.
   * Returns the raw balance as a decimal string (18 decimals).
   */
  getBalance(contractAddress: string, walletAddress: string): Promise<string>;
}
```

---

## Input Types

### DeployInput

```typescript
interface DeployInput {
  /** Token name, e.g., "Kadra Demo Fund I" */
  name: string;

  /** Token symbol, e.g., "KDRA" */
  symbol: string;

  /** Address of the already-deployed IdentityRegistry for this fund */
  identityRegistryAddress: string;
}
```

### MintInput

```typescript
interface MintInput {
  /** Address of the deployed KadraToken contract */
  contractAddress: string;

  /** Investor wallet address to receive tokens */
  toAddress: string;

  /**
   * Token amount as a decimal string (human-readable).
   * Example: "2000" means 2000 tokens (adapter handles 18-decimal conversion).
   */
  amount: string;
}
```

### TransferInput

```typescript
interface TransferInput {
  /** Address of the deployed KadraToken contract */
  contractAddress: string;

  /** Sender wallet address (must be an eligible LP) */
  fromAddress: string;

  /** Recipient wallet address (must be an eligible LP) */
  toAddress: string;

  /**
   * Token amount as a decimal string (human-readable).
   * Example: "500" means 500 tokens.
   */
  amount: string;
}
```

---

## Output Types

### DeployOutput

```typescript
interface DeployOutput {
  /** Deployed KadraToken contract address */
  contractAddress: string;

  /** Transaction hash of the deployment */
  txHash: string;

  /** Block number where the contract was deployed */
  blockNumber: number;
}
```

### TxOutput

```typescript
interface TxOutput {
  /** Transaction hash */
  txHash: string;

  /** Block number where the transaction was mined */
  blockNumber: number;
}
```

---

## Implementations

### MockTokenContractAdapter

**Status:** Available for tests and initial development.

**Behavior:**

- Maintains an in-memory mapping of `contractAddress -> (walletAddress -> balance)`.
- `deploy()` generates a deterministic contract address from the input parameters.
- `mint()` increments the in-memory balance and returns a deterministic tx hash.
- `transfer()` validates balances in-memory, decrements sender, increments recipient.
- `getBalance()` reads from the in-memory map.
- No actual chain interaction occurs.

**Use cases:**

- Unit tests for application services that depend on the adapter.
- Local development without a running Hardhat node.
- Deterministic test scenarios (no block timing, no gas, no nonces).

### HardhatTokenContractAdapter

**Status:** Not yet built. Planned implementation.

**Behavior (planned):**

- Uses `ethers.js` to connect to a Hardhat local node or Sepolia testnet.
- `deploy()` compiles and deploys the `KadraToken` contract, waits for the transaction receipt.
- `mint()` calls `kadraToken.mint(to, amount)` and waits for confirmation.
- `transfer()` connects as the sender signer and calls `kadraToken.transfer(to, amount)`.
- `getBalance()` calls `kadraToken.balanceOf(address)` and formats the result.
- Handles gas estimation, nonce management, and transaction receipt parsing.

**Use cases:**

- Integration tests against a live Hardhat node.
- Sepolia testnet deployment and interaction.
- Demo environment with real blockchain state.

---

## Error Handling and Transfer Status

The adapter layer produces structured outcomes, not raw exceptions. The calling service maps adapter results to transfer record statuses:

### Transfer Status Flow

```
Application Service
    |
    +-- Pre-check (off-chain):
    |     - isEligibleLP(sender)?
    |     - isEligibleLP(recipient)?
    |     - balanceOf(sender) >= amount?
    |     |
    |     +-- Any fail --> PRECHECK_FAILED
    |         (No chain transaction submitted)
    |
    +-- Submit to adapter:
          |
          +-- adapter.transfer() succeeds --> MINED
          |     txHash and blockNumber recorded
          |
          +-- adapter.transfer() reverts --> CHAIN_REVERTED
                Revert reason captured and stored
```

### Status Definitions

| Status | Chain TX Submitted | Description |
|---|---|---|
| `PRECHECK_FAILED` | No | Off-chain validation caught the issue before submitting to chain. No gas spent. |
| `MINED` | Yes | Transaction confirmed on-chain. Transfer event emitted. Cap table updated. |
| `CHAIN_REVERTED` | Yes | Transaction submitted but reverted on-chain. Gas spent but state unchanged. |

### First-Class Failed Records

Failed transfers (both `PRECHECK_FAILED` and `CHAIN_REVERTED`) are persisted as first-class records. They are:

- Visible in the fund dashboard.
- Included in audit exports.
- Queryable by investor, fund, and time range.
- Evidence of the enforcement system working correctly.

---

## Adapter Selection

The adapter is selected based on environment configuration:

```
CHAIN_ADAPTER=mock      -->  MockTokenContractAdapter
CHAIN_ADAPTER=hardhat   -->  HardhatTokenContractAdapter  (planned)
```

In test environments, the mock adapter is used by default. In deployment scripts (e.g., `scripts/deploy-kadra.js`), the Hardhat adapter will be used to interact with the local node or testnet.
