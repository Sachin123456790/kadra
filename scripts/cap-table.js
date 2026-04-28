const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Read deployed addresses
  const addressesPath = path.join(__dirname, "..", "EVIDENCE", "angainor-deploy", "addresses.json");
  if (!fs.existsSync(addressesPath)) {
    console.error("No deployed addresses found. Run deploy-angainor.js first.");
    process.exitCode = 1;
    return;
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const investorsData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "investors.json"), "utf8"));
  const signers = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt("AngainorToken", addresses.angainorToken);
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  const decimals = await token.decimals();

  console.log(`\n  ${tokenName} (${tokenSymbol}) — Cap Table`);
  console.log("  " + "-".repeat(80));
  console.log(`  ${"Investor".padEnd(30)} ${"Tokens".padEnd(15)} ${"Ownership %"}`);
  console.log("  " + "-".repeat(80));

  for (const inv of investorsData.investors) {
    const addr = await signers[inv.walletIndex].getAddress();
    const balance = await token.balanceOf(addr);
    const pct = totalSupply > 0n ? Number((balance * 10000n) / totalSupply) / 100 : 0;
    console.log(`  ${inv.name.padEnd(30)} ${hre.ethers.formatUnits(balance, decimals).padEnd(15)} ${pct}%`);
  }

  console.log("  " + "-".repeat(80));
  console.log(`  Total Supply: ${hre.ethers.formatUnits(totalSupply, decimals)} ${tokenSymbol}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
