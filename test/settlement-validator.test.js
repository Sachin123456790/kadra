const { expect } = require("chai");
const { validateSettlement } = require("../lib/settlement-validator");
const subscriptionLedger = require("../lib/subscription-ledger");

describe("SettlementValidator", function () {
  const LPA_HASH = "0xabc123";
  let sub;

  beforeEach(function () {
    subscriptionLedger.resetLedger();
    sub = subscriptionLedger.createSubscription({
      investorId: "INV-001",
      investorName: "Alice Fund LP",
      walletAddress: "0x1111111111111111111111111111111111111111",
      allocationPercent: 20,
      lpaHash: LPA_HASH,
      fundName: "Angainor Fund I",
      capitalCommitted: 500000,
    });
  });

  it("Should validate a correct 3-way match", function () {
    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: 500000,
      wireInvestorId: "INV-001",
      wireDocumentRef: LPA_HASH,
      subscriptionLedger,
    });

    expect(result.valid).to.be.true;
    expect(result.errors).to.have.lengthOf(0);
    expect(result.subscription).to.not.be.null;
    expect(result.subscription.id).to.equal(sub.id);
  });

  it("Should reject investor mismatch", function () {
    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: 500000,
      wireInvestorId: "INV-999",
      wireDocumentRef: LPA_HASH,
      subscriptionLedger,
    });

    expect(result.valid).to.be.false;
    expect(result.errors.length).to.be.greaterThan(0);
    expect(result.errors[0]).to.include("Investor mismatch");
  });

  it("Should reject amount mismatch", function () {
    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: 999999,
      wireInvestorId: "INV-001",
      wireDocumentRef: LPA_HASH,
      subscriptionLedger,
    });

    expect(result.valid).to.be.false;
    expect(result.errors.some((e) => e.includes("Amount mismatch"))).to.be.true;
  });

  it("Should reject document reference mismatch", function () {
    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: 500000,
      wireInvestorId: "INV-001",
      wireDocumentRef: "0xwronghash",
      subscriptionLedger,
    });

    expect(result.valid).to.be.false;
    expect(result.errors.some((e) => e.includes("Document reference mismatch"))).to.be
      .true;
  });

  it("Should reject double settlement", function () {
    // First settlement is valid, mark as settled
    subscriptionLedger.updateStatus(sub.id, "settled");

    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: 500000,
      wireInvestorId: "INV-001",
      wireDocumentRef: LPA_HASH,
      subscriptionLedger,
    });

    expect(result.valid).to.be.false;
    expect(result.errors.some((e) => e.includes("no double settlement"))).to.be.true;
  });

  it("Should return subscription not found for invalid ID", function () {
    const result = validateSettlement({
      subscriptionId: "sub-999",
      wireAmount: 500000,
      wireInvestorId: "INV-001",
      wireDocumentRef: LPA_HASH,
      subscriptionLedger,
    });

    expect(result.valid).to.be.false;
    expect(result.errors).to.include("Subscription not found");
    expect(result.subscription).to.be.null;
  });

  it("Should accumulate multiple errors at once", function () {
    const result = validateSettlement({
      subscriptionId: sub.id,
      wireAmount: 999999,
      wireInvestorId: "INV-WRONG",
      wireDocumentRef: "0xbad",
      subscriptionLedger,
    });

    expect(result.valid).to.be.false;
    expect(result.errors.length).to.equal(3);
  });
});
