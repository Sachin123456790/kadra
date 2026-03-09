require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const isValidPrivateKey = (key) =>
  typeof key === "string" && /^0x[0-9a-fA-F]{64}$/.test(key);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.TESTNET_RPC || "",
      accounts: isValidPrivateKey(process.env.DEPLOYER_PRIVATE_KEY)
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
