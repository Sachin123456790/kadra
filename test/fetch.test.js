const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Transaction History Fetch", function () {
  describe("Hash validation", function () {
    const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

    it("Should accept valid transaction hash", function () {
      const valid = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      expect(TX_HASH_PATTERN.test(valid)).to.be.true;
    });

    it("Should reject invalid transaction hash", function () {
      expect(TX_HASH_PATTERN.test("0xINVALID")).to.be.false;
      expect(TX_HASH_PATTERN.test("not-a-hash")).to.be.false;
      expect(TX_HASH_PATTERN.test("")).to.be.false;
      expect(TX_HASH_PATTERN.test("0x" + "g".repeat(64))).to.be.false;
    });

    it("Should reject hash with wrong length", function () {
      // Too short (32 hex chars instead of 64)
      expect(TX_HASH_PATTERN.test("0x" + "a".repeat(32))).to.be.false;
      // Too long (128 hex chars)
      expect(TX_HASH_PATTERN.test("0x" + "a".repeat(128))).to.be.false;
      // Missing 0x prefix
      expect(TX_HASH_PATTERN.test("a".repeat(64))).to.be.false;
    });
  });

  describe("eth_getTransactionByHash", function () {
    it("Should return null for nonexistent transaction", async function () {
      const provider = ethers.provider;
      const fakeHash = "0x" + "0".repeat(64);
      const result = await provider.send("eth_getTransactionByHash", [fakeHash]);
      expect(result).to.be.null;
    });

    it("Should return transaction data for real transaction", async function () {
      // Create a real transaction on local hardhat
      const [sender, receiver] = await ethers.getSigners();
      const tx = await sender.sendTransaction({
        to: await receiver.getAddress(),
        value: ethers.parseEther("0.001"),
      });
      await tx.wait();

      // Fetch via RPC method
      const result = await ethers.provider.send("eth_getTransactionByHash", [tx.hash]);
      expect(result).to.not.be.null;
      expect(result).to.have.property("hash", tx.hash);
      expect(result).to.have.property("from");
      expect(result).to.have.property("to");
      expect(result).to.have.property("blockNumber");
      expect(result).to.have.property("value");
    });
  });

  describe("Response validation", function () {
    it("Should validate required fields in transaction response", async function () {
      const [sender, receiver] = await ethers.getSigners();
      const tx = await sender.sendTransaction({
        to: await receiver.getAddress(),
        value: ethers.parseEther("0.001"),
      });
      await tx.wait();

      const result = await ethers.provider.send("eth_getTransactionByHash", [tx.hash]);

      const requiredFields = ["hash", "from", "to", "blockNumber"];
      for (const field of requiredFields) {
        expect(result, `Missing field: ${field}`).to.have.property(field);
      }
    });
  });
});
