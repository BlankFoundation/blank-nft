async function main() {
  const BlankArt = await ethers.getContractFactory("BlankArt")
  const blankArt = await BlankArt.deploy("BlankArt", "BLANK", 10000, ethers.);

  // Start deployment, returning a promise that resolves to a contract object
  await blankNFT.deployed();
  console.log("Contract deployed to address:", blankArt.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });