async function main() {
  const artFactory = await ethers.getContractFactory('BlankArt')
  const blankArt = await artFactory.deploy('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 10000)

  console.log('Contract deployed to address:', blankArt.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
