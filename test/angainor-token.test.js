const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AngainorToken", function () {
  let registry, token, owner, investor1, investor2, investor3, investor4, investor5, outsider;

  beforeEach(async function () {
    [owner, investor1, investor2, investor3, investor4, investor5, outsider] =
      await ethers.getSigners();

    // Deploy IdentityRegistry
    const RegistryFactory = await ethers.getContractFactory("IdentityRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();

    // Deploy AngainorToken linked to registry
    const TokenFactory = await ethers.getContractFactory("AngainorToken");
    token = await TokenFactory.deploy(
      "Angainor Fund I",
      "ANGAINOR",
      await registry.getAddress()
    );
    await token.waitForDeployment();
  });

  async function registerLP(investor) {
    await registry.addInvestor(investor.address);
    await registry.setEligibility(investor.address, true);
  }

  it("Should deploy with correct name and symbol", async function () {
    expect(await token.name()).to.equal("Angainor Fund I");
    expect(await token.symbol()).to.equal("ANGAINOR");
  });

  it("Should allow owner to mint tokens to an LP", async function () {
    await registerLP(investor1);
    const amount = ethers.parseEther("2000");
    await token.mint(investor1.address, amount);
    expect(await token.balanceOf(investor1.address)).to.equal(amount);
  });

  it("Should allow owner to mint tokens to non-LP (mint bypasses transfer check)", async function () {
    // Minting goes from address(0) -> to, so the _update guard is skipped
    const amount = ethers.parseEther("1000");
    await token.mint(outsider.address, amount);
    expect(await token.balanceOf(outsider.address)).to.equal(amount);
  });

  it("Should revert when non-owner tries to mint", async function () {
    await registerLP(investor1);
    const amount = ethers.parseEther("1000");
    await expect(token.connect(investor1).mint(investor1.address, amount))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("Should allow transfer between two eligible LPs", async function () {
    await registerLP(investor1);
    await registerLP(investor2);

    const amount = ethers.parseEther("2000");
    await token.mint(investor1.address, amount);

    const transferAmount = ethers.parseEther("500");
    await token.connect(investor1).transfer(investor2.address, transferAmount);

    expect(await token.balanceOf(investor1.address)).to.equal(
      ethers.parseEther("1500")
    );
    expect(await token.balanceOf(investor2.address)).to.equal(transferAmount);
  });

  it("Should revert transfer FROM a non-LP sender", async function () {
    // outsider has tokens from mint (mint bypasses check) but is not an LP
    await registerLP(investor1);
    const amount = ethers.parseEther("1000");
    await token.mint(outsider.address, amount);

    await expect(
      token.connect(outsider).transfer(investor1.address, ethers.parseEther("100"))
    ).to.be.revertedWith(
      "Transfer blocked: sender is not an approved Limited Partner"
    );
  });

  it("Should revert transfer TO a non-LP recipient", async function () {
    await registerLP(investor1);
    const amount = ethers.parseEther("1000");
    await token.mint(investor1.address, amount);

    await expect(
      token.connect(investor1).transfer(outsider.address, ethers.parseEther("100"))
    ).to.be.revertedWith(
      "Transfer blocked: recipient is not an approved Limited Partner"
    );
  });

  it("Should track total supply after minting to 5 investors", async function () {
    const investors = [investor1, investor2, investor3, investor4, investor5];
    const perInvestor = ethers.parseEther("2000");

    for (const inv of investors) {
      await registerLP(inv);
      await token.mint(inv.address, perInvestor);
    }

    const expectedTotal = ethers.parseEther("10000");
    expect(await token.totalSupply()).to.equal(expectedTotal);

    for (const inv of investors) {
      expect(await token.balanceOf(inv.address)).to.equal(perInvestor);
    }
  });

  it("Should revert transfer when sender loses eligibility", async function () {
    await registerLP(investor1);
    await registerLP(investor2);
    await token.mint(investor1.address, ethers.parseEther("1000"));

    // Revoke investor1 eligibility
    await registry.setEligibility(investor1.address, false);

    await expect(
      token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"))
    ).to.be.revertedWith(
      "Transfer blocked: sender is not an approved Limited Partner"
    );
  });

  it("Should store the correct identityRegistry address", async function () {
    expect(await token.identityRegistry()).to.equal(await registry.getAddress());
  });
});
