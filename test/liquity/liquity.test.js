const hre = require("hardhat");
const { expect } = require("chai");

// Instadapp deployment and testing helpers
const deployAndEnableConnector = require("../../scripts/deployAndEnableConnector.js");
const buildDSAv2 = require("../../scripts/buildDSAv2");
const encodeSpells = require("../../scripts/encodeSpells.js");
const getMasterSigner = require("../../scripts/getMasterSigner");

// Instadapp instadappAddresses/ABIs
const instadappAddresses = require("../../scripts/constant/addresses");
const instadappAbi = require("../../scripts/constant/abis");

// Instadapp Liquity Connector artifacts
const connectV2LiquityArtifacts = require("../../artifacts/contracts/mainnet/connectors/liquity/main.sol/ConnectV2Liquity.json");
const connectV2BasicV1Artifacts = require("../../artifacts/contracts/mainnet/connectors/basic/main.sol/ConnectV2Basic.json");

// Liquity smart contracts
const abi = require("./liquity.abi");

// Liquity helpers
const helpers = require("./liquity.helpers");

// Instadapp uses a fake address to represent native ETH
const { eth_addr: ETH_ADDRESS } = require("../../scripts/constant/constant");

describe.only("Liquity", () => {
  const { waffle, ethers } = hre;
  const { provider } = waffle;

  const userWallet = provider.getWallets()[0]; // Hardhat test account 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (holds 1000 ETH)

  let troveManager = null;
  let borrowerOperations = null;
  let lusdToken = null;
  let activePool = null;
  let priceFeed = null;
  let hintHelpers = null;
  let sortedTroves = null;
  let dsa = null;

  before(async () => {
    // Pin Liquity tests to a particular block number to create deterministic Ether price etc.
    await helpers.pinTestToBlockNumber(12433781);
    const masterSigner = await getMasterSigner();
    const instaConnectorsV2 = await ethers.getContractAt(
      instadappAbi.core.connectorsV2,
      instadappAddresses.core.connectorsV2
    );
    const connector = await deployAndEnableConnector({
      connectorName: helpers.CONNECTOR_NAME,
      contractArtifact: connectV2LiquityArtifacts,
      signer: masterSigner,
      connectors: instaConnectorsV2,
    });
    console.log(
      `${helpers.CONNECTOR_NAME} Connector address`,
      connector.address
    );
    expect(connector.address).to.exist;

    const basicConnector = await deployAndEnableConnector({
      connectorName: "Basic-v1",
      contractArtifact: connectV2BasicV1Artifacts,
      signer: masterSigner,
      connectors: instaConnectorsV2,
    });
    console.log("Basic-v1 Connector address", basicConnector.address);
    expect(basicConnector.address).to.exist;

    troveManager = new ethers.Contract(
      abi.TROVE_MANAGER_ADDRESS,
      abi.TROVE_MANAGER_ABI,
      ethers.provider
    );
    console.log("TroveManager contract address", troveManager.address);
    expect(troveManager.address).to.exist;

    borrowerOperations = new ethers.Contract(
      abi.BORROWER_OPERATIONS_ADDRESS,
      abi.BORROWER_OPERATIONS_ABI,
      ethers.provider
    );
    console.log(
      "BorrowerOperations contract address",
      borrowerOperations.address
    );
    expect(borrowerOperations.address).to.exist;

    lusdToken = new ethers.Contract(
      abi.LUSD_TOKEN_ADDRESS,
      abi.LUSD_TOKEN_ABI,
      ethers.provider
    );
    console.log("LusdToken contract address", lusdToken.address);
    expect(lusdToken.address).to.exist;

    activePool = new ethers.Contract(
      abi.ACTIVE_POOL_ADDRESS,
      abi.ACTIVE_POOL_ABI,
      ethers.provider
    );
    console.log("ActivePool contract address", activePool.address);
    expect(activePool.address).to.exist;

    priceFeed = new ethers.Contract(
      abi.PRICE_FEED_ADDRESS,
      abi.PRICE_FEED_ABI,
      ethers.provider
    );
    console.log("PriceFeed contract address", priceFeed.address);
    expect(priceFeed.address).to.exist;

    hintHelpers = new ethers.Contract(
      abi.HINT_HELPERS_ADDRESS,
      abi.HINT_HELPERS_ABI,
      ethers.provider
    );
    console.log("HintHelpers contract address", hintHelpers.address);
    expect(hintHelpers.address).to.exist;

    sortedTroves = new ethers.Contract(
      abi.SORTED_TROVES_ADDRESS,
      abi.SORTED_TROVES_ABI,
      ethers.provider
    );
    console.log("SortedTroves contract address", sortedTroves.address);
    expect(sortedTroves.address).to.exist;
  });

  beforeEach(async () => {
    // build a new DSA before each test so we start each test from the same default state
    dsa = await buildDSAv2(userWallet.address);
    // console.log("DSA contract address", dsa.address);
    expect(dsa.address).to.exist;
  });

  describe("Main (Connector)", () => {
    it("opens a Trove", async () => {
      const depositAmount = ethers.utils.parseEther("5"); // 5 ETH
      const borrowAmount = ethers.utils.parseUnits("2000", 18); // 2000 LUSD
      const maxFeePercentage = ethers.utils.parseUnits("0.5", 18); // 0.5% max fee
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const originalUserBalance = await ethers.provider.getBalance(
        userWallet.address
      );
      const originalDsaBalance = await ethers.provider.getBalance(dsa.address);

      const openTroveSpell = {
        connector: helpers.CONNECTOR_NAME,
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

      const spells = [openTroveSpell];
      const tx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells(spells), userWallet.address, {
          value: depositAmount,
        });

      await tx.wait();

      const userBalance = await ethers.provider.getBalance(userWallet.address);
      const dsaEthBalance = await ethers.provider.getBalance(dsa.address);
      const dsaLusdBalance = await lusdToken.balanceOf(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const troveCollateral = await troveManager.getTroveColl(dsa.address);

      expect(userBalance).lt(
        originalUserBalance,
        "User should have less Ether after opening Trove"
      );

      expect(dsaEthBalance).to.eq(
        originalDsaBalance,
        "User's DSA account Ether should not change after borrowing"
      );

      expect(
        dsaLusdBalance,
        "DSA account should now hold the amount the user tried to borrow"
      ).to.eq(borrowAmount);

      expect(troveDebt).to.gt(
        borrowAmount,
        "Trove debt should equal the borrowed amount plus fee"
      );

      expect(troveCollateral).to.eq(
        depositAmount,
        "Trove collateral should equal the deposited amount"
      );
    });

    it("opens a Trove using ETH collected from a previous spell", async () => {
      const depositAmount = ethers.utils.parseEther("5"); // 5 ETH
      const borrowAmount = ethers.utils.parseUnits("2000", 18); // 2000 LUSD
      const maxFeePercentage = ethers.utils.parseUnits("0.5", 18); // 0.5% max fee
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const originalUserBalance = await ethers.provider.getBalance(
        userWallet.address
      );
      const originalDsaBalance = await ethers.provider.getBalance(dsa.address);
      const depositId = 1; // Choose an ID to store and retrieve the deopsited ETH

      const depositEthSpell = {
        connector: "Basic-v1",
        method: "deposit",
        args: [ETH_ADDRESS, depositAmount, 0, depositId],
      };

      const openTroveSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "open",
        args: [
          0, // When pulling ETH from a previous spell it doesn't matter what deposit value we put in this param
          maxFeePercentage,
          borrowAmount,
          upperHint,
          lowerHint,
          depositId,
          0,
        ],
      };

      const spells = [depositEthSpell, openTroveSpell];
      const tx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells(spells), userWallet.address, {
          value: depositAmount,
        });

      await tx.wait();
      const userBalance = await ethers.provider.getBalance(userWallet.address);
      const dsaEthBalance = await ethers.provider.getBalance(dsa.address);
      const dsaLusdBalance = await lusdToken.balanceOf(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const troveCollateral = await troveManager.getTroveColl(dsa.address);

      expect(userBalance).lt(
        originalUserBalance,
        "User should have less Ether"
      );

      expect(dsaEthBalance).to.eq(
        originalDsaBalance,
        "DSA balance should not change"
      );

      expect(
        dsaLusdBalance,
        "DSA account should now hold the amount the user tried to borrow"
      ).to.eq(borrowAmount);

      expect(troveDebt).to.gt(
        borrowAmount,
        "Trove debt should equal the borrowed amount plus fee"
      );

      expect(troveCollateral).to.eq(
        depositAmount,
        "Trove collateral should equal the deposited amount"
      );
    });

    it("opens a Trove and stores the debt for other spells to use", async () => {
      const depositAmount = ethers.utils.parseEther("5"); // 5 ETH
      const borrowAmount = ethers.utils.parseUnits("2000", 18); // 2000 LUSD
      const maxFeePercentage = ethers.utils.parseUnits("0.5", 18); // 0.5% max fee
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const originalUserBalance = await ethers.provider.getBalance(
        userWallet.address
      );
      const originalDsaBalance = await ethers.provider.getBalance(dsa.address);
      const borrowId = 1;

      const openTroveSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "open",
        args: [
          depositAmount,
          maxFeePercentage,
          borrowAmount,
          upperHint,
          lowerHint,
          0,
          borrowId,
        ],
      };

      const withdrawLusdSpell = {
        connector: "Basic-v1",
        method: "withdraw",
        args: [
          abi.LUSD_TOKEN_ADDRESS,
          0, // amount comes from the previous spell's setId
          dsa.address,
          borrowId,
          0,
        ],
      };

      const spells = [openTroveSpell, withdrawLusdSpell];
      const tx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells(spells), userWallet.address, {
          value: depositAmount,
        });

      await tx.wait();

      const userBalance = await ethers.provider.getBalance(userWallet.address);

      expect(userBalance).lt(
        originalUserBalance,
        "User should have less Ether after opening Trove"
      );

      const dsaEthBalance = await ethers.provider.getBalance(dsa.address);
      const dsaLusdBalance = await lusdToken.balanceOf(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const troveCollateral = await troveManager.getTroveColl(dsa.address);

      expect(dsaEthBalance).to.eq(
        originalDsaBalance,
        "User's DSA account Ether should not change after borrowing"
      );

      expect(
        dsaLusdBalance,
        "DSA account should now hold the amount the user tried to borrow"
      ).to.eq(borrowAmount);

      expect(troveDebt).to.gt(
        borrowAmount,
        "Trove debt should equal the borrowed amount plus fee"
      );

      expect(troveCollateral).to.eq(
        depositAmount,
        "Trove collateral should equal the deposited amount"
      );
    });

    it("closes a Trove", async () => {
      const depositAmount = ethers.utils.parseEther("5");
      const borrowAmount = ethers.utils.parseUnits("2000", 18);
      await helpers.createTrove(dsa, userWallet, depositAmount, borrowAmount);

      const originalTroveDebt = await troveManager.getTroveDebt(dsa.address);
      const originalTroveCollateral = await troveManager.getTroveColl(
        dsa.address
      );

      // Send DSA account enough LUSD (from Stability Pool) to close their Trove
      const extraLusdRequiredToCloseTrove = originalTroveDebt.sub(borrowAmount);
      await helpers.sendLusdFromStabilityPool(
        lusdToken,
        extraLusdRequiredToCloseTrove,
        dsa.address
      );

      const originalDsaLusdBalance = await lusdToken.balanceOf(dsa.address);

      expect(
        originalDsaLusdBalance,
        "DSA account should now hold the LUSD amount required to pay off the Trove debt"
      ).to.eq(originalTroveDebt);

      const closeTroveSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "close",
        args: [0],
      };

      const closeTx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells([closeTroveSpell]), userWallet.address);

      await closeTx.wait();
      const dsaEthBalance = await ethers.provider.getBalance(dsa.address);
      const dsaLusdBalance = await lusdToken.balanceOf(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const troveCollateral = await troveManager.getTroveColl(dsa.address);

      expect(troveDebt, "Trove debt should equal 0 after close").to.eq(0);

      expect(
        troveCollateral,
        "Trove collateral should equal 0 after close"
      ).to.eq(0);

      expect(
        dsaEthBalance,
        "DSA account should now hold the Trove's ETH collateral"
      ).to.eq(originalTroveCollateral);

      expect(
        dsaLusdBalance,
        "DSA account should now hold the gas compensation amount of LUSD as it paid off the Trove debt"
      ).to.eq(helpers.LUSD_GAS_COMPENSATION);
    });

    it("closes a Trove using LUSD obtained from a previous spell", async () => {
      await helpers.createTrove(dsa, userWallet);

      const originalTroveDebt = await troveManager.getTroveDebt(dsa.address);
      const originalTroveCollateral = await troveManager.getTroveColl(
        dsa.address
      );

      // Send user enough LUSD to repay the loan, we'll use a deposit and withdraw spell to obtain it
      await helpers.sendLusdFromStabilityPool(
        lusdToken,
        originalTroveDebt,
        userWallet.address
      );

      // Allow DSA to spend user's LUSD
      await lusdToken
        .connect(userWallet)
        .approve(dsa.address, originalTroveDebt);

      const lusdDepositId = 1;

      // Simulate a spell which would have pulled LUSD from somewhere (e.g. AAVE) into InstaMemory
      // In this case we're simply running a deposit spell from the user's EOA
      const depositLusdSpell = {
        connector: "Basic-v1",
        method: "deposit",
        args: [abi.LUSD_TOKEN_ADDRESS, originalTroveDebt, 0, lusdDepositId],
      };
      // Withdraw the obtained LUSD into DSA account
      const withdrawLusdSpell = {
        connector: "Basic-v1",
        method: "withdraw",
        args: [
          abi.LUSD_TOKEN_ADDRESS,
          0, // amount comes from the previous spell's setId
          dsa.address,
          lusdDepositId,
          0,
        ],
      };

      const closeTroveSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "close",
        args: [0],
      };

      const closeTx = await dsa
        .connect(userWallet)
        .cast(
          ...encodeSpells([
            depositLusdSpell,
            withdrawLusdSpell,
            closeTroveSpell,
          ]),
          userWallet.address
        );

      await closeTx.wait();
      const dsaEthBalance = await ethers.provider.getBalance(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const troveCollateral = await troveManager.getTroveColl(dsa.address);

      expect(troveDebt, "Trove debt should equal 0 after close").to.eq(0);

      expect(
        troveCollateral,
        "Trove collateral should equal 0 after close"
      ).to.eq(0);

      expect(
        dsaEthBalance,
        "DSA account should now hold the Trove's ETH collateral"
      ).to.eq(originalTroveCollateral);
    });

    it("closes a Trove and stores the released collateral for other spells to use", async () => {
      const depositAmount = ethers.utils.parseEther("5");
      const borrowAmount = ethers.utils.parseUnits("2000", 18);
      await helpers.createTrove(dsa, userWallet, depositAmount, borrowAmount);

      const originalTroveDebt = await troveManager.getTroveDebt(dsa.address);
      const originalTroveCollateral = await troveManager.getTroveColl(
        dsa.address
      );

      // Send DSA account enough LUSD (from Stability Pool) to close their Trove
      const extraLusdRequiredToCloseTrove = originalTroveDebt.sub(borrowAmount);
      await helpers.sendLusdFromStabilityPool(
        lusdToken,
        extraLusdRequiredToCloseTrove,
        dsa.address
      );
      const originalDsaLusdBalance = await lusdToken.balanceOf(dsa.address);

      expect(
        originalDsaLusdBalance,
        "DSA account should now hold the LUSD amount required to pay off the Trove debt"
      ).to.eq(originalTroveDebt);

      const collateralWithdrawId = 1;

      const closeTroveSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "close",
        args: [collateralWithdrawId],
      };

      const withdrawEthSpell = {
        connector: "Basic-v1",
        method: "withdraw",
        args: [
          ETH_ADDRESS,
          0, // amount comes from the previous spell's setId
          dsa.address,
          collateralWithdrawId,
          0,
        ],
      };

      const closeTx = await dsa
        .connect(userWallet)
        .cast(
          ...encodeSpells([closeTroveSpell, withdrawEthSpell]),
          userWallet.address
        );

      await closeTx.wait();
      const dsaEthBalance = await ethers.provider.getBalance(dsa.address);
      const dsaLusdBalance = await lusdToken.balanceOf(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const troveCollateral = await troveManager.getTroveColl(dsa.address);

      expect(troveDebt, "Trove debt should equal 0 after close").to.eq(0);

      expect(
        troveCollateral,
        "Trove collateral should equal 0 after close"
      ).to.eq(0);

      expect(
        dsaEthBalance,
        "DSA account should now hold the Trove's ETH collateral"
      ).to.eq(originalTroveCollateral);

      expect(
        dsaLusdBalance,
        "DSA account should now hold the gas compensation amount of LUSD as it paid off the Trove debt"
      ).to.eq(helpers.LUSD_GAS_COMPENSATION);
    });

    it("deposits ETH into a Trove", async () => {
      await helpers.createTrove(dsa, userWallet);

      const originalTroveCollateral = await troveManager.getTroveColl(
        dsa.address
      );
      const topupAmount = ethers.utils.parseEther("1");
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const depositEthSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "deposit",
        args: [topupAmount, upperHint, lowerHint, 0, 0],
      };

      const depositTx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells([depositEthSpell]), userWallet.address, {
          value: topupAmount,
        });

      await depositTx.wait();
      const troveCollateral = await troveManager.getTroveColl(dsa.address);
      const expectedTroveCollateral = originalTroveCollateral.add(topupAmount);

      expect(
        troveCollateral,
        `Trove collateral should have increased by ${topupAmount} ETH`
      ).to.eq(expectedTroveCollateral);
    });

    it("withdraws ETH from a Trove", async () => {
      await helpers.createTrove(dsa, userWallet);

      const originalTroveCollateral = await troveManager.getTroveColl(
        dsa.address
      );
      const withdrawAmount = ethers.utils.parseEther("1");
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const withdrawEthSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "withdraw",
        args: [withdrawAmount, upperHint, lowerHint, 0, 0],
      };

      const withdrawTx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells([withdrawEthSpell]), userWallet.address);

      await withdrawTx.wait();
      const troveCollateral = await troveManager.getTroveColl(dsa.address);
      const expectedTroveCollateral = originalTroveCollateral.sub(
        withdrawAmount
      );

      expect(
        troveCollateral,
        `Trove collateral should have decreased by ${withdrawAmount} ETH`
      ).to.eq(expectedTroveCollateral);
    });

    it("borrows LUSD from a Trove", async () => {
      await helpers.createTrove(dsa, userWallet);

      const originalTroveDebt = await troveManager.getTroveDebt(dsa.address);
      const borrowAmount = ethers.utils.parseUnits("1000"); // 1000 LUSD
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const maxFeePercentage = ethers.utils.parseUnits("0.5", 18); // 0.5% max fee
      const borrowSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "borrow",
        args: [maxFeePercentage, borrowAmount, upperHint, lowerHint, 0, 0],
      };

      const borrowTx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells([borrowSpell]), userWallet.address);

      await borrowTx.wait();
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const expectedTroveDebt = originalTroveDebt.add(borrowAmount);

      expect(
        troveDebt,
        `Trove debt should have increased by at least ${borrowAmount} ETH`
      ).to.gte(expectedTroveDebt);
    });

    it("repays LUSD to a Trove", async () => {
      await helpers.createTrove(dsa, userWallet);

      const originalTroveDebt = await troveManager.getTroveDebt(dsa.address);
      const repayAmount = ethers.utils.parseUnits("100"); // 100 LUSD
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const borrowSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "repay",
        args: [repayAmount, upperHint, lowerHint, 0, 0],
      };

      const repayTx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells([borrowSpell]), userWallet.address, {
          value: repayAmount,
        });

      await repayTx.wait();
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const expectedTroveDebt = originalTroveDebt.sub(repayAmount);

      expect(
        troveDebt,
        `Trove debt should have decreased by ${repayAmount} ETH`
      ).to.eq(expectedTroveDebt);
    });

    it("adjusts a Trove: deposit ETH and borrow LUSD", async () => {
      await helpers.createTrove(dsa, userWallet);

      const originalTroveCollateral = await troveManager.getTroveColl(
        dsa.address
      );
      const originalTroveDebt = await troveManager.getTroveDebt(dsa.address);
      const depositAmount = ethers.utils.parseEther("1"); // 1 ETH
      const borrowAmount = ethers.utils.parseUnits("500"); // 500 LUSD
      const withdrawAmount = 0;
      const repayAmount = 0;
      const upperHint = ethers.constants.AddressZero;
      const lowerHint = ethers.constants.AddressZero;
      const maxFeePercentage = ethers.utils.parseUnits("0.5", 18); // 0.5% max fee

      const adjustSpell = {
        connector: helpers.CONNECTOR_NAME,
        method: "adjust",
        args: [
          maxFeePercentage,
          withdrawAmount,
          depositAmount,
          borrowAmount,
          repayAmount,
          upperHint,
          lowerHint,
          0,
          0,
          0,
          0,
        ],
      };

      const adjustTx = await dsa
        .connect(userWallet)
        .cast(...encodeSpells([adjustSpell]), userWallet.address, {
          value: depositAmount,
        });

      await adjustTx.wait();
      const troveCollateral = await troveManager.getTroveColl(dsa.address);
      const troveDebt = await troveManager.getTroveDebt(dsa.address);
      const expectedTroveColl = originalTroveCollateral.add(depositAmount);
      const expectedTroveDebt = originalTroveDebt.add(borrowAmount);

      expect(
        troveCollateral,
        `Trove collateral should have increased by ${depositAmount} ETH`
      ).to.eq(expectedTroveColl);

      expect(
        troveDebt,
        `Trove debt should have increased by at least ${borrowAmount} ETH`
      ).to.gte(expectedTroveDebt);
    });

    it("adjusts a Trove: withdraw ETH and repay LUSD", async () => {
      // TODO
    });

    it.only("claims collateral from a redeemed Trove", async () => {
      const ethPrice = await priceFeed.callStatic.fetchPrice();
      console.log("ethPrice", ethPrice.toString());
      const smallestTrove = await sortedTroves.getLast();
      console.log({ smallestTrove });
      const smallestTroveDebt = await troveManager.getTroveDebt(smallestTrove);
      const smallestTroveColl = await troveManager.getTroveColl(smallestTrove);
      console.log(
        "debt, coll",
        smallestTroveDebt.toString(),
        smallestTroveColl.toString()
      );

      // Create a low collateralized Trove
      const depositAmount = ethers.utils.parseEther("1"); // todo: smallestTroveColl
      const borrowAmount = ethers.utils.parseUnits("2000", 18); // todo: smallestTroveDebt.add(1)
      const maxFeePercentage = ethers.utils.parseUnits("0.5", 18);

      const {
        upperHint: upperInsertHint,
        lowerHint: lowerInsertHint,
      } = await helpers.getTroveInsertionHints(
        depositAmount,
        borrowAmount,
        hintHelpers,
        sortedTroves
      );
      console.log({ upperInsertHint, lowerInsertHint });
      await borrowerOperations
        .connect(userWallet)
        .openTrove(
          maxFeePercentage,
          borrowAmount,
          upperInsertHint,
          lowerInsertHint,
          {
            value: depositAmount,
            gasPrice: 0,
          }
        );

      // Redeem lots of LUSD to cause the Trove to become redeemed
      const redeemAmount = ethers.utils.parseUnits("100000000", 18);
      const [
        firstRedemptionHint,
        partialRedemptionHintNicr,
      ] = await hintHelpers.getRedemptionHints(redeemAmount, ethPrice, 0);
      const { hintAddress } = await hintHelpers.getApproxHint(
        partialRedemptionHintNicr,
        50,
        0
      );

      const {
        0: upperHint,
        1: lowerHint,
      } = await sortedTroves.findInsertPosition(
        partialRedemptionHintNicr,
        hintAddress,
        hintAddress
      );

      await helpers.sendLusdFromStabilityPool(
        lusdToken,
        ethers.utils.parseUnits("1000000000", 18),
        userWallet.address
      );

      await troveManager
        .connect(userWallet)
        .redeemCollateral(
          redeemAmount,
          firstRedemptionHint,
          upperHint,
          lowerHint,
          partialRedemptionHintNicr,
          0,
          maxFeePercentage,
          {
            gasLimit: 12450000, // permit max gas
          }
        );

      const troveStatus = await troveManager.getTroveStatus(dsa.address);
      console.log({ troveStatus: troveStatus.toString() });
    });
  });
});
