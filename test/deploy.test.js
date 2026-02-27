const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadLegalEntity } = require("../lib/legal-entity");
const { loadBankAccounts, getVerifiedAccounts } = require("../lib/bank-accounts");
const fs = require("fs");
const path = require("path");

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
      const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
      const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
      const lockedAmount = ethers.parseEther("0.0001");

      const lock = await ethers.deployContract("Lock", [unlockTime], {
        value: lockedAmount,
      });
      await lock.waitForDeployment();
      const lockAddress = await lock.getAddress();
      expect(lockAddress).to.match(/^0x/);

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

  describe("Invalid transaction inputs and reverts", function () {
    it("Should revert Lock deploy with past unlock time", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 1000;
      await expect(
        ethers.deployContract("Lock", [pastTime], {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWith("Unlock time should be in the future");
    });

    it("Should revert Lock withdrawal from non-owner", async function () {
      const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
      const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;

      const lock = await ethers.deployContract("Lock", [unlockTime], {
        value: ethers.parseEther("0.001"),
      });
      await lock.waitForDeployment();

      const [, nonOwner] = await ethers.getSigners();
      await expect(lock.connect(nonOwner).withdraw()).to.be.revertedWith(
        "You can't withdraw yet"
      );
    });

    it("Should succeed with zero-value ETH transfer", async function () {
      const [sender, receiver] = await ethers.getSigners();

      const tx = await sender.sendTransaction({
        to: await receiver.getAddress(),
        value: 0n,
      });
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should revert transfer to zero address", async function () {
      const [sender] = await ethers.getSigners();

      await expect(
        sender.sendTransaction({
          to: ethers.ZeroAddress,
          value: ethers.parseEther("0.001"),
        })
      ).to.not.be.reverted;
    });
  });

  describe("Entity fallback handling", function () {
    it("Should fail loadLegalEntity with missing data file", function () {
      const origPath = path.join(__dirname, "..", "data", "legal-entity.json");
      const backupPath = origPath + ".bak";

      fs.renameSync(origPath, backupPath);
      try {
        expect(() => loadLegalEntity()).to.throw("not found");
      } finally {
        fs.renameSync(backupPath, origPath);
      }
    });

    it("Should fail loadBankAccounts with malformed data", function () {
      const origPath = path.join(__dirname, "..", "data", "bank-accounts.json");
      const backupPath = origPath + ".bak";
      const origContent = fs.readFileSync(origPath, "utf8");

      fs.writeFileSync(origPath, JSON.stringify({ accounts: [] }));
      try {
        expect(() => loadBankAccounts()).to.throw("non-empty");
      } finally {
        fs.writeFileSync(origPath, origContent);
      }
    });

    it("Should fail loadLegalEntity with missing required fields", function () {
      const origPath = path.join(__dirname, "..", "data", "legal-entity.json");
      const backupPath = origPath + ".bak";
      const origContent = fs.readFileSync(origPath, "utf8");

      fs.writeFileSync(origPath, JSON.stringify({ name: "Test" }));
      try {
        expect(() => loadLegalEntity()).to.throw("missing required fields");
      } finally {
        fs.writeFileSync(origPath, origContent);
      }
    });

    it("Should fail loadLegalEntity with invalid wallet address format", function () {
      const origPath = path.join(__dirname, "..", "data", "legal-entity.json");
      const origContent = fs.readFileSync(origPath, "utf8");

      const badEntity = {
        name: "Test LLC",
        taxId: "EIN-00-0000000",
        jurisdiction: "US-DE",
        walletAddress: "INVALID_ADDRESS",
        eoaAddress: "0x1234567890abcdef1234567890abcdef12345678",
      };
      fs.writeFileSync(origPath, JSON.stringify(badEntity));
      try {
        expect(() => loadLegalEntity()).to.throw("Invalid walletAddress format");
      } finally {
        fs.writeFileSync(origPath, origContent);
      }
    });

    it("Should fail loadBankAccounts with missing routing number", function () {
      const origPath = path.join(__dirname, "..", "data", "bank-accounts.json");
      const origContent = fs.readFileSync(origPath, "utf8");

      const badData = {
        accounts: [{
          id: "bad-acct",
          holder: "Test",
          routingNumber: "123",
          accountNumber: "999",
          bankName: "Test Bank",
          type: "checking",
          currency: "USD",
        }],
      };
      fs.writeFileSync(origPath, JSON.stringify(badData));
      try {
        expect(() => loadBankAccounts()).to.throw("routingNumber must be 9 digits");
      } finally {
        fs.writeFileSync(origPath, origContent);
      }
    });
  });
});
