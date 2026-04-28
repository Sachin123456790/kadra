const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const irAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
  if (!irAddress) throw new Error("IDENTITY_REGISTRY_ADDRESS env var required");

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address, "balance:", hre.ethers.formatEther(balance), "ETH");

  console.log("Deploying AngainorToken pointing to IR:", irAddress);
  const AngainorToken = await hre.ethers.getContractFactory("AngainorToken");
  const token = await AngainorToken.deploy("Angainor Demo Fund I Token", "ANGN", irAddress);
  await token.waitForDeployment();
  const addr = await token.getAddress();
  const receipt = await token.deploymentTransaction().wait();
  console.log("AngainorToken deployed at:", addr);
  console.log("  tx:", receipt.hash);
  console.log("  block:", receipt.blockNumber);
}
main().catch((e) => { console.error(e); process.exit(1); });
