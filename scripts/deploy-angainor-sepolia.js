/**
 * deploy-angainor-sepolia.js
 *
 * One-time deployment of all Angainor contracts to Sepolia testnet.
 * Deploys: IdentityRegistry, DocumentRegistry, AngainorToken
 * Registers 5 eligible investors on IdentityRegistry.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-angainor-sepolia.js --network sepolia
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL (or TESTNET_RPC)
 *   INVESTOR_1_ADDRESS through INVESTOR_5_ADDRESS (for LP eligibility)
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Fund via faucet first.");
  }

  // 1. Deploy IdentityRegistry
  console.log("\n--- Deploying IdentityRegistry ---");
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  const irReceipt = await identityRegistry.deploymentTransaction().wait();
  console.log("IdentityRegistry deployed at:", identityRegistryAddress);
  console.log("  tx:", irReceipt.hash);
  console.log("  block:", irReceipt.blockNumber);

  // 2. Deploy DocumentRegistry
  console.log("\n--- Deploying DocumentRegistry ---");
  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const documentRegistry = await DocumentRegistry.deploy();
  await documentRegistry.waitForDeployment();
  const documentRegistryAddress = await documentRegistry.getAddress();
  const drReceipt = await documentRegistry.deploymentTransaction().wait();
  console.log("DocumentRegistry deployed at:", documentRegistryAddress);
  console.log("  tx:", drReceipt.hash);
  console.log("  block:", drReceipt.blockNumber);

  // 3. Deploy AngainorToken with IdentityRegistry reference
  console.log("\n--- Deploying AngainorToken ---");
  const AngainorToken = await hre.ethers.getContractFactory("AngainorToken");
  const angainorToken = await AngainorToken.deploy(
    "Angainor Demo Fund I Token",
    "KDRA",
    identityRegistryAddress
  );
  await angainorToken.waitForDeployment();
  const angainorTokenAddress = await angainorToken.getAddress();
  const ktReceipt = await angainorToken.deploymentTransaction().wait();
  console.log("AngainorToken deployed at:", angainorTokenAddress);
  console.log("  tx:", ktReceipt.hash);
  console.log("  block:", ktReceipt.blockNumber);

  // 4. Register eligible investors on IdentityRegistry
  console.log("\n--- Registering investors on IdentityRegistry ---");
  const investorAddresses = [];
  for (let i = 1; i <= 5; i++) {
    const addr = process.env[`INVESTOR_${i}_ADDRESS`];
    if (!addr) {
      console.warn(`INVESTOR_${i}_ADDRESS not set, skipping`);
      continue;
    }
    investorAddresses.push(addr);
    console.log(`Registering INVESTOR_${i}: ${addr}`);

    const addTx = await identityRegistry.addInvestor(addr);
    await addTx.wait();

    const eligTx = await identityRegistry.setEligibility(addr, true);
    await eligTx.wait();

    const isEligible = await identityRegistry.isEligibleLP(addr);
    console.log(`  Verified isEligibleLP: ${isEligible}`);
  }

  // 5. Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: 11155111,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      identityRegistry: {
        address: identityRegistryAddress,
        txHash: irReceipt.hash,
        blockNumber: irReceipt.blockNumber,
      },
      documentRegistry: {
        address: documentRegistryAddress,
        txHash: drReceipt.hash,
        blockNumber: drReceipt.blockNumber,
      },
      angainorToken: {
        address: angainorTokenAddress,
        txHash: ktReceipt.hash,
        blockNumber: ktReceipt.blockNumber,
      },
    },
    registeredInvestors: investorAddresses,
  };

  const evidenceDir = path.join(__dirname, "..", "EVIDENCE", "sepolia-deploy");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Print .env snippet
  console.log("\n\n========== ADD TO .env ==========\n");
  console.log(`CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`);
  console.log(`CHAIN_ID=11155111`);
  console.log(`IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
  console.log(`DOCUMENT_REGISTRY_ADDRESS=${documentRegistryAddress}`);
  console.log(`ANGAINOR_TOKEN_ADDRESS=${angainorTokenAddress}`);
  console.log(`ANGAINOR_TOKEN_DEPLOY_TX_HASH=${ktReceipt.hash}`);
  console.log(`\n========== DONE ==========\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
