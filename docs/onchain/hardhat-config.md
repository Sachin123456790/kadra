# Hardhat Configuration

This document describes the Hardhat setup for compiling, testing, and deploying Kadra smart contracts.

---

## Solidity Compiler

| Setting | Value |
|---|---|
| Solidity version | `0.8.24` |
| EVM target | Default (Shanghai) |
| Optimizer | Default (disabled) |

All three Kadra contracts (`IdentityRegistry.sol`, `KadraToken.sol`, `DocumentRegistry.sol`) and the legacy `Lock.sol` contract use `pragma solidity ^0.8.24`.

---

## Networks

### Hardhat Local (Default)

| Property | Value |
|---|---|
| Chain ID | `31337` |
| Mining | Auto-mine (each transaction is mined into its own block instantly) |
| Accounts | 20 deterministic signers, each funded with 10,000 ETH |
| RPC | `http://127.0.0.1:8545` (when running `npx hardhat node`) |

This is the default network. All commands run against Hardhat's in-process EVM unless `--network` is specified.

### Sepolia Testnet

| Property | Value |
|---|---|
| Chain ID | `11155111` |
| RPC URL | `SEPOLIA_RPC_URL` or `TESTNET_RPC` environment variable |
| Accounts | Single deployer from `DEPLOYER_PRIVATE_KEY` environment variable |

Configuration from `hardhat.config.js`:

```javascript
sepolia: {
  url: process.env.SEPOLIA_RPC_URL || process.env.TESTNET_RPC || "",
  accounts: isValidPrivateKey(process.env.DEPLOYER_PRIVATE_KEY)
    ? [process.env.DEPLOYER_PRIVATE_KEY]
    : [],
  chainId: 11155111,
}
```

The `isValidPrivateKey()` helper validates that the key matches the pattern `0x` followed by exactly 64 hex characters. If the key is missing or invalid, the accounts array is empty and Sepolia deployment will fail with a clear error.

### Mainnet

**Blocked.** No mainnet configuration exists. Deploy scripts include guards to prevent accidental mainnet deployment.

---

## Dependencies

### Hardhat Toolbox

```javascript
require("@nomicfoundation/hardhat-toolbox");
```

The `@nomicfoundation/hardhat-toolbox` (v6.1.2) bundles:

- `hardhat-ethers` -- ethers.js integration
- `hardhat-chai-matchers` -- Chai matchers for Solidity (`revertedWith`, `emit`, etc.)
- `hardhat-network-helpers` -- time manipulation, snapshots
- `hardhat-gas-reporter` -- gas usage reporting
- `solidity-coverage` -- code coverage
- `typechain` -- TypeScript bindings (not actively used; project is CommonJS)

### OpenZeppelin Contracts

```json
"@openzeppelin/contracts": "^5.4.0"
```

OpenZeppelin v5 contracts used:

| Contract | Import Path | Used By |
|---|---|---|
| `ERC20` | `@openzeppelin/contracts/token/ERC20/ERC20.sol` | `KadraToken` |
| `Ownable` | `@openzeppelin/contracts/access/Ownable.sol` | `KadraToken`, `IdentityRegistry`, `DocumentRegistry` |

OpenZeppelin v5 `Ownable` requires passing `msg.sender` to the constructor:

```solidity
constructor() Ownable(msg.sender) {}
```

### Other Dependencies

| Package | Version | Purpose |
|---|---|---|
| `dotenv` | `^17.3.1` | Load `.env` file for secret management |
| `@coinbase/agentkit` | `^0.2.0` | Coinbase SDK for AI-agent interaction |
| `@coinbase/coinbase-sdk` | `^0.25.0` | Coinbase platform SDK (Sepolia) |
| `@modelcontextprotocol/sdk` | `^1.17.4` | MCP server for agent tooling |

---

## Signer Convention

Hardhat provides 20 deterministic signers when running on the local network. Kadra assigns them by index:

