pragma solidity ^0.7.0;

contract Events {
    event LogClose(address indexed borrower, uint setId);
    event LogDeposit(address indexed borrower, uint amount, uint getId, uint setId);
    event LogWithdraw(address indexed borrower, uint amount, uint getId, uint setId);
    event LogBorrow(address indexed borrower, uint amount, uint getId, uint setId);
    event LogRepay(address indexed borrower, uint amount, uint getId, uint setId);
    event LogDepositAndBorrow(
        address indexed borrower,
        uint depositAmount,
        uint borrowAmount,
        uint getId,
        uint setId
    );

    // Liquidate? 
    // Redeem?

    // Stability pool?
    // Staking?
}