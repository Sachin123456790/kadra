const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Fetches transaction history using eth_getTransactionByHash.
 * Handles edge cases: invalid hash, no history (null result).
 *
 * Usage:
 *   npx hardhat run scripts/fetch.js --network sepolia
 *   TX_HASH=0x... npx hardhat run scripts/fetch.js --network sepolia
 *   npx hardhat run scripts/fetch.js               # uses local hardhat + deploy evidence
 */

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function isValidTxHash(hash) {
  return typeof hash === "string" && TX_HASH_PATTERN.test(hash);
}

async function fetchTransaction(provider, txHash) {
  // Use the raw JSON-RPC method eth_getTransactionByHash
  const result = await provider.send("eth_getTransactionByHash", [txHash]);
  return result;
}

async function main() {
  const networkName = hre.network.name;
  console.log(`\n=== Transaction History Fetch (${networkName}) ===\n`);

  const provider = hre.ethers.provider;

  // ── Determine transaction hash ────────────────────────────
  let txHash = process.env.TX_HASH;

  // Fallback: read from deploy evidence
  if (!txHash) {
    const evidencePath = path.join(__dirname, "..", "EVIDENCE", "task3", "tx-hash.txt");
    if (fs.existsSync(evidencePath)) {
      txHash = fs.readFileSync(evidencePath, "utf8").trim();
      console.log(`Using TX hash from evidence: ${txHash}`);
    }
  }

  const evidenceDir = path.join(__dirname, "..", "EVIDENCE", "task4");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // ── Edge case 1: Invalid hash ─────────────────────────────
  console.log("\n--- Edge Case: Invalid Hash ---");
  const invalidHash = "0xINVALID_NOT_A_REAL_HASH";
  if (!isValidTxHash(invalidHash)) {
    const msg = `invalid hash rejected: "${invalidHash}" does not match expected format (0x + 64 hex chars)`;
    console.log(`  Result: ${msg}`);
    fs.writeFileSync(path.join(evidenceDir, "edge-case-invalid-hash.log"), msg + "\n");
  }

  // ── Edge case 2: Valid format but no history ──────────────
  console.log("\n--- Edge Case: No History (nonexistent tx) ---");
  const nonexistentHash = "0x" + "0".repeat(64);
  try {
    const noResult = await fetchTransaction(provider, nonexistentHash);
    if (noResult === null || noResult === undefined) {
      const msg = `no history found for hash ${nonexistentHash}: provider returned null`;
      console.log(`  Result: ${msg}`);
      fs.writeFileSync(path.join(evidenceDir, "edge-case-no-history.log"), msg + "\n");
    } else {
      console.log(`  Unexpected: got result for zero hash:`, JSON.stringify(noResult, null, 2));
    }
  } catch (err) {
    const msg = `error fetching nonexistent tx: ${err.message}`;
    console.log(`  Result: ${msg}`);
    fs.writeFileSync(path.join(evidenceDir, "edge-case-no-history.log"), msg + "\n");
  }

  // ── Main fetch: real transaction ──────────────────────────
  if (!txHash) {
    console.log("\n--- Main Fetch: SKIPPED ---");
    console.log("  No TX_HASH provided and no evidence file found.");
    console.log("  Run scripts/deploy.js first, or set TX_HASH env var.");
    fs.writeFileSync(
      path.join(evidenceDir, "fetch-output.log"),
      "SKIPPED: No TX_HASH available. Run deploy.js first.\n"
    );
  } else if (!isValidTxHash(txHash)) {
    console.log(`\n--- Main Fetch: INVALID HASH ---`);
    const msg = `Provided TX_HASH is invalid: "${txHash}"`;
    console.log(`  ${msg}`);
    fs.writeFileSync(path.join(evidenceDir, "fetch-output.log"), msg + "\n");
    process.exitCode = 1;
  } else {
    console.log(`\n--- Main Fetch: eth_getTransactionByHash ---`);
    console.log(`  Hash: ${txHash}`);

    try {
      const txData = await fetchTransaction(provider, txHash);

      if (txData === null || txData === undefined) {
        const msg = `no history found for hash ${txHash}: transaction not found on ${networkName}`;
        console.log(`  Result: ${msg}`);
        fs.writeFileSync(path.join(evidenceDir, "fetch-output.log"), msg + "\n");
      } else {
        // Validate response structure
        const requiredFields = ["hash", "from", "to", "blockNumber"];
        const missingFields = requiredFields.filter((f) => !(f in txData));

        if (missingFields.length > 0) {
          console.log(`  Warning: response missing fields: ${missingFields.join(", ")}`);
        }

        const output = {
          method: "eth_getTransactionByHash",
          network: networkName,
          fetchedAt: new Date().toISOString(),
          transaction: txData,
        };

        console.log(`  From:        ${txData.from}`);
        console.log(`  To:          ${txData.to}`);
        console.log(`  Block:       ${txData.blockNumber}`);
        console.log(`  Value:       ${txData.value}`);
        console.log(`  Gas:         ${txData.gas}`);

        fs.writeFileSync(
          path.join(evidenceDir, "fetch-output.log"),
          JSON.stringify(output, null, 2) + "\n"
        );
        console.log(`\n  Full output saved to EVIDENCE/task4/fetch-output.log`);
      }
    } catch (err) {
      const msg = `Error fetching transaction: ${err.message}`;
      console.error(`  ${msg}`);
      fs.writeFileSync(path.join(evidenceDir, "fetch-output.log"), msg + "\n");
      process.exitCode = 1;
    }
  }

  console.log("\n=== Fetch Complete ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
