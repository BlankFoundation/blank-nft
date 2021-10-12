const ethers = require('ethers')

// These constants must match the ones used in the smart contract.
const SIGNING_DOMAIN_NAME = "BlankNFT"
const SIGNING_DOMAIN_VERSION = "1"

/**
 * JSDoc typedefs.
 *
 * @typedef {object} BlankNFTVoucher
 * @property {ethers.BigNumber | number} minPrice the minimum price (in wei) that the creator will accept to redeem this NFT
 * @property {ethers.BytesLike} signature an EIP-712 signature of all fields in the NFTVoucher, apart from signature itself.
 */

/**
 * LazyMinter is a helper class that creates BlankNFTVoucher objects and signs them, to be redeemed later by the BlankArt contract.
 */
class LazyMinter {

  /**
   * Create a new LazyMinter targeting a deployed instance of the LazyNFT contract.
   *
   * @param {Object} options
   * @param {ethers.Contract} contract an ethers Contract that's wired up to the deployed contract
   * @param {ethers.Signer} signer a Signer whose account is authorized to mint NFTs on the deployed contract
   */
  constructor({ contract, signer }) {
    this.contract = contract
    this.signer = signer
  }

  /**
   * Creates a new BlankNFTVoucher object and signs it using this LazyMinter's signing key.
   *
   * @param {address} redeemerAddress the address authorized to redeem the voucher
   * @param {ethers.BigNumber | number} minPrice the minimum price (in wei) that the creator will accept to redeem this NFT. defaults to zero
   *
   * @returns {BlankNFTVoucher}
   */
  async createVoucher(redeemerAddress, minPrice = 0) {
    const voucher = { redeemerAddress, minPrice }
    const domain = await this._signingDomain()
    const types = {
      BlankNFTVoucher: [
        {name: "redeemerAddress", type: "address"},
        {name: "minPrice", type: "uint256"},
      ]
    }
    const signature = await this.signer._signTypedData(domain, types, voucher)
    return {
      ...voucher,
      signature,
    }
  }

  /**
   * @private
   * @returns {object} the EIP-721 signing domain, tied to the chainId of the signer
   */
  async _signingDomain() {
    if (this._domain != null) {
      return this._domain
    }
    const chainId = await this.contract.getChainID()
    this._domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      verifyingContract: this.contract.address,
      chainId,
    }
    return this._domain
  }
}

module.exports = {
  LazyMinter
}
