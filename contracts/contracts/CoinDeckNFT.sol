// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./AdminControl.sol";

/**
 * Migrated from fantasy_league.move
 * ERC-721 РєР°СЂС‚С‹ + СЃСѓРЅРґСѓРєРё, merge, open_chest, inventory
 */
contract CoinDeckNFT is ERC721, ERC721Burnable, ReentrancyGuard {
    using Strings for uint256;

    // в"Ђв"Ђ Constants в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    uint64 public constant MERGE_COUNT    = 5;
    uint8  public constant MAX_CHEST_TYPE = 2;

    uint8 public maxTier    = 3;
    uint8 public maxPlayers = 50;
    uint64 public constant MAX_CHEST_BATCH = 100;
    uint256 public constant MAX_NICKNAME_LEN = 30;

    uint256 public constant DEFAULT_WOODEN_PRICE = 0.01 ether;
    uint256 public constant DEFAULT_IRON_PRICE   = 0.03 ether;
    uint256 public constant DEFAULT_SILVER_PRICE = 0.09 ether;

    // token types
    uint8 public constant TYPE_CARD  = 0;
    uint8 public constant TYPE_CHEST = 1;

    // в"Ђв"Ђ Structs в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    struct CardData {
        uint8 playerId;
        uint8 tier;
    }

    struct ChestData {
        uint8 chestType; // 0=Wooden 1=Iron 2=Silver
    }

    // в"Ђв"Ђ State в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    AdminControl public adminControl;

    uint256 private _nextTokenId;

    // tokenId в†' card data (only for TYPE_CARD tokens)
    mapping(uint256 => CardData) public cards;
    // tokenId в†' chest data (only for TYPE_CHEST tokens)
    mapping(uint256 => ChestData) public chests;
    // tokenId в†' token type (0=card, 1=chest)
    mapping(uint256 => uint8) public tokenType;

    // card locking: tokenId в†' unlock timestamp (0 = unlocked)
    // written by Tournament contract only
    mapping(uint256 => uint256) public lockUntil;

    // inventory: owner в†' tokenIds[]
    mapping(address => uint256[]) private _userCards;
    mapping(address => uint256[]) private _userChests;
    // reverse index for O(1) swap-remove
    mapping(uint256 => uint256) private _cardIndex;
    mapping(uint256 => uint256) private _chestIndex;

    // nicknames
    mapping(address => string) public nicknames;

    // chest prices
    uint256 public woodenPrice;
    uint256 public ironPrice;
    uint256 public silverPrice;

    // base URIs
    string public cardBaseUri;
    string public chestBaseUri;

    // extension data for players beyond id 49 and tiers beyond 3
    mapping(uint8 => string) private _extPlayerName;
    mapping(uint8 => string) private _extPlayerSlug;
    mapping(uint8 => string) private _extTierName;

    // tournament contract address вЂ" only it may lock/unlock cards
    address public tournamentContract;

    // в"Ђв"Ђ Events в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    event CardMinted(address indexed to, uint256 indexed tokenId, uint8 playerId, uint8 tier);
    event ChestMinted(address indexed to, uint256 indexed tokenId, uint8 chestType);
    event ChestOpened(address indexed opener, uint256 indexed chestId, uint256 indexed cardId);
    event CardsMerged(address indexed owner, uint256 indexed newTokenId, uint8 playerId, uint8 newTier);
    event ChestPricesUpdated(uint256 wooden, uint256 iron, uint256 silver);
    event BaseUrisUpdated();
    event TournamentSet(address indexed tournament);
    event NicknameSet(address indexed user, string nickname);
    event MaxTierUpdated(uint8 newMax);
    event MaxPlayersUpdated(uint8 newMax);
    event PlayerAdded(uint8 indexed id, string name);
    event TierNameSet(uint8 indexed tier, string name);

    // в"Ђв"Ђ Errors в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    error NotAdmin();
    error NotNFTAdmin();
    error NotTournament();
    error CardLocked();
    error MaxTier();
    error NotOwnerOfToken();
    error WrongCard();
    error BatchTooLarge();
    error InvalidChestType();
    error NicknameTooLong();
    error InsufficientPayment();
    error InvalidTier();
    error DuplicateToken();

    // в"Ђв"Ђ Modifiers в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    modifier onlyNFTAdmin() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_NFT()) &&
            msg.sender != adminControl.owner())
            revert NotNFTAdmin();
        _;
    }

    modifier onlyTournament() {
        if (msg.sender != tournamentContract) revert NotTournament();
        _;
    }

    // в"Ђв"Ђ Constructor в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    constructor(address _adminControl) ERC721("CoinDeck Portfolio", "CDECK") {
        adminControl = AdminControl(_adminControl);
        woodenPrice  = DEFAULT_WOODEN_PRICE;
        ironPrice    = DEFAULT_IRON_PRICE;
        silverPrice  = DEFAULT_SILVER_PRICE;
        cardBaseUri  = "https://assets.coingecko.com/coins/images/";
        chestBaseUri = "https://coindeck.app/nft/chest/";
    }

    // в"Ђв"Ђ Admin setup в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function setTournamentContract(address _tournament) external {
        if (msg.sender != adminControl.owner()) revert NotAdmin();
        tournamentContract = _tournament;
        emit TournamentSet(_tournament);
    }

    function setChestPrices(uint256 wooden, uint256 iron, uint256 silver) external onlyNFTAdmin {
        adminControl.assertEpochSettingsMutable();
        adminControl.consumeAction(
            adminControl.ACTION_SET_CHEST_PRICES(),
            keccak256(abi.encode(wooden, iron, silver))
        );
        woodenPrice = wooden;
        ironPrice   = iron;
        silverPrice = silver;
        emit ChestPricesUpdated(wooden, iron, silver);
    }

    function setBaseUris(string calldata cardUri, string calldata chestUri) external onlyNFTAdmin {
        adminControl.consumeAction(
            adminControl.ACTION_SET_BASE_URIS(),
            keccak256(abi.encodePacked(cardUri, chestUri))
        );
        cardBaseUri  = cardUri;
        chestBaseUri = chestUri;
        emit BaseUrisUpdated();
    }

    function setMaxTier(uint8 newMax) external onlyNFTAdmin {
        require(newMax > maxTier, "only increase");
        maxTier = newMax;
        emit MaxTierUpdated(newMax);
    }

    function setMaxPlayers(uint8 newMax) external onlyNFTAdmin {
        require(newMax > maxPlayers, "only increase");
        maxPlayers = newMax;
        emit MaxPlayersUpdated(newMax);
    }

    function addPlayer(uint8 id, string calldata name, string calldata slug) external onlyNFTAdmin {
        require(id >= 50, "use built-in range");
        require(id < maxPlayers, "id >= maxPlayers");
        _extPlayerName[id] = name;
        _extPlayerSlug[id] = slug;
        emit PlayerAdded(id, name);
    }

    function setExtTierName(uint8 tier, string calldata name) external onlyNFTAdmin {
        require(tier > 3, "use built-in range");
        require(tier <= maxTier, "tier > maxTier");
        _extTierName[tier] = name;
        emit TierNameSet(tier, name);
    }

    // в"Ђв"Ђ Nickname в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function setNickname(string calldata nick) external {
        if (bytes(nick).length > MAX_NICKNAME_LEN) revert NicknameTooLong();
        nicknames[msg.sender] = nick;
        emit NicknameSet(msg.sender, nick);
    }

    // в"Ђв"Ђ Admin mint в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function adminMintCard(
        address recipient,
        uint8   playerId,
        uint8   tier,
        uint256 count
    ) external onlyNFTAdmin {
        if (tier > maxTier) revert InvalidTier();
        adminControl.consumeAction(
            adminControl.ACTION_ADMIN_MINT_TO(),
            keccak256(abi.encode(recipient, playerId, tier, count))
        );
        for (uint256 i = 0; i < count; i++) {
            _mintCard(recipient, playerId, tier);
        }
    }

    // в"Ђв"Ђ Buy chest в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function buyChest(uint8 chestType, uint64 count) external payable nonReentrant {
        if (chestType > MAX_CHEST_TYPE) revert InvalidChestType();
        if (count == 0 || count > MAX_CHEST_BATCH) revert BatchTooLarge();

        uint256 unitPrice = _chestPrice(chestType);
        if (msg.value < unitPrice * count) revert InsufficientPayment();

        for (uint64 i = 0; i < count; i++) {
            _mintChest(msg.sender, chestType);
        }

        uint256 total = unitPrice * count;
        address tn = tournamentContract;
        if (tn != address(0)) {
            (bool ok,) = tn.call{value: total}("");
            require(ok, "fwd");
        }

        uint256 excess = msg.value - total;
        if (excess > 0) {
            (bool ok2,) = payable(msg.sender).call{value: excess}("");
            require(ok2, "ref");
        }
    }

    // в"Ђв"Ђ Open chest в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function openChest(uint256 chestId) external nonReentrant {
        if (ownerOf(chestId) != msg.sender) revert NotOwnerOfToken();
        if (tokenType[chestId] != TYPE_CHEST) revert InvalidChestType();

        uint8 chestType = chests[chestId].chestType;

        _removeChestFromInventory(msg.sender, chestId);
        _burn(chestId);

        uint8 tier     = chestType; // Woodenв†'Common, Ironв†'Rare, Silverв†'Epic
        uint8 playerId = _pseudoRand(msg.sender, chestId, 0, maxPlayers);
        uint256 newId  = _mintCard(msg.sender, playerId, tier);

        emit ChestOpened(msg.sender, chestId, newId);
    }

    function openChestBatch(uint256[] calldata chestIds) external nonReentrant {
        uint256 count = chestIds.length;
        if (count == 0 || count > MAX_CHEST_BATCH) revert BatchTooLarge();

        // Dedup check
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (chestIds[i] == chestIds[j]) revert DuplicateToken();
            }
        }

        for (uint256 i = 0; i < count; i++) {
            uint256 chestId = chestIds[i];
            if (ownerOf(chestId) != msg.sender) revert NotOwnerOfToken();
            if (tokenType[chestId] != TYPE_CHEST) revert InvalidChestType();

            uint8 chestType = chests[chestId].chestType;
            _removeChestFromInventory(msg.sender, chestId);
            _burn(chestId);

            uint8 tier     = chestType;
            uint8 playerId = _pseudoRand(msg.sender, chestId, uint8(i), maxPlayers);
            uint256 newId  = _mintCard(msg.sender, playerId, tier);
            emit ChestOpened(msg.sender, chestId, newId);
        }
    }

    // в"Ђв"Ђ Merge cards в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function mergeCards(
        uint8     playerId,
        uint8     tier,
        uint256[] calldata tokenIds
    ) external nonReentrant {
        if (tier >= maxTier) revert MaxTier();
        if (tokenIds.length != MERGE_COUNT) revert WrongCard();

        // Dedup
        for (uint256 i = 0; i < MERGE_COUNT; i++) {
            for (uint256 j = i + 1; j < MERGE_COUNT; j++) {
                if (tokenIds[i] == tokenIds[j]) revert DuplicateToken();
            }
        }

        for (uint256 i = 0; i < MERGE_COUNT; i++) {
            uint256 tid = tokenIds[i];
            if (ownerOf(tid) != msg.sender)             revert NotOwnerOfToken();
            if (isCardLocked(tid))                      revert CardLocked();
            if (tokenType[tid] != TYPE_CARD)            revert WrongCard();
            CardData memory c = cards[tid];
            if (c.playerId != playerId || c.tier != tier) revert WrongCard();

            _removeCardFromInventory(msg.sender, tid);
            _burn(tid);
        }

        uint256 newId = _mintCard(msg.sender, playerId, tier + 1);
        emit CardsMerged(msg.sender, newId, playerId, tier + 1);
    }

    // в"Ђв"Ђ Card transfers в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function transferCard(address to, uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotOwnerOfToken();
        if (isCardLocked(tokenId)) revert CardLocked();
        _transfer(msg.sender, to, tokenId); // _afterTokenTransfer handles inventory
    }

    // в"Ђв"Ђ Card locking (tournament only) в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function lockCard(uint256 tokenId, uint256 unlockTs) external onlyTournament {
        lockUntil[tokenId] = unlockTs;
    }

    function unlockCard(uint256 tokenId) external onlyTournament {
        delete lockUntil[tokenId];
    }

    function isCardLocked(uint256 tokenId) public view returns (bool) {
        return block.timestamp < lockUntil[tokenId];
    }

    // в"Ђв"Ђ Admin reissue в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function adminReissueCard(uint256 tokenId) external onlyNFTAdmin {
        if (isCardLocked(tokenId)) revert CardLocked();
        address owner_ = ownerOf(tokenId);
        CardData memory c = cards[tokenId];
        _removeCardFromInventory(owner_, tokenId);
        _burn(tokenId);
        delete lockUntil[tokenId];
        _mintCard(owner_, c.playerId, c.tier);
    }

    // в"Ђв"Ђ Internal mints в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function _mintCard(address to, uint8 playerId, uint8 tier) internal returns (uint256) {
        if (tier > maxTier) revert InvalidTier();
        uint256 id = _nextTokenId++;
        // Set metadata BEFORE _safeMint so _afterTokenTransfer can read tokenType
        tokenType[id] = TYPE_CARD;
        cards[id]     = CardData({ playerId: playerId, tier: tier });
        _safeMint(to, id);
        emit CardMinted(to, id, playerId, tier);
        return id;
    }

    function _mintChest(address to, uint8 chestType) internal returns (uint256) {
        uint256 id = _nextTokenId++;
        tokenType[id] = TYPE_CHEST;
        chests[id]    = ChestData({ chestType: chestType });
        _safeMint(to, id);
        emit ChestMinted(to, id, chestType);
        return id;
    }

    // в"Ђв"Ђ Inventory helpers в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function _addCardToInventory(address owner_, uint256 tokenId) internal {
        _cardIndex[tokenId] = _userCards[owner_].length;
        _userCards[owner_].push(tokenId);
    }

    function _removeCardFromInventory(address owner_, uint256 tokenId) internal {
        uint256 idx  = _cardIndex[tokenId];
        uint256 last = _userCards[owner_][_userCards[owner_].length - 1];
        _userCards[owner_][idx] = last;
        _cardIndex[last]        = idx;
        _userCards[owner_].pop();
        delete _cardIndex[tokenId];
    }

    function _addChestToInventory(address owner_, uint256 tokenId) internal {
        _chestIndex[tokenId] = _userChests[owner_].length;
        _userChests[owner_].push(tokenId);
    }

    function _removeChestFromInventory(address owner_, uint256 tokenId) internal {
        uint256 idx  = _chestIndex[tokenId];
        uint256 last = _userChests[owner_][_userChests[owner_].length - 1];
        _userChests[owner_][idx] = last;
        _chestIndex[last]        = idx;
        _userChests[owner_].pop();
        delete _chestIndex[tokenId];
    }

    // OZ v4 hook вЂ" syncs inventory on mint and transfer (burn handled before _burn call)
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
        bool isCard = tokenType[firstTokenId] == TYPE_CARD;
        if (from == address(0)) {
            // mint
            if (isCard) _addCardToInventory(to, firstTokenId);
            else        _addChestToInventory(to, firstTokenId);
        } else if (to == address(0)) {
            // burn
            if (isCard) _removeCardFromInventory(from, firstTokenId);
            else        _removeChestFromInventory(from, firstTokenId);
        } else {
            // transfer
            if (isCard) {
                _removeCardFromInventory(from, firstTokenId);
                _addCardToInventory(to, firstTokenId);
            } else {
                _removeChestFromInventory(from, firstTokenId);
                _addChestToInventory(to, firstTokenId);
            }
        }
    }

    // в"Ђв"Ђ Pseudorandomness в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    // Same weakness as Move version (timestamp-based). Acceptable for MVP.
    function _pseudoRand(
        address user,
        uint256 tokenId,
        uint8   nonce,
        uint8   maxVal
    ) internal view returns (uint8) {
        uint256 h = uint256(keccak256(abi.encodePacked(
            user, tokenId, block.timestamp, block.prevrandao, nonce
        )));
        return uint8(h % maxVal);
    }

    function _chestPrice(uint8 chestType) internal view returns (uint256) {
        if (chestType == 0) return woodenPrice;
        if (chestType == 1) return ironPrice;
        return silverPrice;
    }

    // в"Ђв"Ђ Views в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function getUserCards(address owner_) external view returns (uint256[] memory) {
        return _userCards[owner_];
    }

    function getUserChests(address owner_) external view returns (uint256[] memory) {
        return _userChests[owner_];
    }

    function getCardInfo(uint256 tokenId) external view returns (uint8 playerId, uint8 tier) {
        CardData memory c = cards[tokenId];
        return (c.playerId, c.tier);
    }

    function getChestPrices() external view returns (uint256 wooden, uint256 iron, uint256 silver) {
        return (woodenPrice, ironPrice, silverPrice);
    }

    // в"Ђв"Ђ Coin/name tables в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    function playerName(uint8 id) public view returns (string memory) {
        if (id < 50) {
            string[50] memory names = [
                "Bitcoin","Ethereum","BNB","XRP","Solana",
                "Dogecoin","Cardano","TRON","Avalanche","Shiba Inu",
                "Polkadot","Bitcoin Cash","Chainlink","NEAR","Litecoin",
                "Uniswap","Aptos","Hedera","Monero","Internet Computer",
                "Ethereum Classic","OKB","Cosmos","Filecoin","Arbitrum",
                "Polygon","Stellar","Optimism","Immutable","Mantle",
                "VeChain","Cronos","Stacks","Algorand","Render",
                "Injective","The Graph","Sui","Fantom","Theta",
                "EOS","Aave","Maker","Lido","Sei",
                "Kaspa","Pepe","Bonk","dogwifhat","Abstract"
            ];
            return names[id];
        }
        return _extPlayerName[id];
    }

    function tierName(uint8 tier) public view returns (string memory) {
        if (tier == 0) return "Common";
        if (tier == 1) return "Rare";
        if (tier == 2) return "Epic";
        if (tier == 3) return "Legendary";
        return _extTierName[tier];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721: invalid token ID");
        if (tokenType[tokenId] == TYPE_CARD) {
            CardData memory c = cards[tokenId];
            return string(abi.encodePacked(
                cardBaseUri,
                uint256(c.playerId).toString(),
                "/",
                uint256(c.tier).toString()
            ));
        } else {
            ChestData memory ch = chests[tokenId];
            return string(abi.encodePacked(
                chestBaseUri,
                uint256(ch.chestType).toString()
            ));
        }
    }

    function _playerSlug(uint8 id) internal view returns (string memory) {
        if (id < 50) {
            string[50] memory slugs = [
                "1/small/bitcoin.png",
                "279/small/ethereum.png",
                "825/small/bnb-icon2_2x.png",
                "44/small/xrp-symbol-white-128.png",
                "4128/small/solana.png",
                "5/small/dogecoin.png",
                "975/small/cardano.png",
                "1094/small/tronix.png",
                "12559/small/Avalanche_Circle_RedWhite_Trans.png",
                "11939/small/shiba.png",
                "12171/small/polkadot.png",
                "780/small/bitcoin-cash-circle.png",
                "877/small/chainlink-new-logo.png",
                "10365/small/near.jpg",
                "2/small/litecoin.png",
                "12504/small/uniswap-uni-logo.png",
                "26455/small/aptos_round.png",
                "3688/small/hbar.png",
                "69/small/monero_logo.png",
                "14495/small/Internet_Computer_logo.png",
                "328/small/ethereum-classic.png",
                "4463/small/WeChat_Image_20220118095654.png",
                "1481/small/cosmos_hub.png",
                "12817/small/filecoin.png",
                "16547/small/photo_2023-03-29_21.47.00.jpeg",
                "4713/small/matic-token-icon.png",
                "100/small/Stellar_symbol_black_RGB.png",
                "25244/small/Optimism.png",
                "17500/small/imx.png",
                "27075/small/mantle-seeklogo.png",
                "1167/small/VET_Token_Icon.png",
                "7310/small/cro_token_logo.png",
                "4847/small/Stacks_logo_full.png",
                "4380/small/download.png",
                "11636/small/rndr.png",
                "12882/small/Secondary_Symbol.png",
                "13397/small/Graph_Token.png",
                "26375/small/sui-ocean-square.png",
                "4001/small/Fantom_round.png",
                "2416/small/theta-token-logo.png",
                "738/small/eos-eos-logo.png",
                "12645/small/AAVE.png",
                "1364/small/Mark_Maker.png",
                "13573/small/Lido_DAO.png",
                "28205/small/Sei_Logo_-_Transparent.png",
                "25751/small/kaspa-icon-exchanges.png",
                "29850/small/pepe-token.jpeg",
                "28600/small/bonk.jpg",
                "33566/small/dogwifhat.jpg",
                "32452/small/abstract.jpg"
            ];
            return slugs[id];
        }
        return _extPlayerSlug[id];
    }

    // в"Ђв"Ђ ETH receive (prize vault) в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    receive() external payable {}
}
