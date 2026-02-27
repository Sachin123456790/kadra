const { expect } = require("chai");
const { fetchTransactionHistory } = require("../lib/sql-api");

/**
 * Creates a mock fetch function that returns a predetermined response.
 */
function mockFetch(status, body, options = {}) {
  return async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    ...options,
  });
}

describe("SQL API - fetchTransactionHistory", function () {
  const baseOpts = {
    apiKey: "test-key-123",
    endpoint: "https://sql-api.example.com",
  };

  describe("Success response", function () {
    it("Should parse a valid transaction history response", async function () {
      const mockData = {
        transactions: [
          { id: "tx-001", amount: "1.5", currency: "ETH", timestamp: "2025-01-01T00:00:00Z" },
          { id: "tx-002", amount: "0.5", currency: "ETH", timestamp: "2025-01-02T00:00:00Z" },
        ],
        entityId: "entity-123",
        total: 2,
      };

      const result = await fetchTransactionHistory("entity-123", {
        ...baseOpts,
        fetchFn: mockFetch(200, mockData),
      });

      expect(result).to.deep.equal(mockData);
      expect(result.transactions).to.have.length(2);
      expect(result.transactions[0].id).to.equal("tx-001");
    });

    it("Should handle empty transaction list", async function () {
      const mockData = { transactions: [], entityId: "entity-456", total: 0 };

      const result = await fetchTransactionHistory("entity-456", {
        ...baseOpts,
        fetchFn: mockFetch(200, mockData),
      });

      expect(result.transactions).to.be.an("array").with.length(0);
    });
  });

  describe("4xx client errors", function () {
    it("Should throw on 400 bad request", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          ...baseOpts,
          fetchFn: mockFetch(400, "invalid entityId format"),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API client error (400)");
        expect(err.message).to.include("invalid entityId format");
      }
    });

    it("Should throw on 404 not found", async function () {
      try {
        await fetchTransactionHistory("nonexistent-entity", {
          ...baseOpts,
          fetchFn: mockFetch(404, "entity not found"),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API client error (404)");
      }
    });

    it("Should handle empty error body on 4xx", async function () {
      const emptyBodyFetch = async () => ({
        status: 422,
        ok: false,
        text: async () => { throw new Error("no body"); },
      });

      try {
        await fetchTransactionHistory("entity-123", {
          ...baseOpts,
          fetchFn: emptyBodyFetch,
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API client error (422)");
        expect(err.message).to.include("bad request");
      }
    });
  });

  describe("5xx server errors", function () {
    it("Should throw on 500 internal server error", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          ...baseOpts,
          fetchFn: mockFetch(500, ""),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API server error (500)");
        expect(err.message).to.include("service unavailable");
      }
    });

    it("Should throw on 503 service unavailable", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          ...baseOpts,
          fetchFn: mockFetch(503, ""),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API server error (503)");
      }
    });
  });

  describe("Expired token / auth failure", function () {
    it("Should throw on 401 unauthorized (expired token)", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          ...baseOpts,
          fetchFn: mockFetch(401, "token expired"),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API auth failure (401)");
        expect(err.message).to.include("token may be expired or invalid");
      }
    });

    it("Should throw on 403 forbidden", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          ...baseOpts,
          fetchFn: mockFetch(403, "forbidden"),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL API auth failure (403)");
      }
    });
  });

  describe("Missing entity fallback", function () {
    it("Should return empty fallback for null entityId", async function () {
      const result = await fetchTransactionHistory(null, {
        ...baseOpts,
        fetchFn: mockFetch(200, {}),
      });

      expect(result).to.deep.equal({ transactions: [], entityId: null, fallback: true });
    });

    it("Should return empty fallback for empty string entityId", async function () {
      const result = await fetchTransactionHistory("", {
        ...baseOpts,
        fetchFn: mockFetch(200, {}),
      });

      expect(result).to.deep.equal({ transactions: [], entityId: null, fallback: true });
    });

    it("Should return empty fallback for undefined entityId", async function () {
      const result = await fetchTransactionHistory(undefined, {
        ...baseOpts,
        fetchFn: mockFetch(200, {}),
      });

      expect(result).to.deep.equal({ transactions: [], entityId: null, fallback: true });
    });
  });

  describe("Missing configuration", function () {
    it("Should throw when apiKey is not set", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          apiKey: "",
          endpoint: "https://api.example.com",
          fetchFn: mockFetch(200, {}),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL_API_KEY is not configured");
      }
    });

    it("Should throw when endpoint is not set", async function () {
      try {
        await fetchTransactionHistory("entity-123", {
          apiKey: "key",
          endpoint: "",
          fetchFn: mockFetch(200, {}),
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("SQL_API_ENDPOINT is not configured");
      }
    });
  });
});
