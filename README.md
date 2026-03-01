# Kadra

Programmable infrastructure layer for private real estate funds. Replaces manual back-office workflows with a blockchain-based settlement engine using ERC-3643 security tokens.

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

## Project Structure

```
contracts/          Solidity smart contracts (IdentityRegistry, KadraToken, DocumentRegistry)
lib/                Off-chain business logic (settlement validator, subscription ledger, etc.)
scripts/            Deployment and utility scripts
test/               123 tests across 11 files
data/               Mock data (investors, fund config, wire confirmations, sample LPA)
frontend/           Next.js dashboard for demo workflow
```

## Quick Start

### 1. Install dependencies

```bash
# Root (Hardhat + contracts)
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Compile contracts

```bash
npm run compile
```

### 3. Run tests

```bash
npm test
```

All 123 tests run on an in-memory Hardhat EVM — no external services needed.

### 4. Start the Hardhat node

```bash
npx hardhat node
```

This starts a persistent local blockchain at `http://127.0.0.1:8545` with 20 pre-funded accounts. Keep this terminal open.

### 5. Start the frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

The dashboard is available at **http://localhost:3000**.

### 6. Walk through the demo

Open `http://localhost:3000` and click through the steps in order:

1. **Deploy Infrastructure** — deploys IdentityRegistry, KadraToken, and DocumentRegistry contracts to the local chain, then registers 5 investors as eligible LPs
2. **Upload Master LPA** — drag-and-drop (or click to select) a PDF; the file is SHA-256 hashed and the hash is anchored on-chain in DocumentRegistry
3. **Settle Wires** — processes 5 mock wire confirmations through the 3-way match validator (investor + amount + document reference), flips subscriptions from Pending to Settled, and mints 2,000 KDRA tokens per investor
4. **Test Illegal Transfer** — attempts a transfer to a non-LP wallet; the on-chain transfer hook reverts immediately
5. **Execute Legal Transfer** — LP-to-LP transfer of 500 KDRA succeeds; cap table updates instantly

The cap table, contract addresses, document provenance, and activity log update in real time.

## Environment Variables

Only needed for Sepolia testnet deployment or Coinbase SDK integration. Copy the template:

```bash
cp .env.example .env
```

The local demo (Hardhat node + frontend) works without any `.env` configuration.

## Key Commands

| Command | Description |
|---|---|
| `npm test` | Run all 123 tests on local Hardhat EVM |
| `npm run compile` | Compile Solidity contracts |
| `npx hardhat node` | Start persistent local blockchain on port 8545 |
| `npx hardhat run scripts/deploy-kadra.js --network localhost` | Run full 9-step deployment script against local node |
| `npx hardhat run scripts/cap-table.js --network localhost` | Print cap table from deployed contracts |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |

## Architecture

### Smart Contracts

- **IdentityRegistry** — investor whitelist with two-flag verification (isVerified + isEligible). Only the deployer can add/remove investors.
- **KadraToken** — ERC-20 security token (OpenZeppelin v5) with transfer restrictions. Overrides `_update()` to query IdentityRegistry before every transfer. Both sender and recipient must be eligible LPs.
- **DocumentRegistry** — immutable on-chain document hash anchoring. Each document hash can only be registered once with a timestamp and document type.

### Off-Chain Libraries

- **settlement-validator** — 3-way match: checks investor identity, wire amount, and document reference before settling
- **subscription-ledger** — in-memory subscription records with Pending/Settled lifecycle
- **document-hasher** — SHA-256 hashing for uploaded documents
- **fund-manager** — fund entity creation and waterfall configuration (display-only)
- **capital-accounts** — per-investor capital account tracking

### Token Details

- Name: Kadra Demo Fund I
- Symbol: KDRA
- Total supply: 10,000 tokens (2,000 per investor at 20% each)
- Decimals: 18
- Transfer enforcement: both parties must be `isEligibleLP()` in IdentityRegistry
