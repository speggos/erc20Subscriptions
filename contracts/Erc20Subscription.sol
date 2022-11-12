// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract Erc20Subscription {
    uint32 public numberOfSubscriptions;
    // TODO pack this
    struct Subscription {
        address payer;
        address payee;
        address token;
        uint32 id;
        uint64 frequency;
        uint amount;
        uint nextPayment;
    }
    Subscription[] public subscriptions;

    event Payment(uint32 indexed subscriptionId, address indexed payer, address indexed payee, uint amount, address token);
    event PaymentFailed(uint32 indexed subscriptionId, address indexed payer, address indexed payee, uint amount, address token);
    event NewSubscription(uint32 indexed subscriptionId, address indexed payer, address indexed payee);
    event SubscriptionFinished(uint32 indexed subscriptionId, address indexed payer, address indexed payee);
    event SubscriptionCancelled(uint32 indexed subscriptionId, address indexed payer, address indexed payee);

    //TODO validate transfer functions exist on erc20. What are security risks?
    // TODO payments collected only monthly/yearly? Who cares?
    function createSubscription(address _payee, address _token, uint64 _frequency, uint _amount) public {
        numberOfSubscriptions += 1;
        bool success = ERC20(_token).transferFrom(msg.sender, _payee, _amount);
        require(success, "Not enough allowance");

        subscriptions.push(Subscription(msg.sender, _payee, _token, numberOfSubscriptions, _frequency, _amount, block.timestamp + _frequency));
        emit NewSubscription(numberOfSubscriptions, msg.sender, _payee);
        emit Payment(numberOfSubscriptions, msg.sender, _payee, _amount, _token);
    }
}
