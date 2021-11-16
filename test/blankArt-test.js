const { expect } = require("chai");
const { ethers } = require("hardhat");
const { LazyMinter } = require('../lib');

const _INTERFACE_ID_ERC165 = '0x01ffc9a7';
const _INTERFACE_ID_ROYALTIES_EIP2981 = '0x2a55205a';
const _INTERFACE_ID_ERC721 = '0x80ac58cd';

describe("BlankArt", function () {
  let blankArt;

  // Sample ArWeave URIs for testing only. Can replace with legitimate hashes once created.
  let arWeaveURI = new Array();
  arWeaveURI.push("https://arweave.net/4usQHuUrIKOMahMjSlgYsPKjOp2wPSP8Z8Qs6NmcT_k/");
  arWeaveURI.push("https://arweave.net/hash2/");

  const royaltyBPS = 1000; //10%.

  const voucherExpiration = 86400; //Voucher expires in 24 hours.
  const expiration = (Math.floor( Date.now() / 1000 )+voucherExpiration);

  async function deploy(maxTokenSupply) {
      const [minter, redeemer, _] = await ethers.getSigners()

      let factory = await ethers.getContractFactory("BlankArt")
      if(isNaN(maxTokenSupply))
        maxTokenSupply = 10000
      const contract = await factory.deploy(minter.address, maxTokenSupply, arWeaveURI[0], royaltyBPS)

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

    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration);

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      .to.emit(contract, 'Minted')
      .withArgs(1, redeemer.address, arWeaveURI[0] + '1.json');
  });

  it("Should redeem 5 free Blank NFTs from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(5, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      .to.emit(contract, 'Minted')
      .withArgs(1, redeemer.address, arWeaveURI[0] + '1.json')
      .withArgs(2, redeemer.address, arWeaveURI[0] + '2.json')
  });

  it("Should redeem 10 free Blank NFTs from a signed voucher with a limit of 10", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration, 0, 10)

    // Set the maxMint count to 10.
    await contract.updateMaxMintCount(10);

    await expect(redeemerContract.redeemVoucher(10, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter

    expect(await contract.balanceOf(redeemer.address)).to.equal(10);
  });

  it("Should allow an address to redeem multiple distinct vouchers, within the maxMint limit", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(2, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter

    // Utilize a different expiration date to differentiate the voucher hash.
    let voucher2Expiration = (Math.floor( Date.now() / 1000 ) + 86400);
    const voucher2 = await lazyMinter.createVoucher(redeemer.address, voucher2Expiration)

    await expect(redeemerContract.redeemVoucher(2, voucher2))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter

    expect(await contract.balanceOf(redeemer.address)).to.equal(4);
  });

  it("Should allow an address to redeem multiple distinct vouchers, within the maxMint limit", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    // Set the maxMint count to 10.
    await contract.updateMaxMintCount(10);

    await expect(redeemerContract.redeemVoucher(5, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter

    // Utilize a different expiration date to differentiate the voucher hash.
    let voucher2Expiration = (Math.floor( Date.now() / 1000 ) + 86400);
    const voucher2 = await lazyMinter.createVoucher(redeemer.address, voucher2Expiration)

    await expect(redeemerContract.redeemVoucher(5, voucher2))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter

    expect(await contract.balanceOf(redeemer.address)).to.equal(10);
  });

  it("Should error on an attmpt to redeem more Blank NFTs than the voucher allows", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration, 0, 3)

    await expect(redeemerContract.redeemVoucher(5, voucher))
    .to.be.revertedWith("Amount is more than the voucher allows");
  });

  it("Should error on an attempt to mint more than 5 Blank NFTs from a signed voucher", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    const amount = 6;
    await expect(redeemerContract.redeemVoucher(amount, voucher))
      .to.be.revertedWith("Amount is more than the minting limit");
  });

  it("Should error on an attempt to redeem twice for more than max amount total", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(2, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', minter.address, contract.tokenIndex - 1)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      //.withArgs(minter.address, redeemer.address, contract.tokenIndex - 1);

    await expect(redeemerContract.redeemVoucher(4, voucher))
      .to.be.revertedWith("Amount is more than the minting limit");
  });

  it("Should error on an attempt to redeem twice using the same voucher, even if total is below the max mint amount", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(2, voucher))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      //.withArgs('0x0000000000000000000000000000000000000000', minter.address, contract.tokenIndex - 1)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      //.withArgs(minter.address, redeemer.address, contract.tokenIndex - 1);

    await expect(redeemerContract.redeemVoucher(2, voucher))
      .to.be.revertedWith("Voucher has already been claimed");
  });

  it("Should error on an attempt to redeem a voucher while redemption is paused", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })

    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration);

    // Pause Redemption
    await contract.toggleActivation();

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith("Voucher redemption is not currently active");
  });

  it("Should error on an attempt to redeem a voucher from the wrong address", async function() {
    const { contract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(contract.connect(addr2).redeemVoucher(1, voucher))
      .to.be.revertedWith("Voucher is for a different wallet address");
  });

  it("Should not allow a token to be locked by the Foundation address", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()
    await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURI is correct
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1.json");

    //Lock the tokenURIs
    await expect(contract.connect(minter).lockTokenURI(2))
      .to.be.revertedWith("Invalid: Only the owner can lock their token");
  });

  it("Should not allow a token to be locked by another address", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURI is correct
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1.json");

    //Lock the tokenURIs
    await expect(contract.connect(addr2).lockTokenURI(2))
      .to.be.revertedWith("Invalid: Only the owner can lock their token");
  });

  it("Should allow the Foundation to evolve the NFTs", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURIs are correct (v1)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1.json");

    //Evolve the NFTs
    await contract.connect(minter).addBaseURI(arWeaveURI[1]);

    //Verify tokenURIs are correct (v2)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[1] + "1.json");

  });

  it("Should not allow an address other than the Foundation to evolve the NFTs", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify tokenURIs are correct (v1)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1.json");

    //Evolve the NFTs
    await expect(contract.connect(redeemer).addBaseURI(arWeaveURI[1]))
      .to.be.revertedWith("Only the foundation can make this call");
  });

  it("Should return the correct tokenURIs for both locked and unlocked NFTs", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(3, voucher))
      .to.emit(contract, 'Transfer');

    //Verify all tokenURIs are correct (v1)
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[0] + "1.json");

    expect(await redeemerContract.tokenURI(2)).to.equal(arWeaveURI[0] + "2.json");

    expect(await redeemerContract.tokenURI(3)).to.equal(arWeaveURI[0] + "3.json");

    //Lock one of the tokenURIs
    await redeemerContract.lockTokenURI(2);

    //Evolve the NFTs
    await contract.addBaseURI(arWeaveURI[1]);

    // Expect to be on the v2 URI
    expect(await redeemerContract.tokenURI(1)).to.equal(arWeaveURI[1] + "1.json");

    // Expect to be locked back to the v1 URI
    expect(await redeemerContract.tokenURI(2)).to.equal(arWeaveURI[0] + "2.json");

    // Expect to be on the v2 URI
    expect(await redeemerContract.tokenURI(3)).to.equal(arWeaveURI[1] + "3.json");

  });

  it("should allow you to check membership if an address has minted", async () => {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    expect(await contract.isMember(redeemer.address)).to.equal(false);

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await redeemerContract.redeemVoucher(1, voucher)

    expect(await contract.isMember(redeemer.address)).to.equal(true);
  });

  it("Should fail to redeem an NFT voucher that's signed by an unauthorized account", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher that's been modified", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration, 10)
    voucher.minPrice = 0
    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher with an invalid signature", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const signers = await ethers.getSigners()
    const rando = signers[signers.length-1];

    const lazyMinter = new LazyMinter({ contract, signer: rando })
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration)

    const dummyData = ethers.utils.randomBytes(128)
    voucher.signature = await minter.signMessage(dummyData)

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  it("Should fail to redeem an NFT voucher that's expired", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })

    let expired = (Math.floor( Date.now() / 1000 )-1);
    const voucher = await lazyMinter.createVoucher(redeemer.address, expired);

    await expect(redeemerContract.redeemVoucher(1, voucher))
      .to.be.revertedWith('Voucher has expired')
  });

  it("Should fail to redeem if payment is < minPrice", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration, minPrice)

    const payment = minPrice.sub(10000)
    await expect(redeemerContract.redeemVoucher(1, voucher, { value: payment }))
      .to.be.revertedWith('Insufficient funds to redeem')
  })

  it("Should make payments available to minter for withdrawal", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter({ contract, signer: minter })
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration, minPrice)

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
    const voucher = await lazyMinter.createVoucher(redeemer.address, expiration, minPrice)

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

  it("Should error on an attempt to mint one Blank NFT for free if public minting is enabled but minting is paused", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    expect(await contract.active()).to.equal(true);

    await contract.toggleActivation();

    expect(await contract.active()).to.equal(false);

    await expect(contract.connect(addr2).mint(1))
      .to.be.revertedWith("Public minting is not active.");
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

  it("should allow the foundation to pause/unpause the redemption period", async () => {
    const { contract } = await deploy()

    expect(await contract.active()).to.equal(true);

    await contract.toggleActivation();

    expect(await contract.active()).to.equal(false);

    await contract.toggleActivation();

    expect(await contract.active()).to.equal(true);
  });

  it("should not allow you to pause/unpause the redemption period from the wrong sender", async () => {

    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.active()).to.equal(true);

    await expect(contract.connect(addr2).toggleActivation()).to.be.revertedWith("Only the foundation can make this call");

    expect(await contract.active()).to.equal(true);
  });

  it("should allow the foundation to update the maxMintCount backstop", async () => {
    const { contract } = await deploy()

    expect(await contract.memberMaxMintCount()).to.equal(5);

    await contract.updateMaxMintCount(10);

    expect(await contract.memberMaxMintCount()).to.equal(10);

    await contract.updateMaxMintCount(7);

    expect(await contract.memberMaxMintCount()).to.equal(7);
  });

  it("should not allow you to update the maxMintCount backstop from the wrong sender", async () => {

    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.memberMaxMintCount()).to.equal(5);

    await expect(contract.connect(addr2).updateMaxMintCount(10)).to.be.revertedWith("Only the foundation can make this call");

    expect(await contract.memberMaxMintCount()).to.equal(5);
  });

  it("should return the correct royaltyInfo", async () => {
    const { contract, redeemer, minter } = await deploy()

    const salePrice = ethers.constants.WeiPerEther // sell for 1 Eth

    let response = await contract.royaltyInfo(1,salePrice);
    expect(response[1]).to.equal(salePrice.div(10));
    expect(response[0]).to.equal(minter.address);

    response = await contract.royaltyInfo(1,salePrice.div(10));
    expect(response[1]).to.equal(salePrice.div(100));
    expect(response[0]).to.equal(minter.address);
  });

  it("should allow the foundation to update the royalty information", async () => {
    const { contract, redeemer, minter } = await deploy()

    const salePrice = ethers.constants.WeiPerEther // sell for 1 Eth
    const updatedRoyaltyBPS = 500 // 5%
    
    let response = await contract.royaltyInfo(1,salePrice);
    expect(response[1]).to.be.equal(salePrice.div(10));
    expect(response[0]).to.be.equal(minter.address);

    await contract.setDefaultRoyalty(redeemer.address, updatedRoyaltyBPS);

    response = await contract.royaltyInfo(1,salePrice);
    expect(response[1]).to.be.equal(salePrice.div(20));
    expect(response[0]).to.be.equal(redeemer.address);

  });

  it("should not allow you to update the royalty information from the wrong sender", async () => {
    const { contract, redeemer, minter } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()
        
    const salePrice = ethers.constants.WeiPerEther // sell for 1 Eth
    
    let response = await contract.royaltyInfo(1,salePrice);
    expect(response[1]).to.be.equal(salePrice.div(10));
    expect(response[0]).to.be.equal(minter.address);

    await expect(contract.connect(addr2).setDefaultRoyalty(redeemer.address, 500)).to.be.revertedWith("Only the foundation can make this call");
    
    response = await contract.royaltyInfo(1,salePrice);
    expect(response[1]).to.be.equal(salePrice.div(10));
    expect(response[0]).to.be.equal(minter.address);

  });

  it('should support 0 royalties', async function () {
    const { contract, redeemer, minter } = await deploy()
    
    const salePrice = ethers.constants.WeiPerEther // sell for 1 Eth
    
    let response = await contract.royaltyInfo(1,salePrice);
    expect(response[1]).to.be.equal(salePrice.div(10));
    expect(response[0]).to.be.equal(minter.address);

    await contract.setDefaultRoyalty(minter.address, 0);

    response = await contract.royaltyInfo(1,salePrice);
    expect(response[1].toNumber()).to.be.equal(0);
    expect(response[0]).to.be.equal(minter.address);
  });
  
  it('should support the correct interfaces', async function () {
    const { contract, redeemer, minter } = await deploy()

    expect(
        await contract.supportsInterface(
            _INTERFACE_ID_ERC165,
        ),
        'Error Royalties 165',
    ).to.be.true;
    
    expect(
        await contract.supportsInterface(
            _INTERFACE_ID_ROYALTIES_EIP2981,
        ),
        'Error Royalties 2981',
    ).to.be.true;

    expect(
        await contract.supportsInterface(
            _INTERFACE_ID_ERC721,
        ),
        'Error Royalties 721',
    ).to.be.true;
  });

  it("Should emit a valid tokenURI in the Mint event params", async function() {
    const { contract } = await deploy()
    const [_, __, addr2] = await ethers.getSigners()

    expect(await contract.publicMint()).to.equal(false);

    await contract.togglePublicMint();

    expect(await contract.publicMint()).to.equal(true);

    await expect(contract.connect(addr2).mint(1))
        .to.emit(contract, 'Minted')
        .withArgs(1, addr2.address, arWeaveURI[0] + '1.json');
  });

  it("Should emit Initialized event during deploy", async function() {
    const [minter, redeemer, _] = await ethers.getSigners()
    let factory = await ethers.getContractFactory("BlankArt")
    let interface = factory.interface

    const maxTokenSupply = 10000
    const baseTokenUri = arWeaveURI[0]
    const controller = minter.address
    const royaltyBPS = 1000 //10%

    const unsignedTx = factory.getDeployTransaction(controller, maxTokenSupply, baseTokenUri, royaltyBPS);
    const tx = await factory.signer.sendTransaction(unsignedTx);
    const receipt = await tx.wait(1)
    const parsedLog = interface.parseLog(receipt.logs[1])

    expect(parsedLog.name).to.equal('Initialized')
    expect(parsedLog.signature).to.equal('Initialized(address,string,uint256,uint256,uint256,bool,bool)')
    expect(parsedLog.args).to.have.property('controller', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
    expect(parsedLog.args).to.have.property('baseURI', baseTokenUri)
    expect(parsedLog.args.mintPrice).to.equal(0)
    expect(parsedLog.args.maxTokenSupply).to.equal(maxTokenSupply)
    expect(parsedLog.args.foundationSalePercentage).to.equal(50)
    expect(parsedLog.args).to.have.property('active', true)
    expect(parsedLog.args).to.have.property('publicMint', false)
  })
});
