const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityRegistry", function () {
  let registry, owner, investor1, investor2, nonOwner;

  beforeEach(async function () {
    [owner, investor1, investor2, nonOwner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IdentityRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  it("Should add investor and set verified", async function () {
    await registry.addInvestor(investor1.address);
    expect(await registry.isVerified(investor1.address)).to.be.true;
  });

  it("Should remove investor", async function () {
    await registry.addInvestor(investor1.address);
    await registry.removeInvestor(investor1.address);
    expect(await registry.isVerified(investor1.address)).to.be.false;
    expect(await registry.isEligible(investor1.address)).to.be.false;
  });

  it("Should set eligibility", async function () {
    await registry.addInvestor(investor1.address);
    await registry.setEligibility(investor1.address, true);
    expect(await registry.isEligible(investor1.address)).to.be.true;
  });

  it("Should return true for isEligibleLP only when both verified and eligible", async function () {
    expect(await registry.isEligibleLP(investor1.address)).to.be.false;
    await registry.addInvestor(investor1.address);
    expect(await registry.isEligibleLP(investor1.address)).to.be.false; // verified but not eligible
    await registry.setEligibility(investor1.address, true);
    expect(await registry.isEligibleLP(investor1.address)).to.be.true;
  });

  it("Should revert when non-owner adds investor", async function () {
    await expect(registry.connect(nonOwner).addInvestor(investor1.address))
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("Should revert when non-owner removes investor", async function () {
    await registry.addInvestor(investor1.address);
    await expect(registry.connect(nonOwner).removeInvestor(investor1.address))
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("Should revert when non-owner sets eligibility", async function () {
    await expect(registry.connect(nonOwner).setEligibility(investor1.address, true))
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("Should emit InvestorAdded event", async function () {
    await expect(registry.addInvestor(investor1.address))
      .to.emit(registry, "InvestorAdded")
      .withArgs(investor1.address);
  });

  it("Should emit InvestorRemoved event", async function () {
    await registry.addInvestor(investor1.address);
    await expect(registry.removeInvestor(investor1.address))
      .to.emit(registry, "InvestorRemoved")
      .withArgs(investor1.address);
  });

  it("Should emit EligibilityChanged event", async function () {
    await expect(registry.setEligibility(investor1.address, true))
      .to.emit(registry, "EligibilityChanged")
      .withArgs(investor1.address, true);
  });

  it("Should handle multiple investors independently", async function () {
    await registry.addInvestor(investor1.address);
    await registry.addInvestor(investor2.address);
    await registry.setEligibility(investor1.address, true);

    expect(await registry.isEligibleLP(investor1.address)).to.be.true;
    expect(await registry.isEligibleLP(investor2.address)).to.be.false;
  });

  it("Should toggle eligibility off after being set on", async function () {
    await registry.addInvestor(investor1.address);
    await registry.setEligibility(investor1.address, true);
    expect(await registry.isEligibleLP(investor1.address)).to.be.true;

    await registry.setEligibility(investor1.address, false);
    expect(await registry.isEligibleLP(investor1.address)).to.be.false;
  });
});
