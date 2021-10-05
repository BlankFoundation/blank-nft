// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract BlankArt is ERC721, EIP712, ERC721Enumerable, ERC721URIStorage, AccessControl, Ownable {
    // An event whenever the foundation address is updated
    event FoundationAddressUpdated(address foundationAddress);

    event MemberAdded(address member);

    event MemberRevoked(address member);

    // if a token's URI has been locked or not
    mapping(uint256 => bool) public tokenURILocked;
    // minter role (to be assigned to a foundation minter wallet)
    bytes32 public MINTER_ROLE = keccak256("MINTER_ROLE");
    // signing domain
    string private SIGNING_DOMAIN;
    // signature version
    string private constant SIGNATURE_VERSION;
    // the percentage of sale that the foundation gets on secondary sales
    uint256 public foundationSalePercentage;
    // gets incremented to placehold for tokens not minted yet
    uint256 public expectedTokenSupply;
    // the address of the platform (for receving commissions and royalties)
    address payable public foundationAddress;
    // If an account can mint
    mapping(address => bool) private _members;
    // Number of tokens minted by account
    mapping(address => uint8) private _memberMintCount;
    // Max number of tokens a member can mint
    uint8 public memberMaxMintCount;
    // current token index
    uint256 private tokenIndex;

    constructor(uint256 initialExpectedTokenSupply)
        ERC721("BlankArt", "BLANK")
        EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION)
    {
        foundationSalePercentage = 50;
        memberMaxMintCount = 5;
        foundationAddress = payable(msg.sender);
        _setupRole(MINTER_ROLE, foundationAddress); // should this be a different address?
        _members[msg.sender] = true;
        expectedTokenSupply = initialExpectedTokenSupply;
        require(expectedTokenSupply > 0);
        tokenIndex = 1;
    }

        /// @notice Represents a voucher to claim any un-minted NFT (up to memberMaxMintCount), which has not yet been recorded into the blockchain. A signed voucher can be redeemed for real NFTs using the redeemVoucher function.
    struct BlankNFTVoucher {
        /// @notice The minimum price (in wei) that the NFT creator is willing to accept for the initial sale of this NFT.       uint256 minPrice;

        /// @notice the EIP-712 signature of all other fields in the NFTVoucher struct. For a voucher to be valid, it must be signed by an account with the MINTER_ROLE.
        bytes signature;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    // modifier for only allowing the foundation to make a call
    modifier onlyFoundation() {
        require(
            msg.sender == foundationAddress,
            "Only the foundation can make this call"
        );
        _;
    }

    modifier onlyMembers() {
        //        require(members[msg.sender], "Sender not whitelisted to mint.");
        _checkMembership(msg.sender);
        _;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function isMember(address account) public view returns (bool) {
        return _members[account];
    }

    function _checkMembership(address account) internal view {
        if (!isMember(account)) {
            revert(
                string(
                    abi.encodePacked(
                        "Account ",
                        Strings.toHexString(uint160(account), 20),
                        " is not a member, so cannot mint"
                    )
                )
            );
        }
    }

    function _checkMemberMintCount(address account) internal view onlyMembers {
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

    function addMember(address account) public virtual onlyFoundation {
        _addMember(account);
    }

    function _addMember(address account) internal virtual {
        if (!isMember(account)) {
            _members[account] = true;
            _memberMintCount[account] = 0;
            emit MemberAdded(account);
        }
    }

    function addMembersBatch(address[] memory accounts)
        public
        virtual
        onlyFoundation
    {
        for (uint256 account = 0; account < accounts.length; account++) {
            addMember(accounts[account]);
        }
    }

    function revokeMember(address account) public virtual onlyFoundation {
        if (isMember(account)) {
            _members[account] = false;
            emit MemberRevoked(account);
        }
    }

    function revokeMembersBatch(address[] memory accounts)
        public
        virtual
        onlyFoundation
    {
        for (uint256 account = 0; account < accounts.length; account++) {
            revokeMember(accounts[account]);
        }
    }

    // Allows the current foundation address to update to something different
    function updateFoundationAddress(address payable newFoundationAddress)
        external
        onlyFoundation
    {
        foundationAddress = newFoundationAddress;

        emit FoundationAddressUpdated(newFoundationAddress);
    }

    // Allow the foundation to update a token's URI if it's not locked yet (for updating art post mint)
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI)
        external
        onlyFoundation
    {
        // ensure that this token exists
        require(_exists(tokenId));
        // ensure that the URI for this token is not locked yet
        require(tokenURILocked[tokenId] == false);
        // update the token URI
        super._setTokenURI(tokenId, newTokenURI);
    }

    // Locks a token's URI from being updated
    function lockTokenURI(uint256 tokenId) external onlyFoundation {
        // ensure that this token exists
        require(_exists(tokenId));
        // lock this token's URI from being changed
        tokenURILocked[tokenId] = true;
    }

    function mintBlank() external onlyMembers {
        tokenId = tokenIndex;
        super._safeMint(msg.sender, tokenId);
        tokenIndex++;
        _memberMintCount[msg.sender]++;
        return tokenId;
    }

    function redeemVoucher(address redeemer, uint256 amount, BlankNFTVoucher calldata voucher) public payable returns (uint256[]) {
        // make sure signature is valid and get the address of the signer
        address signer = _verify(voucher);

        // make sure that the signer is authorized to mint NFTs
        require(hasRole(MINTER_ROLE, signer), "Signature invalid or unauthorized");

        // make sure that the redeemer is paying enough to cover the buyer's cost
        require(msg.value >= (voucher.minPrice * amount), "Insufficient funds to redeem");

        // first assign the token to the signer, to establish provenance on-chain
        tokenIds = uint256[];
        for (uint256 num = 0; num < amount; num++) {
            tokenId = mintBlank(signer);

            // transfer the token to the redeemer
            _transfer(signer, redeemer, tokenId);

            // record payment to signer's withdrawal balance
            pendingWithdrawals[signer] += msg.value;
            tokenIds += tokenId;   
        }
        return tokenIds;
    }

  /// @notice Transfers all pending withdrawal balance to the caller. Reverts if the caller is not an authorized minter.
  function withdraw() public {
    require(hasRole(MINTER_ROLE, msg.sender), "Only authorized minters can withdraw");
    
    // IMPORTANT: casting msg.sender to a payable address is only safe if ALL members of the minter role are payable addresses.
    address payable receiver = payable(msg.sender);

    uint amount = pendingWithdrawals[receiver];
    // zero account before transfer to prevent re-entrancy attack
    pendingWithdrawals[receiver] = 0;
    receiver.transfer(amount);
  }

  /// @notice Retuns the amount of Ether available to the caller to withdraw.
  function availableToWithdraw() public view returns (uint256) {
    return pendingWithdrawals[msg.sender];
  }

  /// @notice Returns a hash of the given BlankNFTVoucher, prepared using EIP712 typed data hashing rules.
  /// @param voucher An NFTVoucher to hash.
  function _hash(BlankNFTVoucher calldata voucher) internal view returns (bytes32) {
    return _hashTypedDataV4(keccak256(abi.encode(
      keccak256("NFTVoucher(uint256 minPrice)"),
      voucher.minPrice
    )));
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

  function supportsInterface(bytes4 interfaceId) public view virtual override (AccessControl, ERC721) returns (bool) {
    return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
  }
}

