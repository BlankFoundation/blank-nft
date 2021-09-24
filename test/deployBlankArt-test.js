const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy BlankArt", function () {
  it("Should return the right name and symbol", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const BlankNFT = await ethers.getContractFactory("BlankArt");
    const blankNFT = await BlankArt.deploy("BlankArt", "BLANK", 10000, addr1);

    await blankNFT.deployed();
    expect(await blankNFT.name()).to.equal("BlankArt");
    expect(await blankNFT.symbol()).to.equal("BLANK");
  });
});