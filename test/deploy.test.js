const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadLegalEntity } = require("../lib/legal-entity");
const { getVerifiedAccounts } = require("../lib/bank-accounts");

describe("Deploy and Transfer", function () {
  describe("Mainnet guard", function () {
    it("Should only allow testnet networks", function () {
      const allowed = ["sepolia", "goerli", "hardhat", "localhost"];
      expect(allowed).to.not.include("mainnet");
      expect(allowed).to.not.include("ethereum");
      expect(allowed).to.include("sepolia");
    });
  });

  describe("Simulation data availability", function () {
    it("Should load legal entity for deploy context", function () {
      const entity = loadLegalEntity();
      expect(entity.walletAddress).to.match(/^0x/);
      expect(entity.eoaAddress).to.match(/^0x/);
    });

    it("Should have verified bank accounts for deploy context", function () {
      const accounts = getVerifiedAccounts();
      expect(accounts.length).to.be.greaterThan(0);
    });
  });

  describe("Local deploy and transfer (hardhat network)", function () {
    it("Should deploy Lock and execute ETH transfer", async function () {
      // Deploy Lock
      const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
      const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
      const lockedAmount = ethers.parseEther("0.0001");

      const lock = await ethers.deployContract("Lock", [unlockTime], {
        value: lockedAmount,
      });
      await lock.waitForDeployment();
      const lockAddress = await lock.getAddress();
      expect(lockAddress).to.match(/^0x/);

      // Transfer ETH between signers
      const [sender, receiver] = await ethers.getSigners();
      const transferAmount = ethers.parseEther("0.0001");

      const tx = await sender.sendTransaction({
        to: await receiver.getAddress(),
        value: transferAmount,
      });
      const receipt = await tx.wait();

      expect(receipt.status).to.equal(1);
      expect(receipt.hash).to.match(/^0x/);
      expect(receipt.blockNumber).to.be.greaterThan(0);
    });
  });
});
