const { expect } = require("chai");
const { ethers } = require("hardhat");
const { LazyMinter } = require('../lib');

describe("BlankArt", function () {
  let blankArt;

  // Sample ArWeave URIs for testing only. Can replace with legitimate hashes once created.
  let arWeaveURI = new Array();
  arWeaveURI.push("ar://123456789/");
  arWeaveURI.push("ar://987654321/");

  async function deploy(maxTokenSupply) {
      const [minter, redeemer, _] = await ethers.getSigners()

      let factory = await ethers.getContractFactory("BlankArt")
      if(isNaN(maxTokenSupply))
        maxTokenSupply = 10000
      const contract = await factory.deploy(minter.address, maxTokenSupply, arWeaveURI[0])

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
  });

  it("Should redeem 5 free Blank NFTs from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(5, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', redeemer.address, contract.tokenIndex - 1)
  });

  it("Should error on an attempt to mint more than 5 Blank NFTs from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    const amount = 6;
    await expect(redeemerContract.redeemVoucher(amount, voucher))
      .to.be.revertedWith("Amount is more than the minting limit");
  });

  it("Should error on an attempt to mint twice for more than max amount total", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(2, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', minter.address, contract.tokenIndex - 1)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      //.withArgs(minter.address, redeemer.address, contract.tokenIndex - 1);

    await expect(redeemerContract.redeemVoucher(4, voucher))
      .to.be.revertedWith("Amount is more than the minting limit");
  });

  it("Should error on an attempt to redeem a voucher from the wrong address", async function() {
    const { contract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(contract.connect(addr2).redeemVoucher(1, voucher))
      .to.be.revertedWith("Voucher is for a different wallet address");
  });

  it("Should not allow a token to be locked by the Foundation address", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()
    await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURI is correct
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1");

    //Lock the tokenURIs
    await expect(contract.connect(minter).lockTokenURI(2))
      .to.be.revertedWith("Invalid: Only the owner can lock their token");
  });

  it("Should not allow a token to be locked by another address", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURI is correct
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1");

    //Lock the tokenURIs
    await expect(contract.connect(addr2).lockTokenURI(2))
      .to.be.revertedWith("Invalid: Only the owner can lock their token");
  });

  it("Should allow the Foundation to evolve the NFTs", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURIs are correct (v1)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1");

    //Evolve the NFTs
    await contract.connect(minter).addBaseURI(arWeaveURI[1]);

    //Verify tokenURIs are correct (v2)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[1] + "1");

  });

  it("Should not allow an address other than the Foundation to evolve the NFTs", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURIs are correct (v1)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1");

    //Evolve the NFTs
    await expect(contract.connect(redeemer).addBaseURI(arWeaveURI[1]))
      .to.be.revertedWith("Only the foundation can make this call");
  });

  it("Should return the correct tokenURIs for both locked and unlocked NFTs", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify all tokenURIs are correct (v1)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1");

    expect(await redeemerContract.tokenURI(2)).to.equal(arWeaveURI[0] + "2");

    expect(await redeemerContract.tokenURI(3)).to.equal(arWeaveURI[0] + "3");

    //Lock one of the tokenURIs
    await redeemerContract.lockTokenURI(2);

    //Evolve the NFTs
    await contract.addBaseURI(arWeaveURI[1]);

    // Expect to be on the v2 URI
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[1] + "1");

    // Expect to be locked back to the v1 URI
    expect(await redeemerContract.tokenURI(2)).to.equal(arWeaveURI[0] + "2");

    // Expect to be on the v2 URI
    expect(await redeemerContract.tokenURI(3)).to.equal(arWeaveURI[1] + "3");

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

  it("Should withdraw for the correct amount of payment", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(redeemer.address, minPrice)

    // the payment should be sent from the redeemer's account to the contract address
    await expect(await redeemerContract.redeemVoucher(5, voucher, { value: minPrice.mul(5) }))
      .to.changeEtherBalances([redeemer, contract], [minPrice.mul(-5), minPrice.mul(5)])

    // minter should have funds available to withdraw
    expect(await contract.availableToWithdraw()).to.equal(minPrice.mul(5))

    // withdrawal should increase minter's balance
    await expect(await contract.withdraw())
      .to.changeEtherBalance(minter, minPrice.mul(5))

    // minter should now have zero available
    expect(await contract.availableToWithdraw()).to.equal(0)
  })

  it("should allow you to update the foundation address", async () => {
    const { contract, redeemer, minter } = await deploy()

    expect(await contract.foundationAddress()).to.equal(minter.address);

    await contract.updateFoundationAddress(redeemer.address);

    expect(await contract.foundationAddress()).to.equal(redeemer.address);
  });

  it("should not allow you to update the foundation address from the wrong sender", async () => {
    const { contract, redeemer, minter } = await deploy()
    await ethers.getSigners()

    expect(await contract.foundationAddress()).to.equal(minter.address);

    await expect(contract.connect(redeemer).updateFoundationAddress(minter.address)).to.be.revertedWith("Only the foundation can make this call");

    expect(await contract.foundationAddress()).to.equal(minter.address);
  });

  it("should allow you to update the mint price", async () => {
    const { contract, redeemerContract, redeemer, minter } = await deploy()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.mintPrice()).to.equal(0);

    await contract.updateMintPrice(price);

    expect(await contract.mintPrice()).to.equal(price);
  });

  it("should not allow you to update the mint price from the wrong sender", async () => {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.mintPrice()).to.equal(0);

    await expect(contract.connect(addr2).updateMintPrice(price)).to.be.revertedWith("Only the foundation can make this call");

    expect(await contract.mintPrice()).to.equal(0);
  });

  it("Should not allow you to mint up to 5 Blank NFTs if public minting is not enabled", async function() {
    const { redeemerContract } = await deploy()

    await expect(redeemerContract.mint(5)).to.be.revertedWith("Public minting is not active.");
  });

  it("should allow the foundation to update the public mint period", async () => {
    const { contract } = await deploy()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(false);
  });

  it("should not allow you to update the public mint period from the wrong sender", async () => {

    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await expect(contract.connect(addr2).togglePublicMint()).to.be.revertedWith("Only the foundation can make this call");

    expect(await contract.publicMint()).to.equal(false);
  });

  it("Should allow anyone to mint one Blank NFT for free if public minting is enabled", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await expect(contract.connect(addr2).mint(1))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', redeemer.address, contract.tokenIndex - 1)
  });

  it("Should allow anyone to mint up to 5 Blank NFTs for free if public minting is enabled", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await expect(contract.connect(addr2).mint(5))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', redeemer.address, contract.tokenIndex - 1)
  });

  it("Should error on an attempt to mint more than 5 Blank NFTs during public minting", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await expect(contract.connect(addr2).mint(6))
      .to.be.revertedWith("Amount is more than the minting limit");
  });
  it("Should error on an attempt to mint twice for more than max amount total", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await expect(contract.connect(addr2).mint(2))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', redeemer.address, contract.tokenIndex - 1)

      await expect(contract.connect(addr2).mint(4))
      .to.be.revertedWith("Amount is more than the minting limit");
  });

  it("Should allow anyone to mint one Blank NFT if public minting is enabled, mint price is set and payment is conveyed", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    expect(await contract.mintPrice()).to.equal(0);

    await contract.updateMintPrice(price);

    expect(await contract.mintPrice()).to.equal(price);

    const payment = price;

    await expect(contract.connect(addr2).mint(1, { value: payment }))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', redeemer.address, contract.tokenIndex - 1)
  });

  it("Should allow anyone to mint 5 Blank NFTs if public minting is enabled, mint price is set and payment is conveyed", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    expect(await contract.mintPrice()).to.equal(0);

    await contract.updateMintPrice(price);

    expect(await contract.mintPrice()).to.equal(price);

    const payment = price.mul(5);

    await expect(contract.connect(addr2).mint(5, { value: payment }))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', redeemer.address, contract.tokenIndex - 1)
  });

  it("Should not allow anyone to mint one Blank NFT if public minting is enabled and mint price is set but payment is not sufficient", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    expect(await contract.mintPrice()).to.equal(0);

    await contract.updateMintPrice(price);

    expect(await contract.mintPrice()).to.equal(price);

    const payment = price.sub(1000);

    await expect(contract.connect(addr2).mint(1, { value: payment }))
      .to.be.revertedWith('Insufficient funds to mint')
  });

  it("Should not allow anyone to mint 5 Blank NFT if public minting is enabled and mint price is set but payment is not sufficient", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    expect(await contract.mintPrice()).to.equal(0);

    await contract.updateMintPrice(price);

    expect(await contract.mintPrice()).to.equal(price);

    const payment = price.mul(4);

    await expect(contract.connect(addr2).mint(5, { value: payment }))
      .to.be.revertedWith('Insufficient funds to mint')
  });

  it("Should not allow more than the maxSupply of NFTs to be minted", async function() {
    // Set the max to 25 to allow the test to complete
    const testMaxToken = 25;
    const { contract } = await deploy(testMaxToken)
    const [_, __, addr2, addr3, addr4, addr5, addr6, addr7] = await ethers.getSigners()
    const price = ethers.constants.WeiPerEther // charge 1 Eth

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    expect(await contract.mintPrice()).to.equal(0);

    await contract.updateMintPrice(price);

    expect(await contract.mintPrice()).to.equal(price);

    const payment = price.mul(5);
    const maxSupply = await contract.maxTokenSupply();

    // Mint 5 (max allowed) NFTs per address until all (25) have been minted.
    await expect(contract.connect(addr2).mint(5, { value: payment }))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter

    await expect(contract.connect(addr3).mint(5, { value: payment }))
    .to.emit(contract, 'Transfer')  // transfer from null address to minter

    await expect(contract.connect(addr4).mint(5, { value: payment }))
    .to.emit(contract, 'Transfer')  // transfer from null address to minter

    await expect(contract.connect(addr5).mint(5, { value: payment }))
    .to.emit(contract, 'Transfer')  // transfer from null address to minter

    await expect(contract.connect(addr6).mint(5, { value: payment }))
    .to.emit(contract, 'Transfer')  // transfer from null address to minter

    // Attempt to mint an extra NFT
    await expect(contract.connect(addr7).mint(1, { value: payment }))
      .to.be.revertedWith('All tokens have already been minted')
  });

  it("Should emit a valid tokenURI in the Mint event params", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await expect(contract.connect(addr2).mint(1))
        .to.emit(contract, 'Minted')
        .withArgs(1, addr2.address, arWeaveURI[0] + '1');
  });
});
