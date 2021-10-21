// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract BlankArt is ERC721, EIP712, ERC721URIStorage {
    // An event whenever the foundation address is updated
    event FoundationAddressUpdated(address foundationAddress);

    event MemberAdded(address member);

    event MemberRevoked(address member);

    event TokenUriUpdated(uint256 tokenId, string tokenURI);

    event Minted(uint256 tokenId, address member, string tokenURI);

    // if a token's URI has been locked or not
    mapping(uint256 => bool) public tokenURILocked;
    // signing domain
    string private constant SIGNING_DOMAIN = "BlankNFT";
    // signature version
    string private constant SIGNATURE_VERSION = "1";
    // the percentage of sale that the foundation gets on secondary sales
    uint256 public foundationSalePercentage;
    // gets incremented to placehold for tokens not minted yet
    uint256 public expectedTokenSupply;
    // cost to mint during the public sale
    uint256 public mintPrice;
    // Enables/Disables public minting (without a whitelisted voucher)
    bool public publicMint;
    // the address of the platform (for receiving commissions and royalties)
    address payable public foundationAddress;
    // pending withdrawals by account address
    mapping(address => uint256) pendingWithdrawals;
    // Number of tokens minted by account
    mapping(address => uint8) private _memberMintCount;
    // Max number of tokens a member can mint
    uint8 public memberMaxMintCount;
    // current token index
    uint256 public tokenIndex;

    constructor(address payable _foundationAddress, uint256 initialExpectedTokenSupply)
        ERC721("BlankArt", "BLANK")
        EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION)
    {
        foundationSalePercentage = 50;
        memberMaxMintCount = 5;
        foundationAddress = _foundationAddress;
        expectedTokenSupply = initialExpectedTokenSupply;
        require(expectedTokenSupply > 0);
        tokenIndex = 1;
        mintPrice = 0;
        publicMint = false;
    }

    /// @notice Represents a voucher to claim any un-minted NFT (up to memberMaxMintCount), which has not yet been recorded into the blockchain. A signed voucher can be redeemed for real NFTs using the redeemVoucher function.
    struct BlankNFTVoucher {
        /// @notice address of intended redeemer
        address redeemerAddress;
        /// @notice The minimum price (in wei) that the NFT creator is willing to accept for the initial sale of this NFT.
        uint256 minPrice;
        /// @notice the EIP-712 signature of all other fields in the NFTVoucher struct. For a voucher to be valid, it must be signed by an account with the MINTER_ROLE.
        bytes signature;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    // modifier for only allowing the foundation to make a call
    modifier onlyFoundation() {
        require(msg.sender == foundationAddress, "Only the foundation can make this call");
        _;
    }

    function isMember(address account) external view returns (bool) {
        return (_memberMintCount[account] > 0);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function _checkMemberMintCount(address account) internal view {
        if (_memberMintCount[account] >= memberMaxMintCount) {
            revert(
                string(
                    abi.encodePacked(
                        "Account ",
                        Strings.toHexString(uint160(account), 20),
                        " has reached its minting limit of ",
                        memberMaxMintCount,
                        ", so cannot mint"
                    )
                )
            );
        }
    }

    // Allows the current foundation address to update to something different
    function updateFoundationAddress(address payable newFoundationAddress) external onlyFoundation {
        foundationAddress = newFoundationAddress;

        emit FoundationAddressUpdated(newFoundationAddress);
    }

    // Allow the foundation to update a token's URI if it's not locked yet (for updating art post mint)
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyFoundation {
        // ensure that this token exists
        require(_exists(tokenId));
        // ensure that the URI for this token is not locked yet
        require(tokenURILocked[tokenId] == false);
        // update the token URI
        super._setTokenURI(tokenId, newTokenURI);

        emit TokenUriUpdated(tokenId, newTokenURI);
    }

    // Locks a token's URI from being updated
    function lockTokenURI(uint256 tokenId) external onlyFoundation {
        // ensure that this token exists
        require(_exists(tokenId));
        // lock this token's URI from being changed
        tokenURILocked[tokenId] = true;
    }

    // Updates the mintPrice
    function updateMintPrice(uint256 price) external onlyFoundation {
        // Update the mintPrice
        mintPrice = price;
    }
    
    // Toggle the value of publicMint
    function togglePublicMint() external onlyFoundation {        
        publicMint = !publicMint;
    }

    function _mintBlank(address owner) private returns (uint256) {
        uint256 tokenId = tokenIndex;
        _checkMemberMintCount(owner);
        super._safeMint(owner, tokenId);
        tokenIndex++;
        _memberMintCount[owner]++;
        string memory tokenUri = super.tokenURI(tokenId);
        emit Minted(tokenId, owner, tokenUri);
        return tokenId;
    }

    function redeemVoucher(uint256 amount, BlankNFTVoucher calldata voucher)
        public
        payable
        returns (uint256[5] memory)
    {
        // make sure signature is valid and get the address of the signer
        address signer = _verify(voucher);
        // make sure caller is the redeemer
        require(msg.sender == voucher.redeemerAddress, "Voucher is for a different wallet address");

        // make sure that the signer is the foundation address
        require(payable(signer) == foundationAddress, "Signature invalid or unauthorized");

        require(
            _memberMintCount[voucher.redeemerAddress] + amount <= memberMaxMintCount,
            "Amount is more than the minting limit"
        );

        // make sure that the redeemer is paying enough to cover the buyer's cost
        require(msg.value >= (voucher.minPrice * amount), "Insufficient funds to redeem");

        // assign the token directly to the redeemer
        uint256[5] memory tokenIds;
        for (uint256 num = 0; num < amount; num++) {
            uint256 tokenId = _mintBlank(voucher.redeemerAddress);
            tokenIds[num] = tokenId;
        }
        // record payment to signer's withdrawal balance
        pendingWithdrawals[signer] += msg.value;
        return tokenIds;
    }

    // Public mint function. Whitelisted members will utilize redeemVoucher()
    function mint(uint256 amount)
        public
        payable
        returns (uint256[5] memory)
    {
        require(publicMint, "Public minting is not active.");
        require(
            _memberMintCount[msg.sender] + amount <= memberMaxMintCount,
            "Amount is more than the minting limit"
        );

        // make sure that the caller is paying enough to cover the mintPrice
        require(msg.value >= (mintPrice * amount), "Insufficient funds to mint");

        // assign the token directly to the redeemer
        uint256[5] memory tokenIds;
        for (uint256 num = 0; num < amount; num++) {
            uint256 tokenId = _mintBlank(msg.sender);
            tokenIds[num] = tokenId;
        }
        // record payment to foundationAddress withdrawal balance
        pendingWithdrawals[foundationAddress] += msg.value;
        return tokenIds;
    }

    /// @notice Transfers all pending withdrawal balance to the caller. Reverts if the caller is not an authorized minter.
    function withdraw() public onlyFoundation {
        // IMPORTANT: casting msg.sender to a payable address is only safe if ALL members of the minter role are payable addresses.
        address payable receiver = payable(msg.sender);

        uint256 amount = pendingWithdrawals[receiver];
        // zero account before transfer to prevent re-entrancy attack
        pendingWithdrawals[receiver] = 0;
        receiver.transfer(amount);
    }

    /// @notice Retuns the amount of Ether available to the caller to withdraw.
    function availableToWithdraw() public view onlyFoundation returns (uint256) {
        return pendingWithdrawals[msg.sender];
    }

    /// @notice Returns a hash of the given BlankNFTVoucher, prepared using EIP712 typed data hashing rules.
    /// @param voucher An NFTVoucher to hash.
    function _hash(BlankNFTVoucher calldata voucher) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256("BlankNFTVoucher(address redeemerAddress,uint256 minPrice)"),
                        voucher.redeemerAddress,
                        voucher.minPrice
                    )
                )
            );
    }

    /// @notice Returns the chain id of the current blockchain.
    /// @dev This is used to workaround an issue with ganache returning different values from the on-chain chainid() function and
    ///  the eth_chainId RPC method. See https://github.com/protocol/nft-website/issues/121 for context.
    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /// @notice Verifies the signature for a given BlankNFTVoucher, returning the address of the signer.
    /// @dev Will revert if the signature is invalid. Does not verify that the signer is authorized to mint NFTs.
    /// @param voucher An BlankNFTVoucher describing an unminted NFT.
    function _verify(BlankNFTVoucher calldata voucher) internal view returns (address) {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId);
    }
}
