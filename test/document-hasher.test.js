const { expect } = require("chai");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { hashDocument, hashFile } = require("../lib/document-hasher");

describe("DocumentHasher", function () {
  it("Should produce a deterministic hash for the same content", function () {
    const content = Buffer.from("Kadra Fund I - Limited Partnership Agreement");
    const result1 = hashDocument(content);
    const result2 = hashDocument(content);

    expect(result1.hash).to.equal(result2.hash);
    expect(result1.algorithm).to.equal("sha256");
    expect(result1.size).to.equal(content.length);
  });

  it("Should produce the same hash for identical content", function () {
    const a = Buffer.from("identical content");
    const b = Buffer.from("identical content");
    expect(hashDocument(a).hash).to.equal(hashDocument(b).hash);
  });

  it("Should produce different hashes for different content", function () {
    const a = Buffer.from("document version 1");
    const b = Buffer.from("document version 2");
    expect(hashDocument(a).hash).to.not.equal(hashDocument(b).hash);
  });

  it("Should return a hex hash prefixed with 0x", function () {
    const result = hashDocument(Buffer.from("test"));
    expect(result.hash).to.match(/^0x[0-9a-f]{64}$/);
  });

  it("Should return algorithm as sha256", function () {
    const result = hashDocument(Buffer.from("test"));
    expect(result.algorithm).to.equal("sha256");
  });

  it("Should return correct buffer size", function () {
    const content = Buffer.from("hello world");
    const result = hashDocument(content);
    expect(result.size).to.equal(11);
  });

  it("Should hash an empty buffer", function () {
    const result = hashDocument(Buffer.alloc(0));
    expect(result.hash).to.match(/^0x[0-9a-f]{64}$/);
    expect(result.size).to.equal(0);
  });

  describe("hashFile", function () {
    let tmpFile;

    beforeEach(function () {
      tmpFile = path.join(os.tmpdir(), "kadra-test-doc-" + Date.now() + ".txt");
      fs.writeFileSync(tmpFile, "Kadra LPA content for hashing test");
    });

    afterEach(function () {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    });

    it("Should hash a file from disk", function () {
      const result = hashFile(tmpFile);
      expect(result.hash).to.match(/^0x[0-9a-f]{64}$/);
      expect(result.algorithm).to.equal("sha256");
      expect(result.size).to.be.greaterThan(0);
    });

    it("Should match hashDocument when given the same content", function () {
      const content = Buffer.from("Kadra LPA content for hashing test");
      const fromBuffer = hashDocument(content);
      const fromFile = hashFile(tmpFile);
      expect(fromFile.hash).to.equal(fromBuffer.hash);
    });
  });
});
