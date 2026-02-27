const { expect } = require("chai");
const { validateEnv, DEPLOY_ENV_VARS, TRANSFER_ENV_VARS, SQL_ENV_VARS } = require("../lib/validate-env");
const { loadLegalEntity } = require("../lib/legal-entity");
const { loadBankAccounts, getVerifiedAccounts } = require("../lib/bank-accounts");
const { NETWORK, CHAIN_ID } = require("../lib/coinbase-sdk-helper");

describe("Configuration and Simulation Data", function () {
  describe("Network config", function () {
    it("Should target Sepolia network", function () {
      expect(NETWORK).to.equal("sepolia");
      expect(CHAIN_ID).to.equal(11155111);
    });

    it("Hardhat config should include sepolia network", function () {
      const config = require("../hardhat.config");
      expect(config.networks).to.have.property("sepolia");
      expect(config.networks.sepolia.chainId).to.equal(11155111);
    });

    it("Should not define mainnet or homestead network", function () {
      const config = require("../hardhat.config");
      expect(config.networks).to.not.have.property("mainnet");
      expect(config.networks).to.not.have.property("homestead");
    });
  });

  describe("Env validation", function () {
    it("Should throw when required vars are missing", function () {
      const saved = process.env.SEPOLIA_RPC_URL;
      delete process.env.SEPOLIA_RPC_URL;

      expect(() => validateEnv(DEPLOY_ENV_VARS)).to.throw("Environment validation failed");

      if (saved) process.env.SEPOLIA_RPC_URL = saved;
    });

    it("Should throw for invalid private key format", function () {
      const saved = {
        SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL,
        DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
      };

      process.env.SEPOLIA_RPC_URL = "https://example.com";
      process.env.DEPLOYER_PRIVATE_KEY = "not-a-valid-key";

      expect(() => validateEnv(DEPLOY_ENV_VARS)).to.throw("invalid format");

      // Restore
      Object.entries(saved).forEach(([k, v]) => {
        if (v) process.env[k] = v;
        else delete process.env[k];
      });
    });

    it("Should pass with valid env vars", function () {
      const saved = {
        SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL,
        DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
      };

      process.env.SEPOLIA_RPC_URL = "https://eth-sepolia.example.com/v2/key";
      process.env.DEPLOYER_PRIVATE_KEY =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

      expect(() => validateEnv(DEPLOY_ENV_VARS)).to.not.throw();

      // Restore
      Object.entries(saved).forEach(([k, v]) => {
        if (v) process.env[k] = v;
        else delete process.env[k];
      });
    });
  });

  describe("SQL env validation", function () {
    it("Should throw when SQL_API_KEY is missing", function () {
      const saved = {
        SQL_API_KEY: process.env.SQL_API_KEY,
        SQL_API_ENDPOINT: process.env.SQL_API_ENDPOINT,
      };

      delete process.env.SQL_API_KEY;
      process.env.SQL_API_ENDPOINT = "https://api.example.com";

      expect(() => validateEnv(SQL_ENV_VARS)).to.throw("SQL_API_KEY");

      Object.entries(saved).forEach(([k, v]) => {
        if (v) process.env[k] = v;
        else delete process.env[k];
      });
    });

    it("Should throw when SQL_API_ENDPOINT is missing", function () {
      const saved = {
        SQL_API_KEY: process.env.SQL_API_KEY,
        SQL_API_ENDPOINT: process.env.SQL_API_ENDPOINT,
      };

      process.env.SQL_API_KEY = "some-key";
      delete process.env.SQL_API_ENDPOINT;

      expect(() => validateEnv(SQL_ENV_VARS)).to.throw("SQL_API_ENDPOINT");

      Object.entries(saved).forEach(([k, v]) => {
        if (v) process.env[k] = v;
        else delete process.env[k];
      });
    });

    it("Should throw for invalid SQL_API_ENDPOINT format", function () {
      const saved = {
        SQL_API_KEY: process.env.SQL_API_KEY,
        SQL_API_ENDPOINT: process.env.SQL_API_ENDPOINT,
      };

      process.env.SQL_API_KEY = "some-key";
      process.env.SQL_API_ENDPOINT = "not-a-url";

      expect(() => validateEnv(SQL_ENV_VARS)).to.throw("invalid format");

      Object.entries(saved).forEach(([k, v]) => {
        if (v) process.env[k] = v;
        else delete process.env[k];
      });
    });

    it("Should pass with valid SQL env vars", function () {
      const saved = {
        SQL_API_KEY: process.env.SQL_API_KEY,
        SQL_API_ENDPOINT: process.env.SQL_API_ENDPOINT,
      };

      process.env.SQL_API_KEY = "test-api-key-123";
      process.env.SQL_API_ENDPOINT = "https://sql-api.example.com";

      expect(() => validateEnv(SQL_ENV_VARS)).to.not.throw();

      Object.entries(saved).forEach(([k, v]) => {
        if (v) process.env[k] = v;
        else delete process.env[k];
      });
    });
  });

  describe("Legal entity simulation", function () {
    it("Should load legal entity with required fields", function () {
      const entity = loadLegalEntity();
      expect(entity).to.have.property("name").that.is.a("string").and.not.empty;
      expect(entity).to.have.property("taxId").that.is.a("string").and.not.empty;
      expect(entity).to.have.property("jurisdiction").that.is.a("string").and.not.empty;
      expect(entity).to.have.property("walletAddress").that.matches(/^0x[0-9a-fA-F]{40}$/);
      expect(entity).to.have.property("eoaAddress").that.matches(/^0x[0-9a-fA-F]{40}$/);
    });

    it("Should have company metadata fields", function () {
      const entity = loadLegalEntity();
      expect(entity.name).to.include("LLC");
      expect(entity.taxId).to.match(/^EIN-/);
      expect(entity.jurisdiction).to.match(/^US-/);
    });
  });

  describe("Bank account simulation", function () {
    it("Should load bank accounts with required fields", function () {
      const accounts = loadBankAccounts();
      expect(accounts).to.be.an("array").with.length.greaterThan(0);

      for (const acct of accounts) {
        expect(acct).to.have.property("id");
        expect(acct).to.have.property("holder");
        expect(acct).to.have.property("routingNumber").that.matches(/^\d{9}$/);
        expect(acct).to.have.property("accountNumber");
        expect(acct).to.have.property("bankName");
        expect(acct).to.have.property("type");
        expect(acct).to.have.property("currency");
      }
    });

    it("Should filter verified accounts", function () {
      const verified = getVerifiedAccounts();
      expect(verified).to.be.an("array");
      for (const acct of verified) {
        expect(acct.verified).to.equal(true);
      }
    });

    it("Should have at least one verified account", function () {
      const verified = getVerifiedAccounts();
      expect(verified.length).to.be.greaterThan(0);
    });
  });
});
