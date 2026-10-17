import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // read from parent .env

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: 'cancun',
    },
  },
  networks: {
    hardhat: {},
    baseSepolia: {
      url:      process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId:  84532,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network:  'baseSepolia',
        chainId:  84532,
        urls: {
          apiURL:     'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
  paths: {
    sources:   './contracts',
    tests:     './test',
    cache:     './cache',
    artifacts: './artifacts',
  },
};

export default config;
