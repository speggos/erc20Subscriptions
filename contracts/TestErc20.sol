// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(uint balance, address person1, address person2, address person3) ERC20("Basic", "BSC") {
        _mint(person1, balance);
        _mint(person2, balance);
        _mint(person3, balance);
    }
}