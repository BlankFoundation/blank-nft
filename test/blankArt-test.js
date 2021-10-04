const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlankArt", function () {
  let blankArt;

  this.beforeEach(async () => {
    const BlankArt = await ethers.getContractFactory("BlankArt");
    blankArt = await BlankArt.deploy(10000);

    await blankArt.deployed();
  })

  it("should allow you to add a member", async () => {
    const [_owner, addr1] = await ethers.getSigners();
    
    expect(await blankArt.isMember(addr1.address)).to.equal(false);

    await blankArt.addMember(addr1.address);

    expect(await blankArt.isMember(addr1.address)).to.equal(true);
  });

  it("should not allow you to add a member if the sender is not the foundation address", async () => {
    const [_owner, addr1, addr2] = await ethers.getSigners();
    
    expect(await blankArt.isMember(addr2.address)).to.equal(false);

    await expect(blankArt.connect(addr1).addMember(addr2.address)).to.be.revertedWith("Only the foundation can make this call");

    expect(await blankArt.isMember(addr2.address)).to.equal(false);
  });

  it("should allow you to revoke a member", async () => {
    const [_owner, addr1] = await ethers.getSigners();
    
    await blankArt.addMember(addr1.address);
    
    expect(await blankArt.isMember(addr1.address)).to.equal(true);

    await blankArt.revokeMember(addr1.address);

    expect(await blankArt.isMember(addr1.address)).to.equal(false);
  });

  it("should not allow you to revoke a member if the sender is not the foundation address", async () => {
    const [_owner, addr1, addr2] = await ethers.getSigners();

    await blankArt.addMember(addr2.address);
    
    expect(await blankArt.isMember(addr2.address)).to.equal(true);

    await expect(blankArt.connect(addr1).revokeMember(addr2.address)).to.be.revertedWith("Only the foundation can make this call");

    expect(await blankArt.isMember(addr2.address)).to.equal(true);
  });
  
  it("should allow you to update the foundation address", async () => {
    const [_owner, addr1] = await ethers.getSigners();
    
    expect(await blankArt.foundationAddress()).to.equal(_owner.address);

    await blankArt.updateFoundationAddress(addr1.address);
    
    expect(await blankArt.foundationAddress()).to.equal(addr1.address);
  });

  it("should not allow you to update the foundation address from the wrong sender", async () => {
    const [_owner, addr1, addr2] = await ethers.getSigners();
    
    expect(await blankArt.foundationAddress()).to.equal(_owner.address);

    await expect(blankArt.connect(addr1).updateFoundationAddress(addr2.address)).to.be.revertedWith("Only the foundation can make this call");
    
    expect(await blankArt.foundationAddress()).to.equal(_owner.address);
  });

  it.skip("should allow you to update the tokenURI if it is not locked", async () => {
    // updateTokenURI
    const [_owner, addr1] = await ethers.getSigners();
    
    // await blankArt.

    await expect(blankArt.connect(addr1).updateFoundationAddress(addr2.address)).to.be.revertedWith("Only the foundation can make this call");
    
    expect(await blankArt.foundationAddress()).to.equal(_owner.address);
  })
  

});