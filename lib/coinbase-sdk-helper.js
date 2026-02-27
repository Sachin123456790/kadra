/**
 * Coinbase SDK helper configured for Sepolia testnet.
 * Initializes the SDK client with env-provided credentials.
 */

const NETWORK = "sepolia";
const CHAIN_ID = 11155111;

/**
 * Returns a configured Coinbase SDK client.
 * Requires COINBASE_API_KEY_NAME and COINBASE_API_KEY_SECRET in env.
 */
async function getCoinbaseClient() {
  const { Coinbase } = await import("@coinbase/coinbase-sdk");

  const apiKeyName = process.env.COINBASE_API_KEY_NAME;
  const apiKeySecret = process.env.COINBASE_API_KEY_SECRET;

  if (!apiKeyName || !apiKeySecret) {
    throw new Error(
      "Missing Coinbase SDK credentials. Set COINBASE_API_KEY_NAME and COINBASE_API_KEY_SECRET in .env"
    );
  }

  const coinbase = new Coinbase({
    apiKeyName,
    privateKey: apiKeySecret,
  });

  return coinbase;
}

module.exports = { getCoinbaseClient, NETWORK, CHAIN_ID };
