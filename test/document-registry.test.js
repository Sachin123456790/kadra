const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentRegistry", function () {
  let docRegistry, owner, nonOwner;
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("sample-document-content"));

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DocumentRegistry");
    docRegistry = await Factory.deploy();
    await docRegistry.waitForDeployment();
  });

  it("Should register a document", async function () {
    await docRegistry.registerDocument(sampleHash, "LPA");
    expect(await docRegistry.documentExists(sampleHash)).to.be.true;
  });

  it("Should return correct data from verifyDocument", async function () {
    await docRegistry.registerDocument(sampleHash, "LPA");
    const [docHash, timestamp, docType, uploader, exists] =
      await docRegistry.verifyDocument(sampleHash);

    expect(docHash).to.equal(sampleHash);
    expect(timestamp).to.be.greaterThan(0);
    expect(docType).to.equal("LPA");
    expect(uploader).to.equal(owner.address);
    expect(exists).to.be.true;
  });

  it("Should revert on duplicate registration", async function () {
    await docRegistry.registerDocument(sampleHash, "LPA");
    await expect(
      docRegistry.registerDocument(sampleHash, "LPA")
    ).to.be.revertedWith("Document already registered");
  });

  it("Should return false for documentExists on unregistered hash", async function () {
    const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
    expect(await docRegistry.documentExists(unknownHash)).to.be.false;
  });

  it("Should return empty data from verifyDocument for unregistered hash", async function () {
    const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
    const [docHash, timestamp, docType, uploader, exists] =
      await docRegistry.verifyDocument(unknownHash);

    expect(exists).to.be.false;
    expect(timestamp).to.equal(0);
    expect(docType).to.equal("");
  });

  it("Should revert when non-owner registers document", async function () {
    await expect(
      docRegistry.connect(nonOwner).registerDocument(sampleHash, "LPA")
    ).to.be.revertedWithCustomError(docRegistry, "OwnableUnauthorizedAccount");
  });

  it("Should emit DocumentRegistered event", async function () {
    await expect(docRegistry.registerDocument(sampleHash, "LPA"))
      .to.emit(docRegistry, "DocumentRegistered")
      .withArgs(sampleHash, "LPA", owner.address, (v) => v > 0n);
  });

  it("Should register multiple distinct documents", async function () {
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("second-doc"));
    const hash3 = ethers.keccak256(ethers.toUtf8Bytes("third-doc"));

    await docRegistry.registerDocument(sampleHash, "LPA");
    await docRegistry.registerDocument(hash2, "Subscription");
    await docRegistry.registerDocument(hash3, "SideLetters");

    expect(await docRegistry.documentExists(sampleHash)).to.be.true;
    expect(await docRegistry.documentExists(hash2)).to.be.true;
    expect(await docRegistry.documentExists(hash3)).to.be.true;
  });
});
