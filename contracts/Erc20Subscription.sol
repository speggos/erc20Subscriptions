// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract Erc20Subscription {
    uint32 public numberOfSubscriptions;
    // TODO pack this
    struct Subscription {
        address from;
        address to;
        address token;
        uint32 id;
        uint total;
        uint paid;
        uint start;
        uint end;
    }
    Subscription[] public subscriptions;


    event Payment(uint32 indexed subscriptionId, address indexed from, address indexed to, uint amount, uint token);
    event PaymentFailed(uint32 indexed subscriptionId, address indexed from, address indexed to, uint amount, uint token);
    event NewSubscription(uint32 indexed subscriptionId, address indexed from, address indexed to);
    event SubscriptionFinished(uint32 indexed subscriptionId, address indexed from, address indexed to);
    event SubscriptionCancelled(uint32 indexed subscriptionId, address indexed from, address indexed to);

    //TODO validate transfer functions exist on erc20. What are security risks?
    // TODO Allow start to be anything? Pending transactions
    function createSubscription(address _to, address _token, uint _total, uint _end) public {
        numberOfSubscriptions += 1;
        subscriptions.push(Subscription(msg.sender, _to, _token, numberOfSubscriptions, _total, 0, block.timestamp, _end));
        ERC20(_token).approve(address(this), _total);
    }

    function getRemaining(uint32 id) public view returns(uint) {
        Subscription memory sub = subscriptions[id-1];
        return sub.total - sub.paid;
    }
}
