const { expect } = require("chai");
const { ethers } = require("hardhat");
const { hashDocument } = require("../lib/document-hasher");
const subscriptionLedger = require("../lib/subscription-ledger");
const { validateSettlement } = require("../lib/settlement-validator");

describe("E2E Angainor Fund Lifecycle", function () {
  // Contracts
  let identityRegistry, angainorToken, documentRegistry;

  // Signers: [0]=deployer, [1-5]=investors, [6]=non-LP outsider
  let deployer, inv1, inv2, inv3, inv4, inv5, outsider;

  // LPA document hash (bytes32 for on-chain, hex string for off-chain)
  let lpaHashBytes32, lpaHexString;

  // Subscription records
  let subscriptions;

  const TOKENS_PER_INVESTOR = ethers.parseEther("2000");
  const CAPITAL_PER_INVESTOR = 500000;
  const FUND_NAME = "Angainor Fund I";

  before(async function () {
    [deployer, inv1, inv2, inv3, inv4, inv5, outsider] =
      await ethers.getSigners();

    // Reset off-chain state
    subscriptionLedger.resetLedger();
  });

  // ─── Step A: Deploy all 3 contracts ───────────────────────────────
  describe("A. Contract Deployment", function () {
    it("Should deploy IdentityRegistry", async function () {
      const Factory = await ethers.getContractFactory("IdentityRegistry");
      identityRegistry = await Factory.deploy();
      await identityRegistry.waitForDeployment();
      expect(await identityRegistry.getAddress()).to.be.properAddress;
    });

    it("Should deploy AngainorToken linked to the registry", async function () {
      const Factory = await ethers.getContractFactory("AngainorToken");
      angainorToken = await Factory.deploy(
        FUND_NAME,
        "ANGAINOR",
        await identityRegistry.getAddress()
      );
      await angainorToken.waitForDeployment();
      expect(await angainorToken.name()).to.equal(FUND_NAME);
      expect(await angainorToken.symbol()).to.equal("ANGAINOR");
    });

    it("Should deploy DocumentRegistry", async function () {
      const Factory = await ethers.getContractFactory("DocumentRegistry");
      documentRegistry = await Factory.deploy();
      await documentRegistry.waitForDeployment();
      expect(await documentRegistry.getAddress()).to.be.properAddress;
    });
  });

  // ─── Step B: Register 5 investors with LP eligibility ─────────────
  describe("B. Investor Registration", function () {
    it("Should register all 5 investors as eligible LPs", async function () {
      const investors = [inv1, inv2, inv3, inv4, inv5];

      for (const inv of investors) {
        await identityRegistry.addInvestor(inv.address);
        await identityRegistry.setEligibility(inv.address, true);
      }

      for (const inv of investors) {
        expect(await identityRegistry.isEligibleLP(inv.address)).to.be.true;
      }
    });

    it("Should confirm outsider is NOT an eligible LP", async function () {
      expect(await identityRegistry.isEligibleLP(outsider.address)).to.be.false;
    });
  });

  // ─── Step C: Hash LPA and register in DocumentRegistry ────────────
  describe("C. LPA Document Registration", function () {
    it("Should hash the LPA and register on-chain", async function () {
      const lpaContent = Buffer.from(
        "ANGAINOR FUND I — LIMITED PARTNERSHIP AGREEMENT — Effective Date: 2025-01-15"
      );
      const { hash } = hashDocument(lpaContent);
      lpaHexString = hash;

      // Convert the 0x-prefixed hex string into a bytes32 value
      lpaHashBytes32 = ethers.zeroPadValue(hash, 32);

      await documentRegistry.registerDocument(lpaHashBytes32, "LPA");
      expect(await documentRegistry.documentExists(lpaHashBytes32)).to.be.true;
    });

    it("Should verify the LPA document data on-chain", async function () {
      const [docHash, timestamp, docType, uploader, exists] =
        await documentRegistry.verifyDocument(lpaHashBytes32);

      expect(exists).to.be.true;
      expect(docType).to.equal("LPA");
      expect(uploader).to.equal(deployer.address);
      expect(timestamp).to.be.greaterThan(0);
    });
  });

  // ─── Step D: Create 5 subscription records off-chain ──────────────
  describe("D. Subscription Creation", function () {
    it("Should create 5 subscription records", function () {
      const investorData = [
        { id: "INV-001", name: "Alice Capital", wallet: inv1.address },
        { id: "INV-002", name: "Bob Ventures", wallet: inv2.address },
        { id: "INV-003", name: "Carol Partners", wallet: inv3.address },
        { id: "INV-004", name: "Dave Holdings", wallet: inv4.address },
        { id: "INV-005", name: "Eve Investments", wallet: inv5.address },
      ];

      subscriptions = investorData.map((inv) =>
        subscriptionLedger.createSubscription({
          investorId: inv.id,
          investorName: inv.name,
          walletAddress: inv.wallet,
          allocationPercent: 20,
          lpaHash: lpaHexString,
          fundName: FUND_NAME,
          capitalCommitted: CAPITAL_PER_INVESTOR,
        })
      );

      expect(subscriptions).to.have.lengthOf(5);
      for (const sub of subscriptions) {
        expect(sub.status).to.equal("pending");
      }
    });
  });

  // ─── Step E: Validate 5 wire confirmations (3-way match) ──────────
  describe("E. Settlement Validation", function () {
    it("Should validate all 5 wire confirmations", function () {
      for (const sub of subscriptions) {
        const result = validateSettlement({
          subscriptionId: sub.id,
          wireAmount: CAPITAL_PER_INVESTOR,
          wireInvestorId: sub.investorId,
          wireDocumentRef: lpaHexString,
          subscriptionLedger,
        });

        expect(result.valid).to.be.true;
        expect(result.errors).to.have.lengthOf(0);

        // Mark as settled
        subscriptionLedger.updateStatus(sub.id, "settled");
      }
    });
  });

  // ─── Step F: Mint tokens for each settled investor ────────────────
  describe("F. Token Minting", function () {
    it("Should mint 2000 tokens to each investor", async function () {
      const investors = [inv1, inv2, inv3, inv4, inv5];
      for (const inv of investors) {
        await angainorToken.mint(inv.address, TOKENS_PER_INVESTOR);
      }

      const expectedTotal = ethers.parseEther("10000");
      expect(await angainorToken.totalSupply()).to.equal(expectedTotal);
    });
  });

  // ─── Step G: Verify cap table — each investor = 20% ───────────────
  describe("G. Cap Table Verification", function () {
    it("Should show each investor holding exactly 20% (2000 tokens)", async function () {
      const investors = [inv1, inv2, inv3, inv4, inv5];
      const totalSupply = await angainorToken.totalSupply();

      for (const inv of investors) {
        const balance = await angainorToken.balanceOf(inv.address);
        expect(balance).to.equal(TOKENS_PER_INVESTOR);

        // Verify 20% ownership: balance * 100 / totalSupply == 20
        const pct = (balance * 100n) / totalSupply;
        expect(pct).to.equal(20n);
      }
    });
  });

  // ─── Step H: Legal LP-to-LP transfer ──────────────────────────────
  describe("H. LP-to-LP Token Transfer", function () {
    it("Should transfer 500 tokens from investor1 to investor2", async function () {
      const transferAmount = ethers.parseEther("500");

      await angainorToken.connect(inv1).transfer(inv2.address, transferAmount);

      expect(await angainorToken.balanceOf(inv1.address)).to.equal(
        ethers.parseEther("1500")
      );
      expect(await angainorToken.balanceOf(inv2.address)).to.equal(
        ethers.parseEther("2500")
      );
    });
  });

  // ─── Step I: Illegal transfer to non-LP ───────────────────────────
  describe("I. Illegal Transfer to Non-LP", function () {
    it("Should revert transfer from LP to non-LP outsider", async function () {
      await expect(
        angainorToken
          .connect(inv1)
          .transfer(outsider.address, ethers.parseEther("100"))
      ).to.be.revertedWith(
        "Transfer blocked: recipient is not an approved Limited Partner"
      );
    });

    it("Should revert transfer from non-LP outsider", async function () {
      // Give outsider tokens via mint (bypasses transfer check)
      await angainorToken.mint(outsider.address, ethers.parseEther("100"));

      await expect(
        angainorToken
          .connect(outsider)
          .transfer(inv1.address, ethers.parseEther("50"))
      ).to.be.revertedWith(
        "Transfer blocked: sender is not an approved Limited Partner"
      );
    });
  });

  // ─── Step J: Verify LPA hash in document registry ─────────────────
  describe("J. LPA Hash Verification", function () {
    it("Should confirm LPA hash exists in DocumentRegistry", async function () {
      expect(await documentRegistry.documentExists(lpaHashBytes32)).to.be.true;
    });

    it("Should confirm an unknown document does NOT exist", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake-doc"));
      expect(await documentRegistry.documentExists(fakeHash)).to.be.false;
    });
  });

  // ─── Step K: Verify all subscriptions settled ─────────────────────
  describe("K. Final Settlement Audit", function () {
    it("Should confirm all 5 subscriptions are settled", function () {
      for (const sub of subscriptions) {
        const record = subscriptionLedger.getSubscription(sub.id);
        expect(record.status).to.equal("settled");
        expect(record.settledAt).to.not.be.null;
      }
    });

    it("Should reject re-settlement (double settlement)", function () {
      const result = validateSettlement({
        subscriptionId: subscriptions[0].id,
        wireAmount: CAPITAL_PER_INVESTOR,
        wireInvestorId: subscriptions[0].investorId,
        wireDocumentRef: lpaHexString,
        subscriptionLedger,
      });
      expect(result.valid).to.be.false;
      expect(result.errors.some((e) => e.includes("no double settlement"))).to
        .be.true;
    });

    it("Should show final token distribution after all operations", async function () {
      // After step H: inv1=1500, inv2=2500, inv3=2000, inv4=2000, inv5=2000
      // After step I: outsider got 100 minted but cannot transfer
      expect(await angainorToken.balanceOf(inv1.address)).to.equal(
        ethers.parseEther("1500")
      );
      expect(await angainorToken.balanceOf(inv2.address)).to.equal(
        ethers.parseEther("2500")
      );
      expect(await angainorToken.balanceOf(inv3.address)).to.equal(
        ethers.parseEther("2000")
      );
      expect(await angainorToken.balanceOf(inv4.address)).to.equal(
        ethers.parseEther("2000")
      );
      expect(await angainorToken.balanceOf(inv5.address)).to.equal(
        ethers.parseEther("2000")
      );

      // Total supply = 10000 (from step F) + 100 (minted to outsider in step I)
      expect(await angainorToken.totalSupply()).to.equal(
        ethers.parseEther("10100")
      );
    });
  });
});
