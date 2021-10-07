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
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', minter.address, contract.tokenIndex - 1)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      //.withArgs(minter.address, redeemer.address, contract.tokenIndex - 1);
  });
  it("Should redeem 5 free Blank NFTs from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(5, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', minter.address, contract.tokenIndex - 1)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      //.withArgs(minter.address, redeemer.address, contract.tokenIndex - 1);
  });
  it("Should error on an attempt to mint more than 5 Blank NFTs from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    const amount = 6;
    await expect(redeemerContract.redeemVoucher(amount, voucher))
      .to.be.revertedWith("Amount is more than the minting limit");
  });
  it("Should error on an attempt to redeem a voucher from the wrong address", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(contract.connect(addr2).redeemVoucher(1, voucher))
      .to.be.revertedWith("Voucher is for a different wallet address");
  });

  it("should allow you to check membership if an address has minted", async () => {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    expect(await contract.isMember(redeemer.address)).to.equal(false);

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await redeemerContract.redeemVoucher(1, voucher)

    expect(await contract.isMember(redeemer.address)).to.equal(true);
  });
    it("Should fail to redeem an NFT voucher that's signed by an unauthorized account", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher that's been modified", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(redeemer.address, 10)
    voucher.minPrice = 0
    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher with an invalid signature", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    const dummyData = ethers.utils.randomBytes(128)
    voucher.signature = await minter.signMessage(dummyData)

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });
  it("Should fail to redeem if payment is < minPrice", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(redeemer.address, minPrice)

    const payment = minPrice.sub(10000)
    await expect(redeemerContract.redeemVoucher(1, voucher, { value: payment }))
      .to.be.revertedWith('Insufficient funds to redeem')
  })

  it("Should make payments available to minter for withdrawal", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(redeemer.address, minPrice)

    // the payment should be sent from the redeemer's account to the contract address
    await expect(await redeemerContract.redeemVoucher(1, voucher, { value: minPrice }))
      .to.changeEtherBalances([redeemer, contract], [minPrice.mul(-1), minPrice])

    // minter should have funds available to withdraw
    expect(await contract.availableToWithdraw()).to.equal(minPrice)

    // withdrawal should increase minter's balance
    await expect(await contract.withdraw())
      .to.changeEtherBalance(minter, minPrice)

    // minter should now have zero available
    expect(await contract.availableToWithdraw()).to.equal(0)
  })
  it("should allow you to update the foundation address", async () => {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    expect(await contract.foundationAddress()).to.equal(minter.address);

    await contract.updateFoundationAddress(redeemer.address);

    expect(await contract.foundationAddress()).to.equal(redeemer.address);
  });

  it("should not allow you to update the foundation address from the wrong sender", async () => {

    const { contract, redeemerContract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.foundationAddress()).to.equal(minter.address);

    await expect(contract.connect(redeemer).updateFoundationAddress(minter.address)).to.be.revertedWith("Only the foundation can make this call");

    expect(await contract.foundationAddress()).to.equal(minter.address);
  });

  it.skip("should allow you to update the tokenURI if it is not locked", async () => {
    // updateTokenURI

  })
  

});