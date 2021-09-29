pragma solidity ^0.5.12;

import "./ERC721.sol";
import "./ERC721Enumerable.sol";
import "./ERC721Metadata.sol";

contract BlankArt is
    Initializable,
    ERC721,
    ERC721Enumerable,
    ERC721Metadata
{

    // An event whenever the foundation address is updated
    event FoundationAddressUpdated(address foundationAddress);

    event MemberAdded(
        address member
    );

    event MemberRevoked(
        address member
    );

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

    function setup(
        string memory name,
        string memory symbol,
        uint256 initialExpectedTokenSupply,
        address _upgraderAddress
    ) public initializer {
        ERC721.initialize();
        ERC721Enumerable.initialize();
        ERC721Metadata.initialize(name, symbol);

        // royalty amounts to the foundation
        foundationSalePercentage = 20;

        // by default, the foundationAddress is the address that mints this contract
        foundationAddress = msg.sender;

        // set the upgrader address
        upgraderAddress = _upgraderAddress;

        // set the initial expected token supply
        expectedTokenSupply = initialExpectedTokenSupply;

        require(expectedTokenSupply > 0);
    }

    // modifier for only allowing the foundation to make a call
    modifier onlyFoundation() {
        require(msg.sender == foundationAddress);
        _;
    }

    modifier onlyMembers() {
        //        require(members[msg.sender], "Sender not whitelisted to mint.");
        _checkMembership(msg.sender);
        _;
    }

    function isMember(address account) public view override returns (bool) {
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

    function addMember(address account) public virtual override onlyFoundation {
        _addMember(account);
    }

    function _addMember(bytes32 role, address account) internal virtual {
        if (!isMember(account)) {
            _members[account] = true;
            emit MemberAdded(account, msg.sender);
        }
    }

    function addMembersBatch(address[] memory accounts) public virtual override onlyFoundation {
        for (uint256 account = 0; account < accounts.length; account++) {
            addMember(accounts[account]);
        }
    }

    function revokeMember(address account) internal virtual {
        if (isMember(account)) {
            _members[account] = false;
            emit MemberRevoked(account, msg.sender);
        }
    }

    function revokeMembersBatch(address[] memory accounts) public virtual override onlyFoundation {
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
    function updateTokenURI(uint256 tokenId, string calldata tokenURI)
    external
    onlyFoundation
    {
        // ensure that this token exists
        require(_exists(tokenId));
        // ensure that the URI for this token is not locked yet
        require(tokenURILocked[tokenId] == false);
        // update the token URI
        super._setTokenURI(tokenId, tokenURI);
    }

    // Locks a token's URI from being updated
    function lockTokenURI(uint256 tokenId) external onlyFoundation {
        // ensure that this token exists
        require(_exists(tokenId));
        // lock this token's URI from being changed
        tokenURILocked[tokenId] = true;
    }

    function mintBlank(
        uint256 tokenId
    )
    external
    onlyMembers(msg.sender)
    {
        // Mint the token
        super._safeMint(msg.sender, tokenId);
    }

    // override the default transfer
    function _transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) internal {
        // transfer the token
        super._transferFrom(from, to, tokenId);
    }
}
