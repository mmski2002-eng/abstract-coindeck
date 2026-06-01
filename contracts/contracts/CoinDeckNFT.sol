// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./AdminControl.sol";

/**
 * ERC-721 EggMonets + Eggs, merge, scratchEgg, inventory
 */
contract CoinDeckNFT is ERC721, ERC721Burnable, ReentrancyGuard {
    using Strings for uint256;

    // ── Constants ──────────────────────────────────────────────────────────────
    uint64 public constant MERGE_COUNT    = 5;
    uint8  public constant MAX_EGG_TYPE   = 2;

    uint8 public maxTier    = 3;
    uint8 public maxPlayers = 50;
    uint64 public constant MAX_EGG_BATCH     = 100;
    uint256 public constant MAX_NICKNAME_LEN = 30;

    uint256 public constant DEFAULT_WOODEN_PRICE = 0.01 ether;
    uint256 public constant DEFAULT_IRON_PRICE   = 0.03 ether;
    uint256 public constant DEFAULT_SILVER_PRICE = 0.09 ether;

    // token types
    uint8 public constant TYPE_EGGMONET = 0;
    uint8 public constant TYPE_EGG      = 1;

    // ── Structs ────────────────────────────────────────────────────────────────
    struct EggMonetData {
        uint8 playerId;
        uint8 tier;
    }

    struct EggData {
        uint8 eggType; // 0=Wooden 1=Iron 2=Silver
    }

    // ── State ──────────────────────────────────────────────────────────────────
    AdminControl public adminControl;

    uint256 private _nextTokenId;

    // tokenId → EggMonet data (only for TYPE_EGGMONET tokens)
    mapping(uint256 => EggMonetData) public eggMonets;
    // tokenId → Egg data (only for TYPE_EGG tokens)
    mapping(uint256 => EggData) public eggs;
    // tokenId → token type (0=eggMonet, 1=egg)
    mapping(uint256 => uint8) public tokenType;

    // eggMonet locking: tokenId → unlock timestamp (0 = unlocked)
    mapping(uint256 => uint256) public lockUntil;

    // inventory: owner → tokenIds[]
    mapping(address => uint256[]) private _userEggMonets;
    mapping(address => uint256[]) private _userEggs;
    // reverse index for O(1) swap-remove
    mapping(uint256 => uint256) private _eggMonetIndex;
    mapping(uint256 => uint256) private _eggIndex;

    // nicknames
    mapping(address => string) public nicknames;

    // egg prices
    uint256 public woodenPrice;
    uint256 public ironPrice;
    uint256 public silverPrice;

    // base URIs
    string public eggMonetBaseUri;
    string public eggBaseUri;

    // extension data for players beyond id 49 and tiers beyond 3
    mapping(uint8 => string) private _extPlayerName;
    mapping(uint8 => string) private _extPlayerSlug;
    mapping(uint8 => string) private _extTierName;

    // tournament contract address — only it may lock/unlock eggMonets
    address public tournamentContract;

    // ── Events ─────────────────────────────────────────────────────────────────
    event EggMonetMinted(address indexed to, uint256 indexed tokenId, uint8 playerId, uint8 tier);
    event EggMinted(address indexed to, uint256 indexed tokenId, uint8 eggType);
    event EggScratched(address indexed scratcher, uint256 indexed eggId, uint256 indexed eggMonetId);
    event EggMonetReissued(address indexed owner, uint256 indexed oldTokenId, uint256 indexed newTokenId, uint8 playerId, uint8 tier);
    event EggMonetsMerged(address indexed owner, uint256 indexed newTokenId, uint8 playerId, uint8 newTier);
    event EggPricesUpdated(uint256 wooden, uint256 iron, uint256 silver);
    event BaseUrisUpdated();
    event TournamentSet(address indexed tournament);
    event NicknameSet(address indexed user, string nickname);
    event MaxTierUpdated(uint8 newMax);
    event MaxPlayersUpdated(uint8 newMax);
    event PlayerAdded(uint8 indexed id, string name);
    event TierNameSet(uint8 indexed tier, string name);

    // ── Errors ─────────────────────────────────────────────────────────────────
    error NotAdmin();
    error NotNFTAdmin();
    error NotTournament();
    error EggMonetLocked();
    error TournamentNotSet();
    error ZeroAddress();
    error MaxTier();
    error NotOwnerOfToken();
    error WrongEggMonet();
    error BatchTooLarge();
    error InvalidEggType();
    error NicknameTooLong();
    error InsufficientPayment();
    error InvalidTier();
    error DuplicateToken();

    // ── Modifiers ──────────────────────────────────────────────────────────────
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

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address _adminControl) ERC721("CoinDeck Portfolio", "CDECK") {
        adminControl    = AdminControl(_adminControl);
        woodenPrice     = DEFAULT_WOODEN_PRICE;
        ironPrice       = DEFAULT_IRON_PRICE;
        silverPrice     = DEFAULT_SILVER_PRICE;
        eggMonetBaseUri = "https://assets.coingecko.com/coins/images/";
        eggBaseUri      = "https://coindeck.app/nft/chest/";
    }

    // ── Admin setup ────────────────────────────────────────────────────────────
    function setTournamentContract(address _tournament) external {
        if (_tournament == address(0)) revert ZeroAddress();
        if (msg.sender != adminControl.owner()) revert NotAdmin();
        tournamentContract = _tournament;
        emit TournamentSet(_tournament);
    }

    function setEggPrices(uint256 wooden, uint256 iron, uint256 silver) external onlyNFTAdmin {
        adminControl.assertEpochSettingsMutable();
        adminControl.consumeAction(
            adminControl.ACTION_SET_EGG_PRICES(),
            keccak256(abi.encode(wooden, iron, silver))
        );
        woodenPrice = wooden;
        ironPrice   = iron;
        silverPrice = silver;
        emit EggPricesUpdated(wooden, iron, silver);
    }

    function setBaseUris(string calldata eggMonetUri, string calldata eggUri) external onlyNFTAdmin {
        adminControl.consumeAction(
            adminControl.ACTION_SET_BASE_URIS(),
            keccak256(abi.encodePacked(eggMonetUri, eggUri))
        );
        eggMonetBaseUri = eggMonetUri;
        eggBaseUri      = eggUri;
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

    // ── Nickname ───────────────────────────────────────────────────────────────
    function setNickname(string calldata nick) external {
        if (bytes(nick).length > MAX_NICKNAME_LEN) revert NicknameTooLong();
        nicknames[msg.sender] = nick;
        emit NicknameSet(msg.sender, nick);
    }

    // ── Admin mint ─────────────────────────────────────────────────────────────
    function adminMintEggMonet(
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
            _mintEggMonet(recipient, playerId, tier);
        }
    }

    // ── Buy egg ────────────────────────────────────────────────────────────────
    function buyEgg(uint8 eggType, uint64 count) external payable nonReentrant {
        if (tournamentContract == address(0)) revert TournamentNotSet();
        if (eggType > MAX_EGG_TYPE) revert InvalidEggType();
        if (count == 0 || count > MAX_EGG_BATCH) revert BatchTooLarge();

        uint256 unitPrice = _eggPrice(eggType);
        if (msg.value < unitPrice * count) revert InsufficientPayment();

        for (uint64 i = 0; i < count; i++) {
            _mintEgg(msg.sender, eggType);
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

    // ── Scratch egg ────────────────────────────────────────────────────────────
    function scratchEgg(uint256 eggId) external nonReentrant {
        if (ownerOf(eggId) != msg.sender) revert NotOwnerOfToken();
        if (tokenType[eggId] != TYPE_EGG) revert InvalidEggType();

        uint8 eggType = eggs[eggId].eggType;

        _burn(eggId);

        uint8 tier     = eggType; // Wooden→Common, Iron→Rare, Silver→Epic
        uint8 playerId = _pseudoRand(msg.sender, eggId, 0, maxPlayers);
        uint256 newId  = _mintEggMonet(msg.sender, playerId, tier);

        emit EggScratched(msg.sender, eggId, newId);
    }

    function scratchEggBatch(uint256[] calldata eggIds) external nonReentrant {
        uint256 count = eggIds.length;
        if (count == 0 || count > MAX_EGG_BATCH) revert BatchTooLarge();

        // Dedup check
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (eggIds[i] == eggIds[j]) revert DuplicateToken();
            }
        }

        for (uint256 i = 0; i < count; i++) {
            uint256 eggId = eggIds[i];
            if (ownerOf(eggId) != msg.sender) revert NotOwnerOfToken();
            if (tokenType[eggId] != TYPE_EGG) revert InvalidEggType();

            uint8 eggType = eggs[eggId].eggType;
            _burn(eggId);

            uint8 tier     = eggType;
            uint8 playerId = _pseudoRand(msg.sender, eggId, uint8(i), maxPlayers);
            uint256 newId  = _mintEggMonet(msg.sender, playerId, tier);
            emit EggScratched(msg.sender, eggId, newId);
        }
    }

    // ── Merge eggMonets ────────────────────────────────────────────────────────
    function mergeEggMonets(
        uint8     playerId,
        uint8     tier,
        uint256[] calldata tokenIds
    ) external nonReentrant {
        if (tier >= maxTier) revert MaxTier();
        if (tokenIds.length != MERGE_COUNT) revert WrongEggMonet();

        // Dedup
        for (uint256 i = 0; i < MERGE_COUNT; i++) {
            for (uint256 j = i + 1; j < MERGE_COUNT; j++) {
                if (tokenIds[i] == tokenIds[j]) revert DuplicateToken();
            }
        }

        for (uint256 i = 0; i < MERGE_COUNT; i++) {
            uint256 tid = tokenIds[i];
            if (ownerOf(tid) != msg.sender)               revert NotOwnerOfToken();
            if (isEggMonetLocked(tid))                    revert EggMonetLocked();
            if (tokenType[tid] != TYPE_EGGMONET)          revert WrongEggMonet();
            EggMonetData memory c = eggMonets[tid];
            if (c.playerId != playerId || c.tier != tier) revert WrongEggMonet();

            _burn(tid);
        }

        uint256 newId = _mintEggMonet(msg.sender, playerId, tier + 1);
        emit EggMonetsMerged(msg.sender, newId, playerId, tier + 1);
    }

    // ── EggMonet transfers ─────────────────────────────────────────────────────
    function transferEggMonet(address to, uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotOwnerOfToken();
        if (isEggMonetLocked(tokenId)) revert EggMonetLocked();
        _transfer(msg.sender, to, tokenId);
    }

    // ── EggMonet locking (tournament only) ────────────────────────────────────
    function lockEggMonet(uint256 tokenId, uint256 unlockTs) external onlyTournament {
        lockUntil[tokenId] = unlockTs;
    }

    function unlockEggMonet(uint256 tokenId) external onlyTournament {
        delete lockUntil[tokenId];
    }

    function isEggMonetLocked(uint256 tokenId) public view returns (bool) {
        return block.timestamp < lockUntil[tokenId];
    }

    // ── Admin reissue ──────────────────────────────────────────────────────────
    // MAINNET: adminReissueEggMonet has no timelock (NFT-07, accepted for operational speed).
    // Add consumeAction(ACTION_ADMIN_MINT_TO, ...) here if abuse risk increases with real funds.
    function adminReissueEggMonet(uint256 tokenId) external onlyNFTAdmin {
        if (isEggMonetLocked(tokenId)) revert EggMonetLocked();
        address owner_ = ownerOf(tokenId);
        EggMonetData memory c = eggMonets[tokenId];
        _removeEggMonetFromInventory(owner_, tokenId);
        _burn(tokenId);
        delete lockUntil[tokenId];
        uint256 newTokenId = _mintEggMonet(owner_, c.playerId, c.tier);
        emit EggMonetReissued(owner_, tokenId, newTokenId, c.playerId, c.tier);
    }

    // ── Internal mints ─────────────────────────────────────────────────────────
    function _mintEggMonet(address to, uint8 playerId, uint8 tier) internal returns (uint256) {
        if (tier > maxTier) revert InvalidTier();
        uint256 id = _nextTokenId++;
        // Set metadata BEFORE _safeMint so _afterTokenTransfer can read tokenType
        tokenType[id]  = TYPE_EGGMONET;
        eggMonets[id]  = EggMonetData({ playerId: playerId, tier: tier });
        _safeMint(to, id);
        emit EggMonetMinted(to, id, playerId, tier);
        return id;
    }

    function _mintEgg(address to, uint8 eggType) internal returns (uint256) {
        uint256 id = _nextTokenId++;
        tokenType[id] = TYPE_EGG;
        eggs[id]      = EggData({ eggType: eggType });
        _safeMint(to, id);
        emit EggMinted(to, id, eggType);
        return id;
    }

    // ── Inventory helpers ──────────────────────────────────────────────────────
    function _addEggMonetToInventory(address owner_, uint256 tokenId) internal {
        _eggMonetIndex[tokenId] = _userEggMonets[owner_].length;
        _userEggMonets[owner_].push(tokenId);
    }

    function _removeEggMonetFromInventory(address owner_, uint256 tokenId) internal {
        uint256 idx  = _eggMonetIndex[tokenId];
        uint256 last = _userEggMonets[owner_][_userEggMonets[owner_].length - 1];
        _userEggMonets[owner_][idx] = last;
        _eggMonetIndex[last]        = idx;
        _userEggMonets[owner_].pop();
        delete _eggMonetIndex[tokenId];
    }

    function _addEggToInventory(address owner_, uint256 tokenId) internal {
        _eggIndex[tokenId] = _userEggs[owner_].length;
        _userEggs[owner_].push(tokenId);
    }

    function _removeEggFromInventory(address owner_, uint256 tokenId) internal {
        uint256 idx  = _eggIndex[tokenId];
        uint256 last = _userEggs[owner_][_userEggs[owner_].length - 1];
        _userEggs[owner_][idx] = last;
        _eggIndex[last]        = idx;
        _userEggs[owner_].pop();
        delete _eggIndex[tokenId];
    }

    // Prevents transfer of locked EggMonets via any ERC721 path (transferFrom, safeTransferFrom, _transfer).
    // mint (from==0) and burn (to==0) are explicitly excluded.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        if (from != address(0) && to != address(0)) {
            if (tokenType[firstTokenId] == TYPE_EGGMONET && isEggMonetLocked(firstTokenId)) {
                revert EggMonetLocked();
            }
        }
    }

    // OZ v4 hook — syncs inventory on mint and transfer (burn handled before _burn call)
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
        bool isEggMonet = tokenType[firstTokenId] == TYPE_EGGMONET;
        if (from == address(0)) {
            // mint
            if (isEggMonet) _addEggMonetToInventory(to, firstTokenId);
            else            _addEggToInventory(to, firstTokenId);
        } else if (to == address(0)) {
            // burn
            if (isEggMonet) _removeEggMonetFromInventory(from, firstTokenId);
            else            _removeEggFromInventory(from, firstTokenId);
        } else {
            // transfer
            if (isEggMonet) {
                _removeEggMonetFromInventory(from, firstTokenId);
                _addEggMonetToInventory(to, firstTokenId);
            } else {
                _removeEggFromInventory(from, firstTokenId);
                _addEggToInventory(to, firstTokenId);
            }
        }
    }

    // ── Pseudorandomness ───────────────────────────────────────────────────────
    // NFT-03 (accepted risk): fully deterministic from public inputs — a motivated
    // player can simulate and time scratchEgg to get a desired playerId.
    // Acceptable for MVP/testnet.
    // MAINNET: replace with commit-reveal or Chainlink VRF. With real money, grinding
    // scratchEgg to cherry-pick high-tier players breaks game economy.
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

    function _eggPrice(uint8 eggType) internal view returns (uint256) {
        if (eggType == 0) return woodenPrice;
        if (eggType == 1) return ironPrice;
        return silverPrice;
    }

    // ── Views ──────────────────────────────────────────────────────────────────
    function getUserEggMonets(address owner_) external view returns (uint256[] memory) {
        return _userEggMonets[owner_];
    }

    function getUserEggs(address owner_) external view returns (uint256[] memory) {
        return _userEggs[owner_];
    }

    function getEggMonetInfo(uint256 tokenId) external view returns (uint8 playerId, uint8 tier) {
        EggMonetData memory c = eggMonets[tokenId];
        return (c.playerId, c.tier);
    }

    function getEggPrices() external view returns (uint256 wooden, uint256 iron, uint256 silver) {
        return (woodenPrice, ironPrice, silverPrice);
    }

    // ── Coin/name tables ───────────────────────────────────────────────────────
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
        if (tier == 0) return "Small";
        if (tier == 1) return "Medium";
        if (tier == 2) return "Heavy";
        if (tier == 3) return "SuperHeavy";
        return _extTierName[tier];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721: invalid token ID");
        if (tokenType[tokenId] == TYPE_EGGMONET) {
            EggMonetData memory c = eggMonets[tokenId];
            return string(abi.encodePacked(
                eggMonetBaseUri,
                uint256(c.playerId).toString(),
                "/",
                uint256(c.tier).toString()
            ));
        } else {
            EggData memory e = eggs[tokenId];
            return string(abi.encodePacked(
                eggBaseUri,
                uint256(e.eggType).toString()
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

    // ── ETH receive (prize vault) ──────────────────────────────────────────────
    // MAINNET: direct ETH sent here (not via buyEgg) is permanently locked — no withdrawal function (NFT-02 partial).
    // Add withdrawStuckETH(address to) onlyOwner before launch if operational risk is a concern.
    receive() external payable {}
}
