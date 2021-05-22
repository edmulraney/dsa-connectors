const hre = require("hardhat");
const encodeSpells = require("../../scripts/encodeSpells.js");
const { STABILITY_POOL_ADDRESS } = require("./liquity.abi");

const CONNECTOR_NAME = "LIQUITY-v1-TEST";
const LUSD_GAS_COMPENSATION = hre.ethers.utils.parseUnits("200", 18); // 200 LUSD gas compensation repaid after loan repayment

const openTroveSpell = async (dsa, userWallet, depositAmount, borrowAmount) => {
  const maxFeePercentage = hre.ethers.utils.parseUnits("0.5", 18); // 0.5% max fee
  const upperHint = hre.ethers.constants.AddressZero;
  const lowerHint = hre.ethers.constants.AddressZero;

  const openTroveSpell = {
    connector: CONNECTOR_NAME,
    method: "depositAndBorrow",
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

const sendLusdFromStabilityPool = async (lusdToken, amount, to) => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [STABILITY_POOL_ADDRESS],
  });
  const signer = await hre.ethers.provider.getSigner(STABILITY_POOL_ADDRESS);

  return await lusdToken.connect(signer).transfer(to, amount);
};

module.exports = {
  openTroveSpell,
  sendLusdFromStabilityPool,
  CONNECTOR_NAME,
  LUSD_GAS_COMPENSATION,
};
