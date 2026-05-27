// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AdminControl.sol";
import "./CoinDeckNFT.sol";

/**
 * Migrated from tournament.move
 * Р­РїРѕС…Рё/РґРЅРё, lineup submission, card locking, prize vault
 */
contract Tournament is ReentrancyGuard {

    // в”Ђв”Ђ Constants в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    uint256 public constant SLOTS      = 5;
    uint256 public constant EPOCH_DAYS = 6;  // active days per epoch
    uint256 public constant WEEK_DAYS  = 7;  // 6 active + 1 rest

    // Leagues
    uint8 public constant LEAGUE_BRONZE = 0;
    uint8 public constant LEAGUE_SILVER = 1;
    uint8 public constant LEAGUE_GOLD   = 2;

    // в”Ђв”Ђ Structs в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    struct SlotEntry {
        uint8 playerId;
        uint8 tier;
    }

    struct DayLineup {
        uint256    epoch;
        uint256    day;      // 1-based, 1..6
        uint8      league;
        SlotEntry[5] slots;
    }

    struct EpochState {
        bool    running;
        uint256 startTimestamp;
        uint256 baseEpoch;
        uint256 firstVisibleEpoch;
    }

    // в”Ђв”Ђ State в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    AdminControl public adminControl;
    CoinDeckNFT  public nft;

    EpochState public epochState;

    uint256 public changeLineupFee;
    uint256 public cancelLineupFee;

    // player в†’ epoch в†’ day в†’ lineup
    mapping(address => mapping(uint256 => mapping(uint256 => DayLineup))) public lineups;
    // player в†’ epoch в†’ days submitted (bitmask, day 1-6)
    mapping(address => mapping(uint256 => uint64)) public lineupDayMask;

    // participants registry
    address[] public participants;
    mapping(address => bool) public isParticipant;

    // currently locked cards per player (for unlock on resubmit)
    mapping(address => uint256[]) private _playerLockedCards;

    // в”Ђв”Ђ Events в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    event LineupSubmitted(address indexed player, uint256 epoch, uint256 day, uint8 league);
    event LineupCancelled(address indexed player, uint256 epoch, uint256 day, uint256 fee);
    event PrizeDeposited(address indexed funder, uint256 amount);
    event PrizeWithdrawn(address indexed recipient, uint256 amount);
    event EpochStarted(uint256 startTimestamp);
    event EpochStopped(uint256 nextEpoch);
    event EpochsCleared(uint256 firstVisibleEpoch);
    event ConfigUpdated(uint256 changeLineupFee, uint256 cancelLineupFee);

    // в”Ђв”Ђ Errors в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    error NotAdmin();
    error NotEmergencyAdmin();
    error NotTreasuryAdmin();
    error NotActive();
    error AlreadyStarted();
    error InvalidLineup();
    error DayOutOfRange();
    error RestDay();
    error NoLineup();
    error DuplicateCard();
    error CardLocked();
    error TransferFailed();

    // в”Ђв”Ђ Modifiers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    modifier onlyAdmin() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_FULL()) &&
            msg.sender != adminControl.owner())
            revert NotAdmin();
        _;
    }

    modifier onlyEmergency() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_EMERGENCY()) &&
            msg.sender != adminControl.owner())
            revert NotEmergencyAdmin();
        _;
    }

    modifier onlyTreasury() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_TREASURY()) &&
            msg.sender != adminControl.owner())
            revert NotTreasuryAdmin();
        _;
    }

    // в”Ђв”Ђ Constructor в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    constructor(address _adminControl, address _nft) {
        adminControl    = AdminControl(_adminControl);
        nft             = CoinDeckNFT(payable(_nft));
        cancelLineupFee = 0.0005 ether; // ~0.5 MOVE equivalent default
        epochState      = EpochState({
            running:            false,
            startTimestamp:     0,
            baseEpoch:          1,
            firstVisibleEpoch:  1
        });
    }

    // в”Ђв”Ђ Config в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function setConfig(uint256 _changeLineupFee, uint256 _cancelLineupFee) external onlyAdmin {
        adminControl.assertEpochSettingsMutable();
        changeLineupFee = _changeLineupFee;
        cancelLineupFee = _cancelLineupFee;
        emit ConfigUpdated(_changeLineupFee, _cancelLineupFee);
    }

    // в”Ђв”Ђ Epoch lifecycle в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function startEpoch(uint256 startTimestamp) external onlyAdmin {
        if (epochState.running) revert AlreadyStarted();
        epochState.running        = true;
        epochState.startTimestamp = startTimestamp;
        adminControl.onEpochStarted();
        emit EpochStarted(startTimestamp);
    }

    function stopAndReset() external onlyEmergency {
        adminControl.consumeAction(adminControl.ACTION_STOP_AND_RESET(), keccak256(""));
        (uint256 curEpoch,,) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );
        epochState.running           = false;
        epochState.startTimestamp    = 0;
        epochState.baseEpoch         = curEpoch + 1;
        epochState.firstVisibleEpoch = curEpoch + 1;
        adminControl.onEpochStopped();
        emit EpochStopped(curEpoch + 1);
    }

    function adminClearEpochs() external onlyAdmin {
        (uint256 curEpoch,,) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );
        epochState.firstVisibleEpoch = curEpoch;
        emit EpochsCleared(curEpoch);
    }

    // в”Ђв”Ђ Prize vault в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function depositPrize() external payable {
        emit PrizeDeposited(msg.sender, msg.value);
    }

    function withdrawTo(address recipient, uint256 amount) external onlyTreasury nonReentrant {
        adminControl.consumeAction(
            adminControl.ACTION_TREASURY_WITHDRAW(),
            keccak256(abi.encode(recipient, amount))
        );
        adminControl.checkWithdrawal(amount);
        (bool ok,) = payable(recipient).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit PrizeWithdrawn(recipient, amount);
    }

    // в”Ђв”Ђ Lineup submission в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function submitLineup(uint256[5] calldata cardIds) external payable nonReentrant {
        if (!epochState.running) revert NotActive();

        (uint256 epoch, uint256 day, bool isRest) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );
        if (isRest)           revert RestDay();
        if (day < 1 || day > EPOCH_DAYS) revert DayOutOfRange();

        // Validate ownership and build slot entries
        uint8 rare = 0; uint8 epic = 0; uint8 legendary = 0;

        // Dedup check
        for (uint256 i = 0; i < SLOTS; i++) {
            for (uint256 j = i + 1; j < SLOTS; j++) {
                if (cardIds[i] == cardIds[j]) revert DuplicateCard();
            }
        }

        SlotEntry[5] memory slots;
        for (uint256 i = 0; i < SLOTS; i++) {
            uint256 cardId = cardIds[i];
            if (nft.ownerOf(cardId) != msg.sender) revert InvalidLineup();
            (uint8 playerId, uint8 tier) = nft.getCardInfo(cardId);
            if (tier == 1) rare++;
            if (tier == 2) epic++;
            if (tier == 3) legendary++;
            slots[i] = SlotEntry({ playerId: playerId, tier: tier });
        }

        // League determination
        uint8 league;
        if (legendary > 0 || epic >= 5)    league = LEAGUE_GOLD;
        else if (epic > 0 || rare >= 5)    league = LEAGUE_SILVER;
        else                                league = LEAGUE_BRONZE;

        // Resubmit fee
        bool isResubmit = (lineupDayMask[msg.sender][epoch] & (uint64(1) << uint64(day))) != 0;
        if (isResubmit && changeLineupFee > 0) {
            if (msg.value < changeLineupFee) revert InvalidLineup();
            // keep ETH in contract as prize
        }

        // Store lineup
        DayLineup storage dl = lineups[msg.sender][epoch][day];
        dl.epoch  = epoch;
        dl.day    = day;
        dl.league = league;
        for (uint256 i = 0; i < SLOTS; i++) {
            dl.slots[i] = slots[i];
        }
        lineupDayMask[msg.sender][epoch] |= uint64(1) << uint64(day);

        // Register participant
        if (!isParticipant[msg.sender]) {
            isParticipant[msg.sender] = true;
            participants.push(msg.sender);
        }

        // Unlock old cards, lock new ones
        _unlockPlayerCards(msg.sender);
        uint256 unlockTs = epochState.startTimestamp + day * 1 days;
        for (uint256 i = 0; i < SLOTS; i++) {
            nft.lockCard(cardIds[i], unlockTs);
        }
        // Store locked card list for next unlock
        delete _playerLockedCards[msg.sender];
        for (uint256 i = 0; i < SLOTS; i++) {
            _playerLockedCards[msg.sender].push(cardIds[i]);
        }

        emit LineupSubmitted(msg.sender, epoch, day, league);
    }

    // в”Ђв”Ђ Cancel lineup в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function cancelLineup() external payable nonReentrant {
        if (!epochState.running) revert NotActive();
        (uint256 epoch, uint256 day,) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );

        if ((lineupDayMask[msg.sender][epoch] & (uint64(1) << uint64(day))) == 0) revert NoLineup();

        if (cancelLineupFee > 0) {
            if (msg.value < cancelLineupFee) revert NoLineup();
        }

        // Remove lineup
        delete lineups[msg.sender][epoch][day];
        lineupDayMask[msg.sender][epoch] &= ~(uint64(1) << uint64(day));

        // Unlock cards
        _unlockPlayerCards(msg.sender);

        emit LineupCancelled(msg.sender, epoch, day, cancelLineupFee);
    }

    // в”Ђв”Ђ Internal helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function _unlockPlayerCards(address player) internal {
        uint256[] storage locked = _playerLockedCards[player];
        uint256 len = locked.length;
        for (uint256 i = 0; i < len; i++) {
            nft.unlockCard(locked[i]);
        }
        delete _playerLockedCards[player];
    }

    // Pure epoch/day computation from stored values вЂ” no state access
    function _epochDayFrom(
        uint256 startTs,
        uint256 baseEpoch,
        bool    running
    ) internal view returns (uint256 epoch, uint256 day, bool isRest) {
        if (!running || startTs == 0) return (baseEpoch, 0, false);
        if (block.timestamp < startTs) return (baseEpoch, 0, false);

        uint256 elapsedDays = (block.timestamp - startTs) / 1 days;
        uint256 weekPos     = elapsedDays % WEEK_DAYS;
        uint256 weeksPassed = elapsedDays / WEEK_DAYS;
        epoch  = baseEpoch + weeksPassed;
        isRest = weekPos >= EPOCH_DAYS;
        day    = isRest ? 0 : weekPos + 1;
    }

    // в”Ђв”Ђ Views в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function getState() external view returns (
        bool    running,
        uint256 epoch,
        uint256 day,
        bool    isRestDay,
        uint256 startTimestamp,
        uint256 prizePool,
        uint256 changeFee,
        uint256 firstVisibleEpoch
    ) {
        running           = epochState.running;
        startTimestamp    = epochState.startTimestamp;
        firstVisibleEpoch = epochState.firstVisibleEpoch;
        changeFee         = changeLineupFee;
        prizePool         = address(this).balance;
        (epoch, day, isRestDay) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );
    }

    function getCurrentEpochDay() external view returns (uint256 epoch, uint256 day, bool isRest) {
        return _epochDayFrom(epochState.startTimestamp, epochState.baseEpoch, epochState.running);
    }

    function getLineupSlots(address player, uint256 epoch, uint256 day)
        external view returns (uint8[5] memory playerIds, uint8[5] memory tiers)
    {
        DayLineup storage dl = lineups[player][epoch][day];
        for (uint256 i = 0; i < SLOTS; i++) {
            playerIds[i] = dl.slots[i].playerId;
            tiers[i]     = dl.slots[i].tier;
        }
    }

    function getPlayerLineups(address player, uint256 epoch)
        external view returns (uint256[] memory epochDays, uint8[] memory leagues)
    {
        uint256 count = 0;
        uint64 mask = lineupDayMask[player][epoch];
        for (uint256 d = 1; d <= EPOCH_DAYS; d++) {
            if ((mask & (uint64(1) << uint64(d))) != 0) count++;
        }
        epochDays = new uint256[](count);
        leagues   = new uint8[](count);
        uint256 idx = 0;
        for (uint256 d = 1; d <= EPOCH_DAYS; d++) {
            if ((mask & (uint64(1) << uint64(d))) != 0) {
                epochDays[idx] = d;
                leagues[idx]   = lineups[player][epoch][d].league;
                idx++;
            }
        }
    }

    function hasLineupForDay(address player, uint256 epoch, uint256 day)
        external view returns (bool)
    {
        return (lineupDayMask[player][epoch] & (uint64(1) << uint64(day))) != 0;
    }

    function participantsCount() external view returns (uint256) {
        return participants.length;
    }

    function getParticipantsPage(uint256 offset, uint256 limit)
        external view returns (address[] memory)
    {
        uint256 total = participants.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = participants[i];
        }
        return result;
    }

    // Bulk lineup fetch for leaderboard worker вЂ” paginated
    function getDayLineupsPaginated(
        uint256 epoch,
        uint256 day,
        uint256 offset,
        uint256 limit
    ) external view returns (
        address[] memory addrs,
        uint8[]   memory playerIds,
        uint8[]   memory tiers,
        uint256          total
    ) {
        total = participants.length;
        if (offset >= total) {
            return (new address[](0), new uint8[](0), new uint8[](0), total);
        }
        uint256 end = offset + limit > total ? total : offset + limit;

        // First pass: count matches
        uint256 matchCount = 0;
        for (uint256 i = offset; i < end; i++) {
            address p = participants[i];
            if ((lineupDayMask[p][epoch] & (uint64(1) << uint64(day))) != 0) matchCount++;
        }

        addrs     = new address[](matchCount);
        playerIds = new uint8[](matchCount * SLOTS);
        tiers     = new uint8[](matchCount * SLOTS);
        uint256 idx = 0;
        for (uint256 i = offset; i < end; i++) {
            address p = participants[i];
            if ((lineupDayMask[p][epoch] & (uint64(1) << uint64(day))) != 0) {
                addrs[idx] = p;
                DayLineup storage dl = lineups[p][epoch][day];
                for (uint256 s = 0; s < SLOTS; s++) {
                    playerIds[idx * SLOTS + s] = dl.slots[s].playerId;
                    tiers[idx * SLOTS + s]     = dl.slots[s].tier;
                }
                idx++;
            }
        }
    }

    function getCancelFee() external view returns (uint256) {
        return cancelLineupFee;
    }

    function isCardLocked(uint256 tokenId) external view returns (bool) {
        return nft.isCardLocked(tokenId);
    }

    // в”Ђв”Ђ ETH receive в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    receive() external payable {
        emit PrizeDeposited(msg.sender, msg.value);
    }
}