| Index | Role | Description |
|---|---|---|
| `[0]` | Deployer / Owner | Deploys all contracts. Owns `IdentityRegistry`, `KadraToken`, and `DocumentRegistry`. Calls `addInvestor()`, `setEligibility()`, `mint()`, `registerDocument()`. |
| `[1]` | Investor A | Alpha Capital Partners (`investor-A`) |
| `[2]` | Investor B | Beta Ventures LLC (`investor-B`) |
| `[3]` | Investor C | Gamma Real Estate Trust (`investor-C`) |
| `[4]` | Investor D | Delta Institutional Fund (`investor-D`) |
| `[5]` | Investor E | Epsilon Family Office (`investor-E`) |
| `[6]` | Outsider | Non-LP address used in transfer enforcement tests |
| `[7-19]` | Unused | Available for additional test scenarios |

The mapping from investor ID to signer index is defined in `data/investors.json`:

```json
{
  "investors": [
    { "id": "investor-A", "name": "Alpha Capital Partners", "walletIndex": 1 },
    { "id": "investor-B", "name": "Beta Ventures LLC",      "walletIndex": 2 },
    { "id": "investor-C", "name": "Gamma Real Estate Trust", "walletIndex": 3 },
    { "id": "investor-D", "name": "Delta Institutional Fund","walletIndex": 4 },
    { "id": "investor-E", "name": "Epsilon Family Office",  "walletIndex": 5 }
  ]
}
```

---

## Key Commands

### Compile Contracts

```bash
npm run compile
# or
npx hardhat compile
```

Compiles all `.sol` files in `contracts/` and outputs artifacts to `artifacts/`.

### Run Tests

```bash
npm test
# or
npx hardhat test
```

Runs all 123 tests across 11 test files on the local Hardhat EVM. No external dependencies required.

### Deploy Kadra System (Local)

```bash
npx hardhat run scripts/deploy-kadra.js
```

Executes the full 9-step deployment:
1. Deploy IdentityRegistry, DocumentRegistry, KadraToken
2. Create fund entity (off-chain)
3. Register 5 investors with LP eligibility
4. Hash and anchor Master LPA on-chain
5. Create subscription records (off-chain)
6. Validate wire confirmations and settle (off-chain + mint on-chain)
7. Print cap table
8. Execute transfer enforcement tests
9. Print updated cap table

Saves deployment evidence to `EVIDENCE/kadra-deploy/`.

### Read Cap Table

```bash
npx hardhat run scripts/cap-table.js
```

Reads deployed contract addresses from `EVIDENCE/kadra-deploy/addresses.json` and prints the current cap table by querying `balanceOf()` for each investor.

### Deploy to Sepolia

```bash
npm run deploy:sepolia
# or
npx hardhat run scripts/deploy.js --network sepolia
```

Requires `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in `.env`.

### Fetch Sepolia Transactions

```bash
npm run fetch:sepolia
# or
npx hardhat run scripts/fetch.js --network sepolia
```

### Start MCP Server

```bash
npm run mcp:server
# or
node scripts/mcp-agentkit-server.mjs
```

---

## Environment Variables

All secrets are managed via `.env` (gitignored). Required variables for Sepolia deployment:

| Variable | Format | Required For |
|---|---|---|
| `SEPOLIA_RPC_URL` | URL | Sepolia deployment and fetching |
| `TESTNET_RPC` | URL | Fallback for `SEPOLIA_RPC_URL` |
| `DEPLOYER_PRIVATE_KEY` | `0x` + 64 hex chars | Sepolia deployment |

The `lib/validate-env.js` module validates presence and format before any operation. Variable sets: `DEPLOY_ENV_VARS`, `TRANSFER_ENV_VARS`, `SQL_ENV_VARS`.

---

## Project Structure (Contracts and Artifacts)

```
contracts/
    IdentityRegistry.sol    Investor identity + LP eligibility (Ownable)
    KadraToken.sol          ERC-20 security token with transfer restrictions
    DocumentRegistry.sol    On-chain document hash anchoring (immutable)
    Lock.sol                Legacy time-locked ETH contract (Hardhat sample)

artifacts/
    contracts/
        IdentityRegistry.sol/
            IdentityRegistry.json       ABI + bytecode
            IdentityRegistry.dbg.json   Debug info
        KadraToken.sol/
            KadraToken.json
            KadraToken.dbg.json
        DocumentRegistry.sol/
            DocumentRegistry.json
            DocumentRegistry.dbg.json
        Lock.sol/
            Lock.json
            Lock.dbg.json
```
