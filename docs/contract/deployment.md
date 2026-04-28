# Deployment Guide

This guide covers deploying Angainor smart contracts to the local Hardhat network and to the Sepolia testnet.

## Local Deployment (Full Angainor System)

### Command

```bash
npx hardhat run scripts/deploy-angainor.js
```

This runs the full 9-step Angainor system orchestration on the local Hardhat network.

### Deployment Steps

| Step | Action | Details |
|---|---|---|
| 1 | Deploy smart contracts | IdentityRegistry, DocumentRegistry, AngainorToken |
| 2 | Create fund entity | Off-chain fund record with waterfall configuration (display-only) |
| 3 | Register investors | 5 investors added to IdentityRegistry with verified + eligible status |
| 4 | Hash and anchor LPA | SHA-256 hash of `data/sample-lpa.txt` registered in DocumentRegistry |
| 5 | Create subscriptions | Off-chain subscription records (20% allocation each, status: Pending) |
| 6 | Validate wires and settle | 3-way match validation, status flip to Settled, token minting |
| 7 | Print cap table | Post-settlement ownership: 2,000 KDRA per investor (20% each) |
| 8 | Transfer enforcement | Legal LP-to-LP transfer (500 KDRA), illegal non-LP transfer (reverts) |
| 9 | Print updated cap table | Post-transfer ownership reflecting the LP-to-LP transfer |

### Contract Deployment Order

The contracts must be deployed in this order due to dependencies:

```
1. IdentityRegistry  (no dependencies)
2. DocumentRegistry   (no dependencies)
3. AngainorToken         (depends on IdentityRegistry address)
```

AngainorToken requires the IdentityRegistry address in its constructor:

```javascript
const AngainorToken = await hre.ethers.getContractFactory("AngainorToken");
const token = await AngainorToken.deploy("Angainor Demo Fund I", "KDRA", registryAddr);
```

### Evidence Output

The deployment script saves evidence to `EVIDENCE/angainor-deploy/`:

| File | Contents |
|---|---|
| `addresses.json` | Deployed contract addresses, network name, deployment timestamp |
| `subscriptions.json` | All subscription records with status and metadata |
| `capital-accounts.json` | Per-investor capital account state |

Example `addresses.json`:

```json
{
  "identityRegistry": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "documentRegistry": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "angainorToken": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "network": "hardhat",
  "deployedAt": "2025-01-01T00:00:00.000Z"
}
```

## Sepolia Testnet Deployment

### Command

```bash
npm run deploy:sepolia
```

This deploys the Lock contract to the Sepolia testnet and executes an ETH transfer.

### Prerequisites

Create a `.env` file in the project root with the following variables:

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...  # 64 hex chars, 0x-prefixed
TRANSFER_TARGET_ADDRESS=0x...  # Recipient for ETH transfer
```

The `DEPLOYER_PRIVATE_KEY` must be a valid 0x-prefixed 64-character hex string. The `lib/validate-env.js` module validates the format before execution.

### Mainnet Guard

The deploy script (`scripts/deploy.js`) includes a mainnet guard that blocks execution on non-allowlisted networks:

```javascript
const ALLOWED_NETWORKS = ["sepolia", "goerli", "hardhat", "localhost"];

if (!ALLOWED_NETWORKS.includes(networkName)) {
    console.error(`BLOCKED: Network "${networkName}" is not allowed.`);
    process.exitCode = 1;
    return;
}
```

This prevents accidental deployment to Ethereum mainnet. The guard cannot be bypassed without modifying the source code.

### Hardhat Network Configuration

The Sepolia network is configured in `hardhat.config.js`:

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

## Other Scripts

### Cap Table Reader

```bash
npx hardhat run scripts/cap-table.js
```

Reads the deployed AngainorToken contract and prints the current cap table. Requires a prior run of `deploy-angainor.js` (reads addresses from `EVIDENCE/angainor-deploy/addresses.json`).

Output includes token name, symbol, per-investor balances, ownership percentages, and total supply.

### Lock Contract Deploy + ETH Transfer

```bash
npx hardhat run scripts/deploy.js
```

Deploys the Lock contract (time-locked ETH) and executes a small ETH transfer. On local Hardhat, the transfer goes to the second signer. On live testnets, it uses the `TRANSFER_TARGET_ADDRESS` environment variable.

Saves evidence to `EVIDENCE/task3/`:
- `tx-hash.txt` -- Transaction hash
- `tx-receipt.json` -- Full transaction receipt with block number, gas used, and status

### Transaction History Fetch

```bash
npx hardhat run scripts/fetch.js
npm run fetch:sepolia  # Sepolia variant
```

Fetches transaction details using `eth_getTransactionByHash`. Reads the transaction hash from `EVIDENCE/task3/tx-hash.txt` or from the `TX_HASH` environment variable.

Handles edge cases:
- Invalid hash format (rejected before RPC call)
- Nonexistent transaction (provider returns null)
- Missing transaction hash (skips gracefully)

Saves output to `EVIDENCE/task4/`.

## Network Reference

| Network | Chain ID | Usage |
|---|---|---|
| Hardhat | 31337 | Local development and testing (default) |
| Sepolia | 11155111 | Public testnet deployment |
| Mainnet | 1 | Blocked by mainnet guard |
