# Angainor

For the new local, persistent functional demo, see [Functional sandbox setup and scope](docs/functional-sandbox.md). Start it with `node scripts/run-sandbox.mjs` after installing backend and frontend dependencies. The sandbox uses a separate API and does not run the legacy blockchain workflows below.

Programmable infrastructure layer for private real estate funds. Replaces manual back-office workflows with a blockchain-based settlement engine using ERC-3643 security tokens.

## Prerequisites

- **Node.js** >= 20
- **npm** >= 9
- **PostgreSQL** (local or Supabase) for backend

## Project Structure

```
contracts/          Solidity smart contracts (IdentityRegistry, AngainorToken, DocumentRegistry, FundTermsRegistry)
lib/                Off-chain helpers used by Hardhat scripts
scripts/            Deployment and utility scripts
test/               123 contract tests across 11 files
backend/            NestJS 11 + Fastify + Prisma v7 + PostgreSQL API
frontend/           React 18 + Vite + Tailwind + shadcn/ui dashboard
docs/               Public spec documents
```

## Quick Start

### 1. Install dependencies

```bash
npm install                       # root: Hardhat + contracts
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Compile contracts and run tests

```bash
npm run compile
npm test
```

All 123 contract tests run on an in-memory Hardhat EVM. No external services required.

### 3. Run the local stack

In three terminals:

```bash
# Terminal 1 — Hardhat node
npx hardhat node

# Terminal 2 — Backend API
cd backend && npm run start:dev      # http://localhost:3000

# Terminal 3 — Frontend
cd frontend && npm run dev           # http://localhost:8080
```

### 4. Demo flow

Log in at `http://localhost:8080` (admin: `demo@angainor.io` / `AngainorDemo2024`) and walk through:

1. **Upload Master LPA** — PDF is SHA-256 hashed, anchored on-chain in DocumentRegistry.
2. **Settle Wires** — 3-way match (investor + amount + document ref) flips Pending → Settled and mints ANGN tokens.
3. **Bulk import investors** — CSV/XLSX upload from the Investors tab.
4. **Test illegal transfer** — non-LP wallet attempt reverts on-chain.
5. **Execute legal transfer** — LP-to-LP transfer succeeds; cap table updates instantly.

## Environment Variables

Copy templates and fill in secrets:

```bash
cp .env.example .env                 # root (Sepolia RPC, deployer key)
cp backend/.env.example backend/.env # DATABASE_URL, JWT_SECRET, etc.
```

The local Hardhat demo (no backend) works without any `.env` configuration.

## Key Commands

| Command | Description |
|---|---|
| `npm test` | Run all 123 contract tests on local Hardhat EVM |
| `npm run compile` | Compile Solidity contracts |
| `npx hardhat node` | Start persistent local blockchain on port 8545 |
| `npx hardhat run scripts/deploy-angainor.js --network localhost` | Deploy full Angainor stack to local node |
| `npx hardhat run scripts/cap-table.js --network localhost` | Print cap table from deployed contracts |
| `npm run deploy:sepolia` | Deploy contracts to Sepolia testnet |

## Architecture

### Smart Contracts (Sepolia)

- **IdentityRegistry** (`0x55822888...c78fb`) — investor whitelist with two-flag verification (isVerified + isEligible).
- **AngainorToken** / `ANGN` (`0x821A004B...cbdAc`) — ERC-20 security token with transfer restrictions. Overrides `_update()` to query IdentityRegistry; both sender and recipient must be eligible LPs.
- **DocumentRegistry** (`0x09BFB275...a13a9`) — immutable document hash anchoring with timestamps and document types.
- **FundTermsRegistry** (`0xD1e6625A...84f1e`) — on-chain fund term storage.

### Backend (NestJS 11 + Fastify + Prisma v7)

14 modules: auth, fund, identity, documents, subscriptions, settlements, tokenization, ownership, distribution, capital-calls, notices, audit, investor-portal, jobs. JWT auth with role guards (admin / platform_admin / fund_admin / operations_analyst / investor). Non-custodial transfers (frontend-signed via viem). See `backend/README.md`.

### Frontend (React 18 + Vite)

Public marketing surface (`/`, `/privacy`) under dark Angainor brand, plus admin and investor product surfaces under light institutional banking aesthetic. EIP-6963 wallet detection (MetaMask, Phantom). See `frontend/README.md`.

### Token Details

- **Name**: Angainor Demo Fund I
- **Symbol**: ANGN
- **Total supply**: minted on settlement (2,000 ANGN per investor at 20% each in the demo)
- **Decimals**: 18
- **Transfer enforcement**: both parties must be `isEligibleLP()` in IdentityRegistry

## Production

- **Backend**: https://backend-kappa-olive-96.vercel.app
- **Frontend**: https://frontend-nine-woad-28.vercel.app
- **DB**: Supabase PostgreSQL

## Founder Constraints

- Payments are settled OFF-CHAIN. Mock bank wires are uploaded and parsed.
- No automated payouts or on-chain distributions in the demo. Waterfall configuration is display-only.
- All blockchain operations target Sepolia testnet only. A mainnet guard in deploy scripts blocks execution on non-allowlisted networks.
