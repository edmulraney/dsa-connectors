require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@tenderly/hardhat-tenderly");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-web3");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
      },
      {
        version: "0.6.0",
      },
      {
        version: "0.6.2",
      },
      {
        version: "0.6.5",
      },
    ],
  },
  networks: {
    // defaultNetwork: "hardhat",
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/xuwDTQcUmeG37Hx2TttXJV5SfWoG-eer`,
        blockNumber: 12433781,
      },
      // blockGasLimit: 12000000,
    },
  },
};
