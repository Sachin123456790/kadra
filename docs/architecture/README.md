# Architecture Documentation

This directory contains architecture and design documentation for the **markus** project — a Node.js application combining Hardhat smart-contract tooling, Coinbase SDK integration, and a SQL data API client, targeting the Ethereum Sepolia testnet.

## File map

| Document | Purpose |
|---|---|
| `README.md` | This file — overview and navigation |
| `DESIGN.md` | System design, component boundaries, data flows, risks |
| `implementation-plan.md` | Phased implementation status and remaining work |

## Project structure (summary)

```
contracts/        Solidity smart contracts (Lock.sol)
lib/              Shared Node.js modules (SDK helper, SQL API, env validation, simulation data)
scripts/          Hardhat run scripts (deploy, fetch, MCP server)
test/             Hardhat + Mocha test suite
data/             Simulation fixtures (legal entity, bank accounts)
docs/             Project documentation
EVIDENCE/         Deterministic verification artifacts
```

## Key technologies

- **Hardhat** — Solidity compilation, local EVM, Sepolia deployment
- **Coinbase SDK** (`@coinbase/coinbase-sdk`) — wallet and account management
- **Coinbase AgentKit + MCP** — AI-agent server via Model Context Protocol
- **dotenv** — environment-driven configuration, no hardcoded secrets
