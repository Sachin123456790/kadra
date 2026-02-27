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

