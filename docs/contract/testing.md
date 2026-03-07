# Contract Testing Guide

The Kadra project includes 123 tests across 11 test files. All tests run on the local Hardhat EVM -- no external network connections, API keys, or services are required.

## Running Tests

```bash
npm test
```

This executes `npx hardhat test`, which compiles all contracts and runs the full test suite against an in-process Hardhat Network instance.

## Test Files

| File | Tests | Scope |
|---|---|---|
| `test/e2e-kadra.test.js` | Full lifecycle | End-to-end: deploy, register, settle, mint, transfer |
| `test/identity-registry.test.js` | Unit | IdentityRegistry contract functions and access control |
| `test/kadra-token.test.js` | Unit | KadraToken minting, transfers, and transfer restrictions |
| `test/document-registry.test.js` | Unit | DocumentRegistry registration, verification, duplicates |
| `test/settlement-validator.test.js` | Unit | 3-way match validation logic (off-chain) |
| `test/document-hasher.test.js` | Unit | SHA-256 hashing functions (off-chain) |
| `test/Lock.js` | Unit | Lock contract deployment, withdrawal, events |
| `test/config.test.js` | Unit | Hardhat configuration validation |
| `test/deploy.test.js` | Unit | Deploy script logic and mainnet guard |
| `test/fetch.test.js` | Unit | Transaction fetch script logic |
| `test/sql-api.test.js` | Unit | SQL Data API client edge cases |

## Hardhat Signers Convention

Tests use Hardhat's auto-generated signers (derived from the default mnemonic). The convention across all test files is:

| Signer Index | Role |
|---|---|
| `[0]` | Deployer / contract owner |
| `[1]` | Investor A |
| `[2]` | Investor B |
| `[3]` | Investor C |
| `[4]` | Investor D |
| `[5]` | Investor E |
| `[6]+` | Non-LP outsiders (used to test transfer rejection) |

Example from test setup:

```javascript
const signers = await hre.ethers.getSigners();
const deployer = signers[0];
const investorA = signers[1];
const outsider = signers[6];
```

## Key Test Scenarios

### End-to-End Lifecycle (`e2e-kadra.test.js`)

This is the most comprehensive test file. It mirrors the 9-step deployment script and validates the full lifecycle:

1. Deploy IdentityRegistry, DocumentRegistry, and KadraToken contracts
2. Register 5 investors with verified identity and LP eligibility
3. Hash the sample LPA document and anchor it on-chain
4. Create subscription records (off-chain)
5. Validate wire confirmations via 3-way match (off-chain)
6. Settle subscriptions and mint tokens to investor wallets
7. Verify cap table: each investor holds 2,000 KDRA (20%)
8. Execute legal LP-to-LP transfer and verify cap table update
9. Attempt illegal transfer to non-LP address and verify revert

### Identity Registry Tests (`identity-registry.test.js`)

- Adding and removing investors
- Setting eligibility flags
- `isEligibleLP()` returns `true` only when both `isVerified` and `isEligible` are `true`
- Access control: non-owner calls revert
- Removing an investor clears both `isVerified` and `isEligible`

### KadraToken Tests (`kadra-token.test.js`)

- Token deployment with correct name, symbol, and IdentityRegistry linkage
- Owner can mint tokens
- Non-owner cannot mint tokens
- Transfer between two eligible LPs succeeds
- Transfer to non-eligible address reverts with `"Transfer blocked: recipient is not an approved Limited Partner"`
- Transfer from non-eligible address reverts with `"Transfer blocked: sender is not an approved Limited Partner"`

### DocumentRegistry Tests (`document-registry.test.js`)

- Registering a document hash emits `DocumentRegistered` event
- `documentExists()` returns `true` after registration
- `verifyDocument()` returns correct hash, timestamp, docType, and uploader
- Duplicate registration reverts with `"Document already registered"`
- Unregistered hash returns `exists == false`

### Settlement Validator Tests (`settlement-validator.test.js`)

- Valid 3-way match: investor ID, wire amount, and document reference all match
- Mismatched investor ID fails validation
- Mismatched amount fails validation
- Mismatched document reference fails validation
- Already-settled subscription fails validation

### Document Hasher Tests (`document-hasher.test.js`)

- `hashDocument()` produces consistent SHA-256 hashes for the same input
- `hashFile()` reads a file and returns `{ hash, algorithm, size }`
- Different inputs produce different hashes

## Test Environment

- **Network**: Hardhat Network (in-process, chain ID 31337)
- **Framework**: Mocha (via `@nomicfoundation/hardhat-toolbox`)
- **Assertions**: Chai with `@nomicfoundation/hardhat-chai-matchers`
- **Gas reporting**: Available via `hardhat-gas-reporter` (included in toolbox)
- **No external dependencies**: All tests are deterministic and self-contained

## Troubleshooting

**Compilation errors**: Run `npm run compile` separately to isolate Solidity compilation issues from test failures.

**Stale artifacts**: If tests fail after contract changes, delete the `artifacts/` and `cache/` directories and recompile:

```bash
rm -rf artifacts cache && npm run compile
```

**Port conflicts**: Tests use the in-process Hardhat Network, not a standalone node. No ports are required.
