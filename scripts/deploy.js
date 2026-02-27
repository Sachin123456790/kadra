const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { validateEnv, TRANSFER_ENV_VARS } = require("../lib/validate-env");
const { loadLegalEntity } = require("../lib/legal-entity");
const { getVerifiedAccounts } = require("../lib/bank-accounts");

// Allowed networks — mainnet is explicitly blocked
const ALLOWED_NETWORKS = ["sepolia", "goerli", "hardhat", "localhost"];

async function main() {
  const networkName = hre.network.name;

  // ── Mainnet guard ─────────────────────────────────────────
  if (!ALLOWED_NETWORKS.includes(networkName)) {
    console.error(`BLOCKED: Network "${networkName}" is not allowed. Only testnet networks are permitted.`);
    console.error(`Allowed networks: ${ALLOWED_NETWORKS.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n=== Deploy & Transfer on ${networkName} ===\n`);

  // ── Validate env (skip for local hardhat) ─────────────────
  const isLiveTestnet = !["hardhat", "localhost"].includes(networkName);
  if (isLiveTestnet) {
    validateEnv(TRANSFER_ENV_VARS);
  }

  // ── Load simulation data ──────────────────────────────────
  const entity = loadLegalEntity();
  console.log("Legal entity:", entity.name, `(${entity.taxId})`);

  const bankAccounts = getVerifiedAccounts();
  console.log(`Verified bank accounts: ${bankAccounts.length}`);

  // ── Deploy Lock contract ──────────────────────────────────
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
  const lockedAmount = hre.ethers.parseEther("0.0001");

  console.log(`\nDeploying Lock contract (unlockTime: ${unlockTime})...`);
  const lock = await hre.ethers.deployContract("Lock", [unlockTime], {
    value: lockedAmount,
  });
  await lock.waitForDeployment();
  const lockAddress = await lock.getAddress();
  console.log(`Lock deployed at: ${lockAddress}`);

  // ── Execute ETH transfer ──────────────────────────────────
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  // Determine target: use env var on live testnet, or second signer on local
  let targetAddress;
  if (isLiveTestnet) {
    targetAddress = process.env.TRANSFER_TARGET_ADDRESS;
  } else {
    const signers = await hre.ethers.getSigners();
    targetAddress = await signers[1].getAddress();
  }

  const transferAmount = hre.ethers.parseEther("0.0001");
  console.log(`\nTransferring ${hre.ethers.formatEther(transferAmount)} ETH`);
  console.log(`  From: ${signerAddress} (entity EOA: ${entity.eoaAddress})`);
  console.log(`  To:   ${targetAddress}`);

  const tx = await signer.sendTransaction({
    to: targetAddress,
    value: transferAmount,
  });

  console.log(`  TX Hash: ${tx.hash}`);
  console.log("  Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`  Block:  ${receipt.blockNumber}`);
  console.log(`  Gas:    ${receipt.gasUsed.toString()}`);
  console.log(`  Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);

  // ── Save evidence ─────────────────────────────────────────
  const evidenceDir = path.join(__dirname, "..", "EVIDENCE", "task3");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  fs.writeFileSync(path.join(evidenceDir, "tx-hash.txt"), tx.hash);

  const receiptJson = {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to,
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status,
    network: networkName,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(evidenceDir, "tx-receipt.json"),
    JSON.stringify(receiptJson, null, 2)
  );

  console.log(`\nEvidence saved to EVIDENCE/task3/`);
  console.log("=== Deploy & Transfer Complete ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
