import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  zksolc: {
    version: "1.5.12",
    settings: {
      codegen: "evmla",
    },
  },

  networks: {
    abstractTestnet: {
      url: "https://api.testnet.abs.xyz",
      chainId: 11124,
      accounts: [DEPLOYER_PK],
      zksync: true,
      ethNetwork: "sepolia",
      verifyURL: "https://api-explorer-verify.testnet.abs.xyz/contract_verification",
    },
    abstractMainnet: {
      url: "https://api.mainnet.abs.xyz",
      chainId: 2741,
      accounts: [DEPLOYER_PK],
      zksync: true,
      ethNetwork: "mainnet",
      verifyURL: "https://api-explorer-verify.abs.xyz/contract_verification",
    },
    hardhat: {
      zksync: false,
    },
  },

  defaultNetwork: "abstractTestnet",
};

export default config;
