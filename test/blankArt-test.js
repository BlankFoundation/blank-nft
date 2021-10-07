const { expect } = require("chai");
const { ethers } = require("hardhat");
const { LazyMinter } = require('../lib');

describe("BlankArt", function () {
  let blankArt;

//  this.beforeEach(async () => {
//    const BlankArt = await ethers.getContractFactory("BlankArt");
//    const signers = await ethers.getSigners();
//    _owner = signers[0];
//    blankArt = await BlankArt.deploy(10000);
//
//    await blankArt.deployed();
//  })

  async function deploy() {
      const [minter, redeemer, _] = await ethers.getSigners()

      let factory = await ethers.getContractFactory("BlankArt")
      const contract = await factory.deploy(minter.address, 10000)

      // the redeemerContract is an instance of the contract that's wired up to the redeemer's signing key
      const redeemerFactory = factory.connect(redeemer)
      const redeemerContract = redeemerFactory.attach(contract.address)

      return {
        minter,
        redeemer,
        contract,
        redeemerContract,
    }
  }

  it("Should redeem one free Blank NFT from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher()

    await expect(redeemerContract.redeemVoucher(redeemer.address, 1, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', minter.address, contract.tokenIndex - 1)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      //.withArgs(minter.address, redeemer.address, contract.tokenIndex - 1);
  });
//  it("should allow you to check membership if an address has minted", async () => {
//    const [_owner, addr1] = await ethers.getSigners();
//
//    expect(await blankArt.isMember(addr1.address)).to.equal(false);
//
//    await blankArt.addMember(addr1.address);
//
//    expect(await blankArt.isMember(addr1.address)).to.equal(true);
//  });
//
//  it("should allow you to update the foundation address", async () => {
//    const [_owner, addr1] = await ethers.getSigners();
//
//    expect(await blankArt.foundationAddress()).to.equal(_owner.address);
//
//    await blankArt.updateFoundationAddress(addr1.address);
//
//    expect(await blankArt.foundationAddress()).to.equal(addr1.address);
//  });
//
//  it("should not allow you to update the foundation address from the wrong sender", async () => {
//    const [_owner, addr1, addr2] = await ethers.getSigners();
//
//    expect(await blankArt.foundationAddress()).to.equal(_owner.address);
//
//    await expect(blankArt.connect(addr1).updateFoundationAddress(addr2.address)).to.be.revertedWith("Only the foundation can make this call");
//
//    expect(await blankArt.foundationAddress()).to.equal(_owner.address);
//  });
//
//  it.skip("should allow you to update the tokenURI if it is not locked", async () => {
//    // updateTokenURI
//    const [_owner, addr1] = await ethers.getSigners();
//
//    // await blankArt.
//
//    await expect(blankArt.connect(addr1).updateFoundationAddress(addr2.address)).to.be.revertedWith("Only the foundation can make this call");
//
//    expect(await blankArt.foundationAddress()).to.equal(_owner.address);
//  })
  

});