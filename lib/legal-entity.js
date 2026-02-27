const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "legal-entity.json");

/**
 * Loads and validates the legal entity simulation data.
 * Returns the parsed entity object with required fields verified.
 */
function loadLegalEntity() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Legal entity data file not found: ${DATA_PATH}`);
  }

  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const entity = JSON.parse(raw);

  const required = ["name", "taxId", "jurisdiction", "walletAddress", "eoaAddress"];
  const missing = required.filter((f) => !entity[f]);
  if (missing.length > 0) {
    throw new Error(`Legal entity missing required fields: ${missing.join(", ")}`);
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(entity.walletAddress)) {
    throw new Error(`Invalid walletAddress format: ${entity.walletAddress}`);
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(entity.eoaAddress)) {
    throw new Error(`Invalid eoaAddress format: ${entity.eoaAddress}`);
  }

  return entity;
}

module.exports = { loadLegalEntity };
