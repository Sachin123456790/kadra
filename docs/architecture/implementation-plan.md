# Implementation Plan

## Phase 1: Project scaffold and smart contract — COMPLETED

- Hardhat project initialised with `@nomicfoundation/hardhat-toolbox`.
- `Lock.sol` contract implemented (time-locked ETH with owner-only withdrawal).
- `hardhat.config.js` configured for Sepolia with env-driven RPC and private key.
- Basic `Lock.js` test covering deployment and withdrawal logic.

## Phase 2: Coinbase SDK and environment validation — COMPLETED

- `lib/coinbase-sdk-helper.js`: SDK client factory for Sepolia, credential validation.
- `lib/validate-env.js`: Reusable env validator with named variable sets (deploy, transfer, SQL).
- `.env.example` pattern established for required variables.
- `test/config.test.js`: Tests for Hardhat config network resolution and env validation.

## Phase 3: Deploy, transfer, and simulation data — COMPLETED

- `scripts/deploy.js`: Deploys Lock, executes ETH transfer, saves evidence artifacts.
- Mainnet guard: blocks non-allowlisted networks.
- `lib/legal-entity.js` and `lib/bank-accounts.js`: simulation data loaders with field validation.
- `data/legal-entity.json` and `data/bank-accounts.json`: fixture files.
- `test/deploy.test.js`: Deployment and transfer tests on local Hardhat network.

## Phase 4: Transaction history and SQL API — COMPLETED

- `scripts/fetch.js`: Fetches transactions via `eth_getTransactionByHash` and SQL API.
- `lib/sql-api.js`: HTTP client with auth, error classes, and fallback for missing entities.
- Edge-case handling: invalid hash rejection, nonexistent transaction, SQL API skip when unconfigured.
- `test/fetch.test.js` and `test/sql-api.test.js`: Tests with injected mocks.

## Phase 5: MCP AgentKit server — COMPLETED

- `scripts/mcp-agentkit-server.mjs`: Model Context Protocol server using Coinbase AgentKit.
- Dependencies: `@coinbase/agentkit`, `@coinbase/agentkit-model-context-protocol`, `@modelcontextprotocol/sdk`.

## Phase 6: Architecture documentation — IN PROGRESS

- `docs/architecture/README.md`: Navigation and project overview.
- `docs/architecture/DESIGN.md`: System design, boundaries, data flows, risks.
- `docs/architecture/implementation-plan.md`: This file — phased status tracker.

## Remaining follow-up work

- Final Node.js gate verification with evidence archival.
- Handoff summary with pass/fail status for all gates.
- No new feature work is planned in this follow-up iteration.
