pragma solidity ^0.7.0;

/**
 * @title Liquity.
 * @dev Lending & Borrowing.
 */
import "hardhat/console.sol";

import { BorrowerOperationsLike, TroveManagerLike, StabilityPoolLike, StakingLike } from "./interface.sol";
import { Stores } from "../../common/stores.sol";
import { Helpers } from "./helpers.sol";
import { Events } from "./events.sol";

abstract contract LiquityResolver is Events, Helpers {
    BorrowerOperationsLike internal constant borrowerOperations =
        BorrowerOperationsLike(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
    TroveManagerLike internal constant troveManager =
        TroveManagerLike(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);
    StabilityPoolLike internal constant stabilityPool =
        StabilityPoolLike(0x66017D22b0f8556afDd19FC67041899Eb65a21bb);
    StakingLike internal constant staking =
        StakingLike(0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d);

    struct AdjustTrove {
        uint maxFeePercentage;
        uint withdrawAmount;
        uint depositAmount;
        uint borrowAmount;
        uint repayAmount;
        bool isBorrow;
    }

    constructor() {
        console.log("Liquity Connector contract deployed at", address(this));
    }

    /* Begin: Trove */

    function open(
        uint depositAmount,
        uint maxFeePercentage,
        uint borrowAmount,
        address upperHint,
        address lowerHint,
        uint getId,
        uint setId
    ) external payable returns (string memory _eventName, bytes memory _eventParam) {
        // User can either send ETH directly or have it collected from a previous spell
        depositAmount = getUint(getId, depositAmount);

        borrowerOperations.openTrove{value: depositAmount}(
            maxFeePercentage,
            borrowAmount,
            upperHint,
            lowerHint
        );

        // Allow other spells to use the borrowed amount
        setUint(setId, borrowAmount);
        _eventName = "LogOpen(address,uint,uint,uint,uint,uint)";
        _eventParam = abi.encode(msg.sender, maxFeePercentage, depositAmount, borrowAmount, getId, setId);
    }

    function close(uint setId) external returns (string memory _eventName, bytes memory _eventParam) {
        uint collateral = troveManager.getTroveColl(address(this));
        borrowerOperations.closeTrove();

        // Allow other spells to use the collateral released from the Trove
        setUint(setId, collateral);
         _eventName = "LogClose(address,uint)";
        _eventParam = abi.encode(msg.sender, setId);
    }

    function deposit(
        uint amount,
        address upperHint,
        address lowerHint,
        uint getId,
        uint setId
    ) external payable returns (string memory _eventName, bytes memory _eventParam)  {
        amount = getUint(getId, amount);
        borrowerOperations.addColl{value: amount}(upperHint, lowerHint);
        _eventName = "LogDeposit(address,uint,uint,uint)";
        _eventParam = abi.encode(msg.sender, amount, getId, setId);
    }

   function withdraw(
        uint amount,
        address upperHint,
        address lowerHint,
        uint getId,
        uint setId
    ) external payable returns (string memory _eventName, bytes memory _eventParam)  {
        borrowerOperations.withdrawColl(amount, upperHint, lowerHint);

        setUint(setId, amount);
        _eventName = "LogWithdraw(address,uint,uint,uint)";
        _eventParam = abi.encode(msg.sender, amount, getId, setId);
    }

    function borrow(
        uint maxFeePercentage,
        uint amount,
        address upperHint,
        address lowerHint,
        uint getId,
        uint setId
    ) external payable returns (string memory _eventName, bytes memory _eventParam)  {
        borrowerOperations.withdrawLUSD(maxFeePercentage, amount, upperHint, lowerHint);

        setUint(setId, amount); // TODO: apply fee / get exact amount borrowed (with the fee applied)
        _eventName = "LogBorrow(address,uint,uint,uint)";
        _eventParam = abi.encode(msg.sender, amount, getId, setId);
    }

    function repay(
        uint amount,
        address upperHint,
        address lowerHint,
        uint getId,
        uint setId
    ) external payable returns (string memory _eventName, bytes memory _eventParam)  {
        amount = getUint(getId, amount);
        borrowerOperations.repayLUSD(amount, upperHint, lowerHint);
        _eventName = "LogRepay(address,uint,uint,uint)";
        _eventParam = abi.encode(msg.sender, amount, getId, setId);
    }

    function adjust(
        uint maxFeePercentage,
        uint withdrawAmount,
        uint depositAmount,
        uint borrowAmount,
        uint repayAmount,
        address upperHint,
        address lowerHint,
        uint getDepositId,
        uint setWithdrawId,
        uint getRepayId,
        uint setBorrowId
    ) external payable returns (string memory _eventName, bytes memory _eventParam) {
        AdjustTrove memory adjustTrove;

        adjustTrove.maxFeePercentage = maxFeePercentage;
        adjustTrove.withdrawAmount = withdrawAmount;
        adjustTrove.depositAmount = getUint(getDepositId, depositAmount);
        adjustTrove.borrowAmount = borrowAmount;
        adjustTrove.repayAmount = getUint(getRepayId, repayAmount);
        adjustTrove.isBorrow = borrowAmount > 0;

        borrowerOperations.adjustTrove{value: depositAmount}(
            adjustTrove.maxFeePercentage,
            adjustTrove.withdrawAmount,
            adjustTrove.borrowAmount,
            adjustTrove.isBorrow,
            upperHint,
            lowerHint
        );
        
        // Allow other spells to use the withdrawn collateral
        setUint(setWithdrawId, withdrawAmount);

        // Allow other spells to use the borrowed amount
        setUint(setBorrowId, borrowAmount);

        _eventName = "LogAdjust(address,uint,uint,uint,uint,uint,uint,uint,uint,uint)";
        _eventParam = abi.encode(msg.sender, maxFeePercentage, depositAmount, borrowAmount, getDepositId, setWithdrawId, getRepayId, setBorrowId);
    }

    function claimCollateralFromRedemption() external returns(string memory _eventName, bytes memory _eventParam) {
        borrowerOperations.claimCollateral();
        _eventName = "LogClaimCollateralFromRedemption(address)";
        _eventParam = abi.encode(msg.sender);
    }
    /* End: Trove */

    /* Begin: Stability Pool */
    function stabilityDeposit(
        uint amount,
        address frontendTag,
        uint getId
    ) external returns (string memory _eventName, bytes memory _eventParam) {
        amount = getUint(getId, amount);

        stabilityPool.provideToSP(amount, frontendTag);
        
        _eventName = "LogStabilityDeposit(address,uint,address,uint)";
        _eventParam = abi.encode(msg.sender, amount, frontendTag, getId);
    }

    function stabilityWithdraw(
        uint amount,
        uint setId
    ) external returns (string memory _eventName, bytes memory _eventParam) {
        stabilityPool.withdrawFromSP(amount);
        setUint(setId, amount);

        _eventName = "LogStabilityWithdraw(address,uint,uint)";
        _eventParam = abi.encode(msg.sender, amount, setId);
    }

    function stabilityMoveEthGainToTrove(
        address upperHint,
        address lowerHint
    ) external returns (string memory _eventName, bytes memory _eventParam) {
        stabilityPool.withdrawETHGainToTrove(upperHint, lowerHint);

        _eventName = "LogStabilityMoveEthGainToTrove(address)";
        _eventParam = abi.encode(msg.sender);
    }
    /* End: Stability Pool */

    /* Begin: Staking */
    function stake(
        uint amount,
        uint getId
    ) external returns (string memory _eventName, bytes memory _eventParam) {
        amount = getUint(getId, amount);
        staking.stake(amount);
        _eventName = "LogStake(address,uint)";
        _eventParam = abi.encode(msg.sender, amount);
    }

    function unstake(
        uint amount,
        uint setId
    ) external returns (string memory _eventName, bytes memory _eventParam) {
        staking.unstake(amount);
        setUint(setId, amount);
        _eventName = "LogUnstake(address,uint)";
        _eventParam = abi.encode(msg.sender, amount);
    }

    function claimGains() external returns (string memory _eventName, bytes memory _eventParam) {
        // claims are gained when a user's stake is adjusted, so we unstake 0 to trigger the claim
        staking.unstake(0); 
        _eventName = "LogClaimGains(address)";
        _eventParam = abi.encode(msg.sender);
    }
    /* End: Staking */

}

contract ConnectV2Liquity is LiquityResolver {
    string public name = "Liquity-v1";
}
