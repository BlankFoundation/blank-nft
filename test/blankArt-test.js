const { expect } = require("chai");
const { ethers } = require("hardhat");
const { LazyMinter } = require('../lib');

describe("BlankArt", function () {
  let blankArt;

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

  it("should allow you to check membership if an address has minted", async () => {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    expect(await contract.isMember(redeemer.address)).to.equal(false);

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher()

    await redeemerContract.redeemVoucher(redeemer.address, 1, voucher)

    expect(await contract.isMember(redeemer.address)).to.equal(true);
  });
    it("Should fail to redeem an NFT voucher that's signed by an unauthorized account", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher()

    await expect(redeemerContract.redeemVoucher(redeemer.address, 1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher that's been modified", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(10)
    voucher.minPrice = 0
    await expect(redeemerContract.redeemVoucher(redeemer.address, 1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher with an invalid signature", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher()

    const dummyData = ethers.utils.randomBytes(128)
    voucher.signature = await minter.signMessage(dummyData)

    await expect(redeemerContract.redeemVoucher(redeemer.address, 1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });
  it("Should fail to redeem if payment is < minPrice", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(minPrice)

    const payment = minPrice.sub(10000)
    await expect(redeemerContract.redeemVoucher(redeemer.address, 1, voucher, { value: payment }))
      .to.be.revertedWith('Insufficient funds to redeem')
  })

  it("Should make payments available to minter for withdrawal", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(minPrice)

    // the payment should be sent from the redeemer's account to the contract address
    await expect(await redeemerContract.redeemVoucher(redeemer.address, 1, voucher, { value: minPrice }))
      .to.changeEtherBalances([redeemer, contract], [minPrice.mul(-1), minPrice])

    // minter should have funds available to withdraw
    expect(await contract.availableToWithdraw()).to.equal(minPrice)

    // withdrawal should increase minter's balance
    await expect(await contract.withdraw())
      .to.changeEtherBalance(minter, minPrice)

    // minter should now have zero available
    expect(await contract.availableToWithdraw()).to.equal(0)
  })


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