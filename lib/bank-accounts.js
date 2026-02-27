const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "bank-accounts.json");

/**
 * Loads and validates external bank account simulation data.
 * Returns the array of bank accounts with required fields verified.
 */
function loadBankAccounts() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Bank accounts data file not found: ${DATA_PATH}`);
  }

  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.accounts) || data.accounts.length === 0) {
    throw new Error("Bank accounts data must contain a non-empty 'accounts' array");
  }

  const required = ["id", "holder", "routingNumber", "accountNumber", "bankName", "type", "currency"];

  for (const account of data.accounts) {
    const missing = required.filter((f) => !account[f]);
    if (missing.length > 0) {
      throw new Error(
        `Bank account ${account.id || "unknown"} missing fields: ${missing.join(", ")}`
      );
    }
    if (!/^\d{9}$/.test(account.routingNumber)) {
      throw new Error(
        `Bank account ${account.id}: routingNumber must be 9 digits, got "${account.routingNumber}"`
      );
    }
  }

  return data.accounts;
}

/**
 * Returns only verified bank accounts.
 */
function getVerifiedAccounts() {
  return loadBankAccounts().filter((a) => a.verified === true);
}

module.exports = { loadBankAccounts, getVerifiedAccounts };
