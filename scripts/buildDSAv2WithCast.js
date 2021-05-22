const hre = require("hardhat");
const { ethers } = hre;
const addresses = require("./constant/addresses");
const abis = require("./constant/abis");

const instaImplementations_m1 = require("../deployements/mainnet/Implementation_m1.sol/InstaImplementationM1.json");

module.exports = async function(owner, targets, calldatas, overrides = {}) {
  console.log("helo");
  const instaIndex = await ethers.getContractAt(
    abis.core.instaIndex,
    addresses.core.instaIndex
  );
  console.log("helo2");
  console.log(targets, calldatas, overrides);
  const tx = await instaIndex.buildWithCast(
    owner,
    2,
    targets,
    calldatas,
    owner,
    overrides
  );
  console.log("helo3");

  const receipt = await tx.wait();
  // console.log({ receipt }, receipt.events);
  const event = receipt.events.find((a) => a.event === "LogAccountCreated");

  const DSA = await ethers.getContractAt(
    instaImplementations_m1.abi,
    event.args.account
  );

  //////
  // const tx2 = await DSA.cast(targets, calldatas, owner, overrides);
  // const receipt2 = await tx2.wait();
  // console.log({ receipt2 }, receipt2.events);

  /////

  return DSA;
};
