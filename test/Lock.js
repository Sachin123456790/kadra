const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lock", function () {
  it("Should set the right unlockTime", async function () {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
    const lockedAmount = ethers.parseEther("0.001");

    const lock = await ethers.deployContract("Lock", [unlockTime], {
      value: lockedAmount,
    });

    expect(await lock.unlockTime()).to.equal(unlockTime);
  });

  it("Should set the right owner", async function () {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
    const lockedAmount = ethers.parseEther("0.001");

    const [owner] = await ethers.getSigners();
    const lock = await ethers.deployContract("Lock", [unlockTime], {
      value: lockedAmount,
    });

    expect(await lock.owner()).to.equal(owner.address);
  });

  it("Should revert with the right error if called too soon", async function () {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
    const lockedAmount = ethers.parseEther("0.001");

    const lock = await ethers.deployContract("Lock", [unlockTime], {
      value: lockedAmount,
    });

    await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
  });
});
