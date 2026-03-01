const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { hashFile } = require("../lib/document-hasher");
const { createSubscription, getSubscription, getByFund, updateStatus, resetLedger } = require("../lib/subscription-ledger");
const { validateSettlement } = require("../lib/settlement-validator");
const { createFund, configureFundWaterfall } = require("../lib/fund-manager");
const { createAccount, getByFund: getAccountsByFund, updateForTransfer, resetAccounts } = require("../lib/capital-accounts");

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  // Load config
  const fundConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "fund-config.json"), "utf8"));
  const investorsData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "investors.json"), "utf8"));
  const wiresData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "wire-confirmations.json"), "utf8"));

  console.log("\n" + "=".repeat(60));
  console.log("  KADRA DEMO FUND I — Full System Deployment");
  console.log("=".repeat(60) + "\n");

  // Step 1: Deploy contracts
  console.log("STEP 1: Deploying smart contracts...");
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const registry = await IdentityRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`  IdentityRegistry: ${registryAddr}`);

  const DocumentReg = await hre.ethers.getContractFactory("DocumentRegistry");
  const docRegistry = await DocumentReg.deploy();
  await docRegistry.waitForDeployment();
  const docRegAddr = await docRegistry.getAddress();
  console.log(`  DocumentRegistry: ${docRegAddr}`);

  const KadraToken = await hre.ethers.getContractFactory("KadraToken");
  const token = await KadraToken.deploy(fundConfig.name, "KDRA", registryAddr);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`  KadraToken:       ${tokenAddr}`);
  console.log("");

  // Step 2: Create fund
  console.log("STEP 2: Creating fund entity...");
  createFund({ name: fundConfig.name, legalForm: fundConfig.legalForm, jurisdiction: fundConfig.jurisdiction, totalShares: fundConfig.totalShares });
  configureFundWaterfall(fundConfig.name, fundConfig.waterfall);
  console.log(`  Fund: ${fundConfig.name} (${fundConfig.legalForm}, ${fundConfig.jurisdiction})`);
  console.log(`  Waterfall: Pref ${fundConfig.waterfall.preferredReturn}%, IRR ${fundConfig.waterfall.irrHurdle}%, GP ${fundConfig.waterfall.gpPromote}%`);
  console.log(`  NOTE: Waterfall is display-only configuration. No on-chain distributions.`);
  console.log("");

  // Step 3: Register investors
  console.log("STEP 3: Registering investors in IdentityRegistry...");
  const investorSigners = {};
  for (const inv of investorsData.investors) {
    const signer = signers[inv.walletIndex];
    const addr = await signer.getAddress();
    investorSigners[inv.id] = { signer, address: addr, ...inv };
    await (await registry.addInvestor(addr)).wait();
    await (await registry.setEligibility(addr, true)).wait();
    const eligible = await registry.isEligibleLP(addr);
    console.log(`  ${inv.name} (${inv.id}): ${addr} — eligible: ${eligible}`);
  }
  console.log("");

  // Step 4: Hash and register LPA
  console.log("STEP 4: Hashing and anchoring Master LPA on-chain...");
  const lpaPath = path.join(__dirname, "..", "data", "sample-lpa.txt");
  const lpaHashResult = hashFile(lpaPath);
  console.log(`  LPA Hash: ${lpaHashResult.hash}`);
  console.log(`  Algorithm: ${lpaHashResult.algorithm}, Size: ${lpaHashResult.size} bytes`);
  await (await docRegistry.registerDocument(lpaHashResult.hash, "MASTER_LPA")).wait();
  const docExists = await docRegistry.documentExists(lpaHashResult.hash);
  console.log(`  Anchored on-chain: ${docExists}`);
  console.log("");

  // Step 5: Create subscriptions
  console.log("STEP 5: Creating subscription records (off-chain)...");
  resetLedger();
  const subscriptionMap = {};
  for (const inv of investorsData.investors) {
    const sub = createSubscription({
      investorId: inv.id,
      investorName: inv.name,
      walletAddress: investorSigners[inv.id].address,
      allocationPercent: fundConfig.allocationPerInvestor,
      lpaHash: lpaHashResult.hash,
      fundName: fundConfig.name,
      capitalCommitted: fundConfig.capitalPerInvestor,
    });
    subscriptionMap[inv.id] = sub;
    console.log(`  ${sub.id}: ${inv.name} — ${fundConfig.allocationPerInvestor}% ($${fundConfig.capitalPerInvestor}) — ${sub.status}`);
  }
  console.log("");

  // Step 6: Validate wire confirmations and settle
  console.log("STEP 6: Processing wire confirmations (off-chain settlement)...");
  console.log("  NOTE: Payments are settled OFF-CHAIN. Wire PDFs are parsed to confirm payment.");
  resetAccounts();
  const sharesPerInvestor = BigInt(fundConfig.sharesPerInvestor);
  const tokenDecimals = await token.decimals(); // 18
  const mintAmount = sharesPerInvestor * (10n ** BigInt(tokenDecimals));

  for (const wire of wiresData.wires) {
    const sub = subscriptionMap[wire.investorId];
    if (!sub) {
      console.log(`  SKIP: No subscription for ${wire.investorId}`);
      continue;
    }

    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: wire.amount,
      wireInvestorId: wire.investorId,
      wireDocumentRef: lpaHashResult.hash,
      subscriptionLedger: { getSubscription },
    });

    if (result.valid) {
      // Settle subscription
      updateStatus(sub.id, "settled");

      // Mint tokens
      const investorAddr = investorSigners[wire.investorId].address;
      await (await token.mint(investorAddr, mintAmount)).wait();

      // Create capital account
      createAccount({
        investorId: wire.investorId,
        fundName: fundConfig.name,
        initialContribution: Number(wire.amount),
        ownershipPercent: fundConfig.allocationPerInvestor,
      });

      console.log(`  ✓ ${wire.investorId}: Wire $${wire.amount} validated → settled → ${hre.ethers.formatUnits(mintAmount, tokenDecimals)} tokens minted`);
    } else {
      console.log(`  ✗ ${wire.investorId}: Settlement FAILED — ${result.errors.join(", ")}`);
    }
  }
  console.log("");

  // Step 7: Print cap table
  console.log("STEP 7: Cap Table (post-settlement)...");
  console.log("  " + "-".repeat(80));
  console.log(`  ${"Investor".padEnd(30)} ${"Wallet".padEnd(44)} ${"Tokens".padEnd(12)} ${"Ownership"}`);
  console.log("  " + "-".repeat(80));
  const totalSupply = await token.totalSupply();
  for (const inv of investorsData.investors) {
    const addr = investorSigners[inv.id].address;
    const balance = await token.balanceOf(addr);
    const pct = totalSupply > 0n ? Number((balance * 10000n) / totalSupply) / 100 : 0;
    console.log(`  ${inv.name.padEnd(30)} ${addr.padEnd(44)} ${hre.ethers.formatUnits(balance, tokenDecimals).padEnd(12)} ${pct}%`);
  }
  console.log("  " + "-".repeat(80));
  console.log(`  Total Supply: ${hre.ethers.formatUnits(totalSupply, tokenDecimals)} KDRA`);
  console.log("");

  // Step 8: Transfer enforcement
  console.log("STEP 8: Transfer enforcement tests...");

  // Legal transfer: investor-A → investor-B (500 tokens)
  const transferAmount = 500n * (10n ** BigInt(tokenDecimals));
  const signerA = investorSigners["investor-A"].signer;
  const addrB = investorSigners["investor-B"].address;

  console.log(`  Legal transfer: investor-A → investor-B (500 KDRA)...`);
  const tokenAsA = token.connect(signerA);
  await (await tokenAsA.transfer(addrB, transferAmount)).wait();
  console.log(`  ✓ Transfer succeeded`);

  // Update capital accounts
  updateForTransfer({ fromInvestorId: "investor-A", toInvestorId: "investor-B", fundName: fundConfig.name, transferPercent: 5 });

  // Illegal transfer: investor-A → non-LP address
  const nonLPAddr = signers[9] ? await signers[9].getAddress() : "0x000000000000000000000000000000000000dEaD";
  console.log(`  Illegal transfer: investor-A → non-LP (${nonLPAddr})...`);
  try {
    await tokenAsA.transfer(nonLPAddr, 100n * (10n ** BigInt(tokenDecimals)));
    console.log(`  ✗ ERROR: Transfer should have been blocked!`);
  } catch (err) {
    console.log(`  ✓ Transfer blocked: "${err.message.includes("recipient is not an approved") ? "recipient is not an approved Limited Partner" : err.message.substring(0, 80)}"`);
  }
  console.log("");

  // Step 9: Updated cap table
  console.log("STEP 9: Updated Cap Table (post-transfer)...");
  console.log("  " + "-".repeat(80));
  console.log(`  ${"Investor".padEnd(30)} ${"Wallet".padEnd(44)} ${"Tokens".padEnd(12)} ${"Ownership"}`);
  console.log("  " + "-".repeat(80));
  const newTotalSupply = await token.totalSupply();
  for (const inv of investorsData.investors) {
    const addr = investorSigners[inv.id].address;
    const balance = await token.balanceOf(addr);
    const pct = newTotalSupply > 0n ? Number((balance * 10000n) / newTotalSupply) / 100 : 0;
    console.log(`  ${inv.name.padEnd(30)} ${addr.padEnd(44)} ${hre.ethers.formatUnits(balance, tokenDecimals).padEnd(12)} ${pct}%`);
  }
  console.log("  " + "-".repeat(80));
  console.log("");

  // Save evidence
  const evidenceDir = path.join(__dirname, "..", "EVIDENCE", "kadra-deploy");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const addresses = {
    identityRegistry: registryAddr,
    documentRegistry: docRegAddr,
    kadraToken: tokenAddr,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(evidenceDir, "addresses.json"), JSON.stringify(addresses, null, 2));

  // Save subscriptions
  const subs = getByFund(fundConfig.name);
  fs.writeFileSync(path.join(evidenceDir, "subscriptions.json"), JSON.stringify(subs, null, 2));

  // Save capital accounts
  const caps = getAccountsByFund(fundConfig.name);
  fs.writeFileSync(path.join(evidenceDir, "capital-accounts.json"), JSON.stringify(caps, null, 2));

  console.log("Evidence saved to EVIDENCE/kadra-deploy/");
  console.log("\n" + "=".repeat(60));
  console.log("  KADRA DEPLOYMENT COMPLETE");
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
