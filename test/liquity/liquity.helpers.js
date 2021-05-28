const hre = require("hardhat");
const encodeSpells = require("../../scripts/encodeSpells.js");
const hardhatConfig = require("../../hardhat.config");

const CONNECTOR_NAME = "LIQUITY-v1-TEST";
const LUSD_GAS_COMPENSATION = hre.ethers.utils.parseUnits("200", 18); // 200 LUSD gas compensation repaid after loan repayment
const BLOCK_NUMBER = 12456118; // Deterministic block number for tests to run against, if you change this, test can break.
const JUSTIN_SUN_ADDRESS = "0x903d12bf2c57a29f32365917c706ce0e1a84cce3"; // LQTY whale address

const openTroveSpell = async (
  dsa,
  signer,
  depositAmount,
  borrowAmount,
  upperHint,
  lowerHint,
  maxFeePercentage
) => {
  let address = signer.address;
  if (signer.address === undefined) {
    address = await signer.getAddress();
  }
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
    .connect(signer)
    .cast(...encodeSpells([openTroveSpell]), address, {
      value: depositAmount,
    });

  return await openTx.wait();
};

const createDsaTrove = async (
  dsa,
  signer,
  depositAmount = hre.ethers.utils.parseEther("5"),
  borrowAmount = hre.ethers.utils.parseUnits("2500", 18),
  upperHint = hre.ethers.constants.AddressZero,
  lowerHint = hre.ethers.constants.AddressZero,
  maxFeePercentage = hre.ethers.utils.parseUnits("0.5", 18) // 0.5% max fee
) => {
  return await openTroveSpell(
    dsa,
    signer,
    depositAmount,
    borrowAmount,
    upperHint,
    lowerHint,
    maxFeePercentage
  );
};

const sendToken = async (token, amount, from, to) => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [from],
  });
  const signer = await hre.ethers.provider.getSigner(from);

  return await token.connect(signer).transfer(to, amount);
};

const resetHardhatBlockNumber = async (blockNumber) => {
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
  const nominalCR = await hintHelpers.computeNominalCR(
    depositAmount,
    borrowAmount
  );

  const { hintAddress } = await hintHelpers.getApproxHint(
    nominalCR,
    50,
    1298379
  );

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

const getRedemptionHints = async (
  amount,
  hintHelpers,
  sortedTroves,
  priceFeed
) => {
  const ethPrice = await priceFeed.callStatic.fetchPrice();
  const [
    firstRedemptionHint,
    partialRedemptionHintNicr,
  ] = await hintHelpers.getRedemptionHints(amount, ethPrice, 0);

  const { hintAddress } = await hintHelpers.getApproxHint(
    partialRedemptionHintNicr,
    50,
    452354
  );

  const { 0: upperHint, 1: lowerHint } = await sortedTroves.findInsertPosition(
    partialRedemptionHintNicr,
    hintAddress,
    hintAddress
  );

  return {
    partialRedemptionHintNicr,
    firstRedemptionHint,
    upperHint,
    lowerHint,
  };
};

module.exports = {
  createDsaTrove,
  openTroveSpell,
  sendToken,
  CONNECTOR_NAME,
  LUSD_GAS_COMPENSATION,
  BLOCK_NUMBER,
  JUSTIN_SUN_ADDRESS,
  resetHardhatBlockNumber,
  getTroveInsertionHints,
  getRedemptionHints,
};
