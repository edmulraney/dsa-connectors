pragma solidity ^0.7.0;

contract Events {
    event Open(
        address indexed borrower,
        uint maxFeePercentage,
        uint depositAmount,
        uint borrowAmount,
        uint getId,
        uint setId
    );
    event LogClose(address indexed borrower, uint setId);
    event LogDeposit(address indexed borrower, uint amount, uint getId, uint setId);
    event LogWithdraw(address indexed borrower, uint amount, uint getId, uint setId);
    event LogBorrow(address indexed borrower, uint amount, uint getId, uint setId);
    event LogRepay(address indexed borrower, uint amount, uint getId, uint setId);
    event LogAdjust(
        address indexed borrower,
        uint maxFeePercentage,
        uint depositAmount,
        uint withdrawAmount,
        uint borrowAmount,
        uint repayAmount,
        uint getDepositId,
        uint setWithdrawId,
        uint getRepayId,
        uint setBorrowId
    );

    // Liquidate? 
    // Redeem?

    // Stability pool?
    // Staking?
}