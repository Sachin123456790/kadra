const crypto = require("crypto");
const fs = require("fs");

function hashDocument(buffer) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return { hash: "0x" + hash, algorithm: "sha256", size: buffer.length };
}

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return hashDocument(buffer);
}

module.exports = { hashDocument, hashFile };
