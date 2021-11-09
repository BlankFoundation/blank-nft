async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)

  console.log('Account balance:', (await deployer.getBalance()).toString())

  const BlankArt = await ethers.getContractFactory('BlankArt')
  const blankArt = await BlankArt.deploy(deployer.address, 10000)

  // Start deployment, returning a promise that resolves to a contract object
  await blankArt.deployed()
  console.log('Contract deployed to address:', blankArt.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
