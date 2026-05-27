// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AdminControl.sol";
import "./CoinDeckNFT.sol";

/**
 * Migrated from marketplace.move
 * P2P Р»РёСЃС‚РёРЅРіРё СЃ escrow, 5% fee, batch buy, admin clear
 */
contract Marketplace is ReentrancyGuard {

    uint256 public constant MARKETPLACE_FEE_BPS = 500;  // 5%
    uint256 public constant MIN_LISTING_PRICE   = 0.00002 ether;
    uint256 public constant MAX_BATCH_BUY       = 20;
    uint256 public constant MAX_CLEAR_PAGE      = 100;

    AdminControl public adminControl;
    CoinDeckNFT  public nft;

    struct Listing {
        uint256 id;
        address seller;
        uint256 cardId;
        uint8   playerId;
        uint8   tier;
        uint256 price;
        uint256 vecIdx; // position in listingIds for O(1) swap-remove
    }

    mapping(uint256 => Listing) public listings;      // listingId в†’ Listing
    mapping(uint256 => uint256) public byCard;         // cardId в†’ listingId
    uint256[] public listingIds;
    uint256 public nextId;
    bool    public pendingClear;

    // accumulated fees вЂ” owner pulls
    uint256 public accumulatedFees;

    event CardListed(uint256 indexed listingId, address indexed seller, uint256 cardId, uint8 playerId, uint8 tier, uint256 price);
    event CardBought(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 cardId, uint256 price, uint256 fee);
    event ListingCancelled(uint256 indexed listingId, address indexed seller, uint256 cardId);
    event ListingsCleared(address indexed admin, uint256 count);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error NotAdmin();
    error NotEmergencyAdmin();
    error NotInitialized();
    error ListingNotFound();
    error NotSeller();
    error CannotBuyOwn();
    error NotOwner();
    error AlreadyListed();
    error PriceTooLow();
    error CardLocked();
    error BatchTooLarge();
    error DuplicateListing();
    error NoPendingClear();
    error TransferFailed();
    error InsufficientPayment();

    modifier onlyEmergency() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_EMERGENCY()) &&
            msg.sender != adminControl.owner())
            revert NotEmergencyAdmin();
        _;
    }

    constructor(address _adminControl, address _nft) {
        adminControl = AdminControl(_adminControl);
        nft          = CoinDeckNFT(payable(_nft));
    }

    // в”Ђв”Ђ List в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function listCard(uint256 cardId, uint256 price) external nonReentrant {
        if (price < MIN_LISTING_PRICE) revert PriceTooLow();
        if (nft.ownerOf(cardId) != msg.sender) revert NotOwner();
        if (nft.isCardLocked(cardId)) revert CardLocked();
        if (byCard[cardId] != 0 || (listingIds.length > 0 && _listingExists(cardId))) revert AlreadyListed();

        (uint8 playerId, uint8 tier) = nft.getCardInfo(cardId);
        uint256 id     = nextId++;
        uint256 vecIdx = listingIds.length;
        listingIds.push(id);

        listings[id] = Listing({
            id:       id,
            seller:   msg.sender,
            cardId:   cardId,
            playerId: playerId,
            tier:     tier,
            price:    price,
            vecIdx:   vecIdx
        });
        byCard[cardId] = id + 1; // +1 so 0 = not listed

        // Escrow card to this contract
        nft.transferFrom(msg.sender, address(this), cardId);

        emit CardListed(id, msg.sender, cardId, playerId, tier, price);
    }

    // в”Ђв”Ђ Buy в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function buyCard(uint256 listingId) external payable nonReentrant {
        Listing memory l = _getListing(listingId);
        if (l.seller == msg.sender) revert CannotBuyOwn();
        if (msg.value < l.price) revert InsufficientPayment();

        _removeListing(listingId, l.cardId, l.vecIdx);

        uint256 fee     = l.price * MARKETPLACE_FEE_BPS / 10_000;
        uint256 payout  = l.price - fee;
        accumulatedFees += fee;

        // Refund excess
        uint256 excess = msg.value - l.price;
        if (excess > 0) {
            (bool ok,) = payable(msg.sender).call{value: excess}("");
            if (!ok) revert TransferFailed();
        }

        // Pay seller
        (bool ok2,) = payable(l.seller).call{value: payout}("");
        if (!ok2) revert TransferFailed();

        // Transfer card to buyer
        nft.transferFrom(address(this), msg.sender, l.cardId);

        emit CardBought(listingId, msg.sender, l.seller, l.cardId, l.price, fee);
    }

    function buyCardsBatch(uint256[] calldata ids) external payable nonReentrant {
        uint256 count = ids.length;
        if (count == 0 || count > MAX_BATCH_BUY) revert BatchTooLarge();

        // Dedup
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (ids[i] == ids[j]) revert DuplicateListing();
            }
        }

        // Compute total cost first
        uint256 totalCost = 0;
        for (uint256 i = 0; i < count; i++) {
            totalCost += _getListing(ids[i]).price;
        }
        if (msg.value < totalCost) revert InsufficientPayment();

        for (uint256 i = 0; i < count; i++) {
            Listing memory l = _getListing(ids[i]);
            if (l.seller == msg.sender) revert CannotBuyOwn();

            _removeListing(ids[i], l.cardId, l.vecIdx);

            uint256 fee    = l.price * MARKETPLACE_FEE_BPS / 10_000;
            uint256 payout = l.price - fee;
            accumulatedFees += fee;

            (bool ok,) = payable(l.seller).call{value: payout}("");
            if (!ok) revert TransferFailed();

            nft.transferFrom(address(this), msg.sender, l.cardId);
            emit CardBought(ids[i], msg.sender, l.seller, l.cardId, l.price, fee);
        }

        // Refund excess
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool ok,) = payable(msg.sender).call{value: excess}("");
            if (!ok) revert TransferFailed();
        }
    }

    // в”Ђв”Ђ Cancel в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing memory l = _getListing(listingId);
        if (l.seller != msg.sender) revert NotSeller();

        _removeListing(listingId, l.cardId, l.vecIdx);
        nft.transferFrom(address(this), msg.sender, l.cardId);

        emit ListingCancelled(listingId, msg.sender, l.cardId);
    }

    // в”Ђв”Ђ Admin clear в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function adminClearListings() external onlyEmergency {
        adminControl.consumeAction(adminControl.ACTION_CLEAR_LISTINGS(), keccak256(""));
        pendingClear = true;
        uint256 cleared = _doClearPage();
        emit ListingsCleared(msg.sender, cleared);
    }

    function adminClearListingsPage() external onlyEmergency {
        if (!pendingClear) revert NoPendingClear();
        uint256 cleared = _doClearPage();
        emit ListingsCleared(msg.sender, cleared);
    }

    function _doClearPage() internal returns (uint256 cleared) {
        while (listingIds.length > 0 && cleared < MAX_CLEAR_PAGE) {
            uint256 id = listingIds[0];
            Listing memory l = listings[id];
            _removeListing(id, l.cardId, l.vecIdx);
            nft.transferFrom(address(this), l.seller, l.cardId);
            cleared++;
        }
        if (listingIds.length == 0) {
            pendingClear = false;
            nextId       = 0;
        }
    }

    // в”Ђв”Ђ Fee withdrawal в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function withdrawFees(address to) external nonReentrant {
        if (msg.sender != adminControl.owner()) revert NotAdmin();
        uint256 amount  = accumulatedFees;
        accumulatedFees = 0;
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit FeesWithdrawn(to, amount);
    }

    // в”Ђв”Ђ Internal helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function _getListing(uint256 listingId) internal view returns (Listing memory) {
        Listing memory l = listings[listingId];
        if (l.seller == address(0)) revert ListingNotFound();
        return l;
    }

    function _listingExists(uint256 cardId) internal view returns (bool) {
        uint256 raw = byCard[cardId];
        if (raw == 0) return false;
        return listings[raw - 1].seller != address(0);
    }

    function _removeListing(uint256 id, uint256 cardId, uint256 vecIdx) internal {
        delete listings[id];
        delete byCard[cardId];

        uint256 last = listingIds.length - 1;
        if (vecIdx < last) {
            uint256 swappedId = listingIds[last];
            listingIds[vecIdx] = swappedId;
            listings[swappedId].vecIdx = vecIdx;
        }
        listingIds.pop();
    }

    // в”Ђв”Ђ Views в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function listingCount() external view returns (uint256) {
        return listingIds.length;
    }

    function getListingsPage(uint256 offset, uint256 limit) external view returns (
        uint256[] memory ids,
        address[] memory sellers,
        uint256[] memory cardIds,
        uint8[]   memory playerIds,
        uint8[]   memory tiers,
        uint256[] memory prices
    ) {
        uint256 total  = listingIds.length;
        uint256 end    = offset + limit > total ? total : offset + limit;
        uint256 len    = end > offset ? end - offset : 0;
        ids       = new uint256[](len);
        sellers   = new address[](len);
        cardIds   = new uint256[](len);
        playerIds = new uint8[](len);
        tiers     = new uint8[](len);
        prices    = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            Listing memory l = listings[listingIds[offset + i]];
            ids[i]       = l.id;
            sellers[i]   = l.seller;
            cardIds[i]   = l.cardId;
            playerIds[i] = l.playerId;
            tiers[i]     = l.tier;
            prices[i]    = l.price;
        }
    }

    function getFeesBps() external pure returns (uint256) {
        return MARKETPLACE_FEE_BPS;
    }
}
