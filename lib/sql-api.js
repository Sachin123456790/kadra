/**
 * SQL Data API client for transaction history.
 * Uses HTTP fetch with env-driven config (SQL_API_KEY, SQL_API_ENDPOINT).
 * No hardcoded URLs — all config comes from environment variables.
 */

/**
 * Fetches transaction history for a given entity from the SQL data API.
 * @param {string} entityId - The legal entity identifier
 * @param {object} [options] - Optional overrides for testing
 * @param {string} [options.apiKey] - Override SQL_API_KEY
 * @param {string} [options.endpoint] - Override SQL_API_ENDPOINT
 * @param {function} [options.fetchFn] - Override global fetch (for testing)
 * @returns {Promise<object>} Parsed transaction history response
 */
async function fetchTransactionHistory(entityId, options = {}) {
  const apiKey = "apiKey" in options ? options.apiKey : process.env.SQL_API_KEY;
  const endpoint = "endpoint" in options ? options.endpoint : process.env.SQL_API_ENDPOINT;
  const fetchFn = options.fetchFn || globalThis.fetch;

  if (!apiKey) {
    throw new Error("SQL_API_KEY is not configured");
  }
  if (!endpoint) {
    throw new Error("SQL_API_ENDPOINT is not configured");
  }
  if (!entityId || typeof entityId !== "string") {
    console.log("fetchTransactionHistory: missing or invalid entityId, returning empty fallback");
    return { transactions: [], entityId: null, fallback: true };
  }

  const url = `${endpoint}/v1/transactions?entityId=${encodeURIComponent(entityId)}`;

  const response = await fetchFn(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`SQL API auth failure (${response.status}): token may be expired or invalid`);
  }

  if (response.status >= 400 && response.status < 500) {
    const body = await response.text().catch(() => "");
    throw new Error(`SQL API client error (${response.status}): ${body || "bad request"}`);
  }

  if (response.status >= 500) {
    throw new Error(`SQL API server error (${response.status}): service unavailable`);
  }

  const data = await response.json();
  return data;
}

module.exports = { fetchTransactionHistory };
