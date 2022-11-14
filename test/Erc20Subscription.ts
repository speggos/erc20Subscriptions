import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { BigNumber } from 'ethers';
import { Token, Token__factory, Erc20Subscription, Erc20Subscription__factory, ERC20__factory } from '../typechain-types';

const INITIAL_BALANCE = toEther(10);
const SECONDS_IN_MONTH = secondsInDay(30);
const SECONDS_IN_YEAR = secondsInDay(365);

interface Subscripton {
  payer: string;
  payee: string;
  token: string;
  frequency: BigNumber;
  amount: BigNumber;
  nextPayment: BigNumber;
}

function toEther(value: number) {
  return ethers.utils.parseEther(value.toString());
}

function toBigNumber(value: number) {
  return ethers.BigNumber.from(value);
}

function secondsInDay(days: number) {
  return days * 24 * 60 * 60;
}

function getDateInSeconds() {
  return Math.floor(new Date().getTime() / 1000 );
}

const timeTravel = async (seconds: number) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

describe("Erc20Subscription", () => {
  
  let ERC20SUBSCRIPTION: any, erc20Subscription: Erc20Subscription;
  let TOKEN: any, token: Token;
  
  let deployer: SignerWithAddress;
  let payer: SignerWithAddress;
  let payee: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let sub1: Subscripton, sub2: Subscripton, sub3: Subscripton;

  let tokenAddr: string;

  beforeEach(async () => {
    ERC20SUBSCRIPTION = await ethers.getContractFactory("Erc20Subscription");
    erc20Subscription = await ERC20SUBSCRIPTION.deploy();
    await erc20Subscription.deployed();

    [deployer, payer, payee, alice, bob] = await ethers.getSigners();

    TOKEN = await ethers.getContractFactory("Token");
    token = await TOKEN.deploy(INITIAL_BALANCE, deployer.address, payer.address, alice.address);
    await token.deployed();
    tokenAddr = token.address;

    await token.connect(payer).approve(erc20Subscription.address, INITIAL_BALANCE);
    await token.connect(alice).approve(erc20Subscription.address, INITIAL_BALANCE);

    const currentTime = getDateInSeconds();

    sub1 = { payer: payer.address, payee: payee.address, token: tokenAddr, frequency: toBigNumber(SECONDS_IN_MONTH), amount: toEther(1), nextPayment: toBigNumber(currentTime+SECONDS_IN_MONTH)}
    sub2 = { payer: alice.address, payee: bob.address, token: tokenAddr, frequency: toBigNumber(SECONDS_IN_YEAR),  amount: toEther(2), nextPayment: toBigNumber(currentTime+SECONDS_IN_YEAR)}
  });

  describe("General Tests", () => {
    it("Deploys a contract", async () => {
      expect(await erc20Subscription.address).to.be.ok;
      expect(await token.address).to.be.ok;
    });
  });

  describe("Creates Subscriptions", () => {
    it("Has zero subscriptions on initiation", async () => {
      expect(await erc20Subscription.numberOfSubscriptions()).to.be.equal(0);
      expect (await erc20Subscription.subscriptions.length).to.be.equal(0);
    });

    it("Can add a subscription", async() => {
      await erc20Subscription.connect(payer).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount);
      expect(await erc20Subscription.numberOfSubscriptions()).to.be.equal(1);
    });

    it("Can add multiple subscriptions", async() => {
      await erc20Subscription.connect(payer).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount);
      await erc20Subscription.connect(alice).createSubscription(sub2.payee, sub2.token, sub2.frequency, sub2.amount);

      expect(await erc20Subscription.numberOfSubscriptions()).to.be.equal(2);
      expect( (await erc20Subscription.subscriptions(1)).payee).to.be.equal(payee.address);
      expect( (await erc20Subscription.subscriptions(2)).payee).to.be.equal(bob.address);
    });

    it("Transfers initial payment upon creation", async () => {
      await erc20Subscription.connect(payer).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount);
      expect(await token.balanceOf(sub1.payee)).to.equal(sub1.amount);
      expect(await token.balanceOf(sub1.payer)).to.equal(INITIAL_BALANCE.sub(sub1.amount));
    });

    it("Does not allow payments from addresses which are not approved", async () => {
      await expect(erc20Subscription.connect(bob).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount)).to.revertedWith("ERC20: insufficient allowance");
    });

    it("Emits an event", async () => {
      await expect(erc20Subscription.connect(payer).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount)).to.emit(erc20Subscription, "NewSubscription");
      await expect(erc20Subscription.connect(payer).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount)).to.emit(erc20Subscription, "Payment");
    });
  });

  describe("Allows payments to be pulled", async () => {
    beforeEach(async () => {
      await erc20Subscription.connect(payer).createSubscription(sub1.payee, sub1.token, sub1.frequency, sub1.amount);
      await erc20Subscription.connect(alice).createSubscription(sub2.payee, sub2.token, sub2.frequency, sub2.amount);
    });

    it("Doesn't allow nonexisting subscriptions, wrong payees, or too early", async () => {
      await expect(erc20Subscription.connect(alice).processPayment(1)).to.revertedWith("Only payee can pull payments");
      await expect(erc20Subscription.connect(payee).processPayment(1)).to.revertedWith("Next payment not yet available");
      await expect(erc20Subscription.connect(payee).processPayment(10)).to.revertedWith("Subscription not initialized");
    });

    it("Allows single payments to be pulled", async () => {
      timeTravel(SECONDS_IN_MONTH);
      await erc20Subscription.connect(payee).processPayment(1);
    });

    it("Allows single payments to be pulled multiple times", async () => {
      timeTravel(SECONDS_IN_MONTH);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(2)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(2));
      timeTravel(SECONDS_IN_MONTH);

      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub( sub1.amount.mul(3)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(3));
    });

    it("Allows multiple payments to be pulled", async () => {
      timeTravel(SECONDS_IN_MONTH * 3);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(4)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(4));

      timeTravel(SECONDS_IN_MONTH * 2);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(6)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(6));
    });

    it("Allows a mixture of single and multiple months to be charged", async () => {
      timeTravel(SECONDS_IN_MONTH * 3);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(4)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(4));

      timeTravel(SECONDS_IN_MONTH);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(5)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(5));

      timeTravel(SECONDS_IN_MONTH * 2);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(7)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(7));
    });

    it.only("Allows multiple subscriptions to be charged", async () => {
      timeTravel(SECONDS_IN_MONTH * 3);
      await erc20Subscription.connect(payee).processPayment(1);
      expect (await token.balanceOf(sub1.payer)).to.be.equal(INITIAL_BALANCE.sub(sub1.amount.mul(4)));
      expect (await token.balanceOf(sub1.payee)).to.be.equal(sub1.amount.mul(4));
      await expect(erc20Subscription.connect(bob).processPayment(2)).to.revertedWith("Next payment not yet available");

      timeTravel(SECONDS_IN_YEAR);
      await erc20Subscription.connect(bob).processPayment(2);
      expect (await token.balanceOf(sub2.payer)).to.be.equal(INITIAL_BALANCE.sub(sub2.amount.mul(2)));
      expect (await token.balanceOf(sub2.payee)).to.be.equal(sub2.amount.mul(2));
    });

  })
});
