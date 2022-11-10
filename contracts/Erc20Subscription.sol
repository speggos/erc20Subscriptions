// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract Erc20Subscription {
    // TODO pack this
    struct Subscription {
        address from;
        address to;
        address token;
        uint total;
        uint paid;
        uint start;
        uint end;
    }

    
}
