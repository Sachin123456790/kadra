const { ethers } = require('hardhat');

async function main() {
  const FundTermsRegistry = await ethers.getContractFactory('FundTermsRegistry');
  console.log('Deploying FundTermsRegistry to Sepolia...');
  const registry = await FundTermsRegistry.deploy();
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log('FundTermsRegistry deployed to:', addr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
