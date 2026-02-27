# Task 2: Resolution Notes

## Dependency alignment

| Dependency | Status | Action |
|---|---|---|
| `@coinbase/coinbase-sdk` | Already in committed package.json | None |
| `@coinbase/agentkit` | In working tree, not yet committed | Stage and commit |
| `@coinbase/agentkit-model-context-protocol` | In working tree, not yet committed | Stage and commit |
| `@modelcontextprotocol/sdk` | In working tree, not yet committed | Stage and commit |
| `dotenv` | Already present | None |
| `hardhat` (devDep) | Already present | None |
| `@nomicfoundation/hardhat-toolbox` (devDep) | Already present | None |
| `pg` (PostgreSQL) | NOT needed — SQL API uses HTTP, not direct DB | None |

## Environment variable alignment

| Var | .env.example | validate-env.js | Runtime code | Status |
|---|---|---|---|---|
| `SEPOLIA_RPC_URL` | Line 4 | DEPLOY_ENV_VARS | hardhat.config.js:12 | ALIGNED |
| `TESTNET_RPC` | Line 5 (alias) | Not validated (alias only) | Not used in code | ALIAS ONLY |
| `DEPLOYER_PRIVATE_KEY` | Line 9 | DEPLOY_ENV_VARS | hardhat.config.js:13 | ALIGNED |
| `SQL_API_KEY` | Line 38 | SQL_ENV_VARS | scripts/fetch.js:141 | ALIGNED |
| `SQL_API_ENDPOINT` | Line 40 | SQL_ENV_VARS | scripts/fetch.js:141 | ALIGNED |
| `TRANSFER_TARGET_ADDRESS` | Line 12 | TRANSFER_ENV_VARS | scripts/deploy.js | ALIGNED |

## Hardhat config alignment
- Targets sepolia (chainId 11155111) — no mainnet network configured.
- Uses `SEPOLIA_RPC_URL` from env — consistent with validate-env.js.

## Mismatches resolved
1. **Added Coinbase AgentKit deps** — `@coinbase/agentkit`, `@coinbase/agentkit-model-context-protocol`, `@modelcontextprotocol/sdk` were in working tree from prior MCP server setup; now committed as part of this task.
2. **Added `mcp:server` script** — Script entry for `scripts/mcp-agentkit-server.mjs` was in working tree; committed.
3. **No changes needed** to `.env.example`, `hardhat.config.js`, or `lib/validate-env.js` — they were already aligned.
