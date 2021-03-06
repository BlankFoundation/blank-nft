const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy BlankArt", function () {
  it("Should return the right name and symbol", async function () {
    const [owner, addr1, voucherSigner] = await ethers.getSigners();
    const BlankArt = await ethers.getContractFactory("BlankArt");
    const blankArt = await BlankArt.deploy(owner.address, voucherSigner.address, 10000, "ar://123456789/", 1000);

    await blankArt.deployed();
    expect(await blankArt.name()).to.equal("BlankArt");
    expect(await blankArt.symbol()).to.equal("BLANK");
  });
});