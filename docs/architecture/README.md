# Architecture Documentation

This directory contains architecture and design documentation for the **markus** project — a Node.js application combining Hardhat smart-contract tooling, Coinbase SDK integration, and a SQL data API client, targeting the Ethereum Sepolia testnet.

## File map

| Document | Purpose |
|---|---|
| `README.md` | This file — overview and navigation |
| `DESIGN.md` | System design, component boundaries, data flows, risks |
| `implementation-plan.md` | Phased implementation status with concrete code references |

## Project structure with implementation evidence

```
contracts/
  Lock.sol              23 LOC  Time-locked ETH with owner-only withdrawal (Solidity ^0.8.24)

lib/
  coinbase-sdk-helper.js  33 LOC  getCoinbaseClient() — SDK factory for Sepolia (chainId 11155111)
  sql-api.js              59 LOC  fetchTransactionHistory(entityId, options) — HTTP + auth + fallback
  validate-env.js         64 LOC  validateEnv() with DEPLOY/TRANSFER/SQL env var sets
  legal-entity.js         34 LOC  loadLegalEntity() — validates data/legal-entity.json fields
  bank-accounts.js        48 LOC  loadBankAccounts(), getVerifiedAccounts() — bank fixture loader

scripts/
  deploy.js             111 LOC  Lock deploy + ETH transfer + mainnet guard + evidence artifacts
  fetch.js              164 LOC  eth_getTransactionByHash + SQL API integration + edge cases
  mcp-agentkit-server.mjs        MCP server using Coinbase AgentKit

test/
  Lock.js                41 LOC   3 tests  (unlockTime, owner, early-withdrawal revert)
  config.test.js        186 LOC  12 tests  (network config, env validation, simulation data)
  deploy.test.js        188 LOC  11 tests  (mainnet guard, deploy+transfer, reverts, entity fallback)
  fetch.test.js          75 LOC   5 tests  (hash validation, RPC fetch, response validation)
  sql-api.test.js       282 LOC  14 tests  (success, 4xx, 5xx, auth, fallback, rate limit, network)

data/
  legal-entity.json              Markus Holdings LLC simulation fixture
  bank-accounts.json             JPMorgan Chase checking/savings test accounts
```

## Key technologies

- **Hardhat** — Solidity compilation, local EVM, Sepolia deployment
- **Coinbase SDK** (`@coinbase/coinbase-sdk`) — wallet and account management
- **Coinbase AgentKit + MCP** — AI-agent server via Model Context Protocol
- **dotenv** — environment-driven configuration, no hardcoded secrets

## Implementation verification

All feature code runs via `npm test` on local Hardhat EVM with no external dependencies.
See `EVIDENCE/T1_implementation_inventory.md` for full file-by-file inventory with line counts and test mappings.
