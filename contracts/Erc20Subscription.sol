// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "hardhat/console.sol";

contract Erc20Subscription {
    uint public numberOfSubscriptions;
    // TODO pack this
    struct Subscription {
        address payer;
        address payee;
        address token;
        uint64 frequency;
        uint amount;
        uint nextPayment;
    }
    mapping (uint => Subscription) public subscriptions;

    event Payment(uint indexed subscriptionId, address indexed payer, address indexed payee, uint amount, address token);
    event NewSubscription(uint indexed subscriptionId, address indexed payer, address indexed payee);
    event SubscriptionCancelled(uint indexed subscriptionId, address indexed payer, address indexed payee);

    //TODO validate transfer functions exist on erc20. What are security risks?
    // TODO payments collected only monthly/yearly? Who cares?
    function createSubscription(address _payee, address _token, uint64 _frequency, uint _amount) public returns (uint id) {
        numberOfSubscriptions += 1;
        subscriptions[numberOfSubscriptions] = Subscription(msg.sender, _payee, _token, _frequency, _amount, block.timestamp + _frequency);
        
        emit NewSubscription(numberOfSubscriptions, msg.sender, _payee);
        emit Payment(numberOfSubscriptions, msg.sender, _payee, _amount, _token);
        
        bool success = ERC20(_token).transferFrom(msg.sender, _payee, _amount);
        require(success, "Not enough allowance/tokens");

        return numberOfSubscriptions;
    }

    function processPayment(uint subscriptionId) public {
        Subscription memory sub = subscriptions[subscriptionId];
        require (sub.payee != address(0), "Subscription doesn't exist");
        require (msg.sender == sub.payee, "Only payee can pull payments");
        require (sub.nextPayment <= block.timestamp, "Next payment not yet available");
        require (sub.amount != 0, "Subscription cancelled");

        uint numberOfPayments = ((block.timestamp - sub.nextPayment) / sub.frequency) + 1;

        subscriptions[subscriptionId].nextPayment = sub.nextPayment + numberOfPayments * sub.frequency;

        emit Payment(subscriptionId, sub.payer, sub.payee, sub.amount, sub.token);

        bool success = ERC20(sub.token).transferFrom(sub.payer, sub.payee, sub.amount * numberOfPayments);
        require(success, "Not enough allowance/tokens");
    }

    function cancelSubscription(uint subscriptionId) public {
        Subscription memory sub = subscriptions[subscriptionId];
        require (sub.payee != address(0), "Subscription doesn't exist");
        require (msg.sender == sub.payer, "Only subscriber can cancel");
        require (sub.amount != 0, "Subscription already cancelled");
        subscriptions[subscriptionId].amount = 0;

        emit SubscriptionCancelled(subscriptionId, sub.payer, sub.payee);
    }
}
