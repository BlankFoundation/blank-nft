// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract BlankArt is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    // An event whenever the foundation address is updated
    event FoundationAddressUpdated(address foundationAddress);

    event MemberAdded(address member);

    event MemberRevoked(address member);

    // if a token's URI has been locked or not
    mapping(uint256 => bool) public tokenURILocked;

    // the percentage of sale that the foundation gets on secondary sales
    uint256 public foundationSalePercentage;
    // gets incremented to placehold for tokens not minted yet
    uint256 public expectedTokenSupply;
    // the address of the platform (for receving commissions and royalties)
    address payable public foundationAddress;
    // If an account can mint
    mapping(address => bool) private _members;

    constructor(uint256 initialExpectedTokenSupply)
        ERC721("BlankArt", "BLANK")
    {
        foundationSalePercentage = 50;
        foundationAddress = payable(msg.sender);
        _members[msg.sender] = true;
        expectedTokenSupply = initialExpectedTokenSupply;
        require(expectedTokenSupply > 0);
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

    function addMember(address account) public virtual onlyFoundation {
        _addMember(account);
    }

    function _addMember(address account) internal virtual {
        if (!isMember(account)) {
            _members[account] = true;
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

    function mintBlank(uint256 tokenId) external onlyMembers {
        // Mint the token
        super._safeMint(msg.sender, tokenId);
    }
}
