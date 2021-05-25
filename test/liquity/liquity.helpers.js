const hre = require("hardhat");
const encodeSpells = require("../../scripts/encodeSpells.js");
const { STABILITY_POOL_ADDRESS } = require("./liquity.abi");
const hardhatConfig = require("../../hardhat.config");

const CONNECTOR_NAME = "LIQUITY-v1-TEST";
const LUSD_GAS_COMPENSATION = hre.ethers.utils.parseUnits("200", 18); // 200 LUSD gas compensation repaid after loan repayment

const openTroveSpell = async (dsa, userWallet, depositAmount, borrowAmount) => {
  const maxFeePercentage = hre.ethers.utils.parseUnits("0.5", 18); // 0.5% max fee
  const upperHint = hre.ethers.constants.AddressZero;
  const lowerHint = hre.ethers.constants.AddressZero;

  const openTroveSpell = {
    connector: CONNECTOR_NAME,
    method: "open",
    args: [
      depositAmount,
      maxFeePercentage,
      borrowAmount,
      upperHint,
      lowerHint,
      0,
      0,
    ],
  };
  const openTx = await dsa
    .connect(userWallet)
    .cast(...encodeSpells([openTroveSpell]), userWallet.address, {
      value: depositAmount,
    });

  return await openTx.wait();
};

const createTrove = async (
  dsa,
  userWallet,
  depositAmount = hre.ethers.utils.parseEther("5"),
  borrowAmount = hre.ethers.utils.parseUnits("2500", 18)
) => {
  return await openTroveSpell(dsa, userWallet, depositAmount, borrowAmount);
};

const sendLusdFromStabilityPool = async (lusdToken, amount, to) => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [STABILITY_POOL_ADDRESS],
  });
  const signer = await hre.ethers.provider.getSigner(STABILITY_POOL_ADDRESS);

  return await lusdToken.connect(signer).transfer(to, amount);
};

const pinTestToBlockNumber = async (blockNumber) => {
  return await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: hardhatConfig.networks.hardhat.forking.url,
          blockNumber,
        },
      },
    ],
  });
};

const getTroveInsertionHints = async (
  depositAmount,
  borrowAmount,
  hintHelpers,
  sortedTroves
) => {
  const nominalCR = hintHelpers.computeNominalCR(depositAmount, borrowAmount);
  const { hintAddress } = await hintHelpers.getApproxHint(nominalCR, 50, 0);
  const { 0: upperHint, 1: lowerHint } = await sortedTroves.findInsertPosition(
    nominalCR,
    hintAddress,
    hintAddress
  );

  return {
    upperHint,
    lowerHint,
  };
};

module.exports = {
  createTrove,
  openTroveSpell,
  sendLusdFromStabilityPool,
  CONNECTOR_NAME,
  LUSD_GAS_COMPENSATION,
  pinTestToBlockNumber,
  getTroveInsertionHints,
};
