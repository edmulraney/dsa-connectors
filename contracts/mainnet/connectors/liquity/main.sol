pragma solidity ^0.7.0;

/**
 * @title Liquity.
 * @dev Lending & Borrowing.
 */
import "hardhat/console.sol";

import { BorrowerOperationsLike, TroveManagerLike } from "./interface.sol";
import { Stores } from "../../common/stores.sol";
import { Helpers } from "./helpers.sol";
import { Events } from "./events.sol";

abstract contract LiquityResolver is Events, Helpers {
    BorrowerOperationsLike internal constant borrowerOperations =
        BorrowerOperationsLike(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
    TroveManagerLike internal constant troveManager =
        TroveManagerLike(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);

    struct AdjustTroveVariables {
        uint maxFeePercentage;
        uint withdrawAmount;
        uint depositAmount;
        uint borrowAmount;
        uint repayAmount;
        bool isBorrow;
    }

    constructor() {
        console.log("Connector :: deployed at", address(this));
    }

    function open(
        uint depositAmount,
        uint maxFeePercentage,
        uint borrowAmount,
        address upperHint,
        address lowerHint,
        uint getId,
        uint setId
    ) external payable returns (string memory _eventName, bytes memory _eventParam) {
        // User's can either send ETH directly or have it collected from a previous spell
        depositAmount = getUint(getId, depositAmount);
        console.log("Connector :: depositAmount", depositAmount, getId);
        console.log("Connector :: msg.value", msg.value);
        console.log("Connector :: depositAmount, borrowAmount", depositAmount, borrowAmount);
        console.log("Connector :: sender, address(this)", msg.sender, address(this));

        uint trovesBefore = troveManager.getTroveOwnersCount();
        console.log("Connector :: this Trove debt", troveManager.getTroveDebt(address(this)));

        borrowerOperations.openTrove{value: depositAmount}(
            maxFeePercentage,
            borrowAmount,
            upperHint,
            lowerHint
        );
        console.log("Connector :: trovesBefore, trovesAfter", trovesBefore, troveManager.getTroveOwnersCount());
        console.log("Connector :: this Trove debt", troveManager.getTroveDebt(address(this)));

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
        uint amount,
        uint maxFeePercentage,
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
        _eventName = "LogDeposit(address,uint,uint,uint)";
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
        AdjustTroveVariables memory adjustTrove;

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

    // function depositAndBorrow(
    //     uint depositAmount,
    //     uint maxFeePercentage,
    //     uint borrowAmount,
    //     address upperHint,
    //     address lowerHint,
    //     uint getId,
    //     uint setId
    // ) external payable returns (string memory _eventName, bytes memory _eventParam) {
    //     depositAmount = getUint(getId, depositAmount);

    //     borrowerOperations.adjustTrove{value: depositAmount}(
    //         maxFeePercentage,
    //         0, // collateralWithdrawal=0
    //         borrowAmount,
    //         true, // isDebtIncrease=true
    //         upperHint,
    //         lowerHint
    //     );

    //     // Allow other spells to use the borrowed amount
    //     setUint(setId, borrowAmount);
    //     _eventName = "LogDepositAndBorrow(address,uint,uint,uint,uint,uint)";
    //     _eventParam = abi.encode(msg.sender, maxFeePercentage, depositAmount, borrowAmount, getId, setId);
    // }


}

contract ConnectV2Liquity is LiquityResolver {
    string public name = "Liquity-v1";
}
