/**
 * Validates that required environment variables are present and well-formed.
 * Throws with a clear message listing all missing/invalid variables.
 */
function validateEnv(requiredVars) {
  const errors = [];

  for (const { name, pattern, description } of requiredVars) {
    const value = process.env[name];
    if (!value || value.trim() === "") {
      errors.push(`  - ${name}: missing (${description})`);
      continue;
    }
    if (pattern && !pattern.test(value)) {
      errors.push(`  - ${name}: invalid format (${description})`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join("\n")}\n\nSee .env.example for required variables.`
    );
  }
}

/**
 * Common env var definitions for deploy/transfer scripts.
 */
const DEPLOY_ENV_VARS = [
  {
    name: "SEPOLIA_RPC_URL",
    pattern: /^https?:\/\/.+/,
    description: "Sepolia RPC endpoint URL",
  },
  {
    name: "DEPLOYER_PRIVATE_KEY",
    pattern: /^0x[0-9a-fA-F]{64}$/,
    description: "64-hex-char private key prefixed with 0x",
  },
];

const TRANSFER_ENV_VARS = [
  ...DEPLOY_ENV_VARS,
  {
    name: "TRANSFER_TARGET_ADDRESS",
    pattern: /^0x[0-9a-fA-F]{40}$/,
    description: "Valid Ethereum address (0x + 40 hex chars)",
  },
];

const SQL_ENV_VARS = [
  {
    name: "SQL_API_KEY",
    pattern: /^.{1,}$/,
    description: "API key for SQL transaction history endpoint",
  },
  {
    name: "SQL_API_ENDPOINT",
    pattern: /^https?:\/\/.+/,
    description: "Base URL for SQL data API",
  },
];

module.exports = { validateEnv, DEPLOY_ENV_VARS, TRANSFER_ENV_VARS, SQL_ENV_VARS };
