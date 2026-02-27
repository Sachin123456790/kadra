# Design Document

## System overview

Markus is a Node.js/Hardhat project that:

1. **Deploys and interacts with Solidity contracts** on the Sepolia testnet via Hardhat.
2. **Integrates the Coinbase SDK** for off-chain wallet and account operations.
3. **Queries a SQL data API** for transaction history, with env-driven configuration.
4. **Exposes an MCP server** (`scripts/mcp-agentkit-server.mjs`) for AI-agent interaction through the Coinbase AgentKit.

All runtime behaviour is configured through environment variables validated at startup by `lib/validate-env.js`.

## Testnet-only constraints and secret handling

- **Mainnet guard**: `scripts/deploy.js` explicitly blocks execution on any network not in the allowlist (`sepolia`, `goerli`, `hardhat`, `localhost`).
- **Secret management**: Private keys (`DEPLOYER_PRIVATE_KEY`), API credentials (`COINBASE_API_KEY_NAME`, `COINBASE_API_KEY_SECRET`, `SQL_API_KEY`), and RPC URLs are loaded from `.env` via `dotenv`. No secrets are committed to the repository.
- **Validation**: `lib/validate-env.js` checks presence and format of required variables before any operation. Separate validation sets exist for deploy (`DEPLOY_ENV_VARS`), transfer (`TRANSFER_ENV_VARS`), and SQL API (`SQL_ENV_VARS`).

## Coinbase SDK and Hardhat interaction boundaries

| Layer | Responsibility | Module |
|---|---|---|
| **Smart contracts** | On-chain logic (Lock contract with time-locked withdrawals) | `contracts/Lock.sol` |
| **Hardhat scripts** | Contract deployment, ETH transfers, transaction fetching | `scripts/deploy.js`, `scripts/fetch.js` |
| **Coinbase SDK helper** | SDK client initialisation for Sepolia, credential validation | `lib/coinbase-sdk-helper.js` |
| **MCP AgentKit server** | Exposes Coinbase AgentKit actions over Model Context Protocol | `scripts/mcp-agentkit-server.mjs` |
| **Simulation data** | Legal entity and bank account fixtures for test scenarios | `lib/legal-entity.js`, `lib/bank-accounts.js`, `data/*.json` |

Hardhat provides the EVM runtime and Ethers.js provider. The Coinbase SDK operates independently for wallet-level actions. The two do not share state at runtime; they are connected through shared environment configuration and the deploy script's use of simulation data.

## SQL API data flow and fallback handling

```
scripts/fetch.js
  ├── eth_getTransactionByHash (via Hardhat provider)
  └── lib/sql-api.js → fetchTransactionHistory(entityId)
        ├── GET ${SQL_API_ENDPOINT}/v1/transactions?entityId=...
        ├── Auth: Bearer ${SQL_API_KEY}
        ├── Error handling:
        │     401/403 → auth failure (expired/invalid token)
        │     4xx     → client error with body
        │     5xx     → service unavailable
        └── Fallback: missing/invalid entityId → { transactions: [], fallback: true }
```

- The SQL API client (`lib/sql-api.js`) supports dependency injection for testing (`options.fetchFn`, `options.apiKey`, `options.endpoint`).
- When `SQL_API_KEY` or `SQL_API_ENDPOINT` are not set, the fetch script skips the SQL API call gracefully.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Accidental mainnet deployment | Network allowlist in `deploy.js`; `hardhat.config.js` only configures Sepolia |
| Secret leakage | All secrets via `.env`; `.gitignore` excludes `.env`; `validate-env.js` fails fast on missing vars |
| SQL API unavailability | Fallback response for missing entity; explicit error classes for auth and server errors |
| Testnet RPC instability | Local Hardhat network available for all tests; live testnet only needed for `deploy:sepolia` and `fetch:sepolia` |
| Stale simulation data | Fixture files under `data/` are validated at load time by `lib/legal-entity.js` and `lib/bank-accounts.js` |
| Test environment leakage | Tests use injected mocks (SQL API) and Hardhat's in-memory EVM; no external calls during `npm test` |
