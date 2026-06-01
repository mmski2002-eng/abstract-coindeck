// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AdminControl.sol";
import "./CoinDeckNFT.sol";

/**
 * Эпохи/дни, weighing submission, eggMonet locking, prize vault
 */
contract Tournament is ReentrancyGuard {

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant SLOTS      = 5;
    uint256 public constant EPOCH_DAYS = 6;  // active days per epoch
    uint256 public constant WEEK_DAYS  = 7;  // 6 active + 1 rest

    // Leagues
    uint8 public constant LEAGUE_BRONZE = 0;
    uint8 public constant LEAGUE_SILVER = 1;
    uint8 public constant LEAGUE_GOLD   = 2;

    // ── Structs ────────────────────────────────────────────────────────────────
    struct SlotEntry {
        uint8 playerId;
        uint8 tier;
    }

    struct DayWeighing {
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

    // ── State ──────────────────────────────────────────────────────────────────
    AdminControl public adminControl;
    CoinDeckNFT  public nft;

    EpochState public epochState;

    uint256 public changeWeighingFee;
    uint256 public cancelWeighingFee;

    // player → epoch → day → weighing
    mapping(address => mapping(uint256 => mapping(uint256 => DayWeighing))) public weighings;
    // player → epoch → days submitted (bitmask, day 1-6)
    mapping(address => mapping(uint256 => uint64)) public weighingDayMask;

    // participants registry
    address[] public participants;
    mapping(address => bool) public isParticipant;

    // currently locked eggMonets per player (for unlock on resubmit)
    mapping(address => uint256[]) private _playerLockedEggMonets;

    // ── Events ─────────────────────────────────────────────────────────────────
    event WeighingSubmitted(address indexed player, uint256 epoch, uint256 day, uint8 league);
    event WeighingCancelled(address indexed player, uint256 epoch, uint256 day, uint256 fee);
    event PrizeDeposited(address indexed funder, uint256 amount);
    event PrizeWithdrawn(address indexed recipient, uint256 amount);
    event EpochStarted(uint256 startTimestamp);
    event EpochStopped(uint256 nextEpoch);
    event EpochsCleared(uint256 firstVisibleEpoch);
    event ConfigUpdated(uint256 changeWeighingFee, uint256 cancelWeighingFee);
    event EmergencyUnlockPage(uint256 offset, uint256 count);

    // ── Errors ─────────────────────────────────────────────────────────────────
    error NotAdmin();
    error NotEmergencyAdmin();
    error NotTreasuryAdmin();
    error NotActive();
    error AlreadyStarted();
    error InvalidWeighing();
    error DayOutOfRange();
    error RestDay();
    error NoWeighing();
    error DuplicateEggMonet();
    error EggMonetLocked();
    error TransferFailed();

    // ── Modifiers ──────────────────────────────────────────────────────────────
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

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address _adminControl, address _nft) {
        adminControl       = AdminControl(_adminControl);
        nft                = CoinDeckNFT(payable(_nft));
        cancelWeighingFee  = 0.0005 ether;
        epochState         = EpochState({
            running:            false,
            startTimestamp:     0,
            baseEpoch:          1,
            firstVisibleEpoch:  1
        });
    }

    // ── Config ─────────────────────────────────────────────────────────────────
    function setConfig(uint256 _changeWeighingFee, uint256 _cancelWeighingFee) external onlyAdmin {
        adminControl.assertEpochSettingsMutable();
        changeWeighingFee = _changeWeighingFee;
        cancelWeighingFee = _cancelWeighingFee;
        emit ConfigUpdated(_changeWeighingFee, _cancelWeighingFee);
    }

    // ── Epoch lifecycle ────────────────────────────────────────────────────────
    function startEpoch(uint256 startTimestamp) external onlyAdmin {
        if (epochState.running) revert AlreadyStarted();
        epochState.running        = true;
        epochState.startTimestamp = startTimestamp;
        adminControl.onEpochStarted();
        emit EpochStarted(startTimestamp);
    }

    // MAINNET: after stopAndReset(), call emergencyUnlockPage(offset, 100) repeatedly until
    // all participants' EggMonets are unlocked (TRN-01). participants[] is never pruned so
    // page count grows over time — automate this in the emergency runbook.
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

    function emergencyUnlockPage(uint256 offset, uint256 limit) external onlyEmergency {
        uint256 total = participants.length;
        if (offset >= total) return;
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 count = 0;
        for (uint256 i = offset; i < end; i++) {
            _unlockPlayerEggMonets(participants[i]);
            count++;
        }
        emit EmergencyUnlockPage(offset, count);
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

    // ── Prize vault ────────────────────────────────────────────────────────────
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

    // ── Weighing submission ────────────────────────────────────────────────────
    function submitWeighing(uint256[5] calldata eggMonetIds) external payable nonReentrant {
        if (!epochState.running) revert NotActive();

        (uint256 epoch, uint256 day, bool isRest) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );
        if (isRest)           revert RestDay();
        if (day < 1 || day > EPOCH_DAYS) revert DayOutOfRange();

        // Unlock own previously locked eggMonets first so resubmit with same tokens works
        _unlockPlayerEggMonets(msg.sender);

        // Dedup check
        for (uint256 i = 0; i < SLOTS; i++) {
            for (uint256 j = i + 1; j < SLOTS; j++) {
                if (eggMonetIds[i] == eggMonetIds[j]) revert DuplicateEggMonet();
            }
        }

        uint8 rare = 0; uint8 epic = 0; uint8 legendary = 0;

        SlotEntry[5] memory slots;
        for (uint256 i = 0; i < SLOTS; i++) {
            uint256 eggMonetId = eggMonetIds[i];
            if (nft.ownerOf(eggMonetId) != msg.sender) revert InvalidWeighing();
            if (nft.tokenType(eggMonetId) != nft.TYPE_EGGMONET()) revert InvalidWeighing();
            if (nft.isEggMonetLocked(eggMonetId)) revert EggMonetLocked();
            (uint8 playerId, uint8 tier) = nft.getEggMonetInfo(eggMonetId);
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
        bool isResubmit = (weighingDayMask[msg.sender][epoch] & (uint64(1) << uint64(day))) != 0;
        if (isResubmit && changeWeighingFee > 0) {
            if (msg.value < changeWeighingFee) revert InvalidWeighing();
        }

        // Store weighing
        DayWeighing storage dw = weighings[msg.sender][epoch][day];
        dw.epoch  = epoch;
        dw.day    = day;
        dw.league = league;
        for (uint256 i = 0; i < SLOTS; i++) {
            dw.slots[i] = slots[i];
        }
        weighingDayMask[msg.sender][epoch] |= uint64(1) << uint64(day);

        // Register participant
        if (!isParticipant[msg.sender]) {
            isParticipant[msg.sender] = true;
            participants.push(msg.sender);
        }

        // Lock new eggMonets (own tokens already unlocked at top of function)
        uint256 unlockTs = epochState.startTimestamp + day * 1 days;
        for (uint256 i = 0; i < SLOTS; i++) {
            nft.lockEggMonet(eggMonetIds[i], unlockTs);
        }
        // Store locked eggMonet list for next unlock
        delete _playerLockedEggMonets[msg.sender];
        for (uint256 i = 0; i < SLOTS; i++) {
            _playerLockedEggMonets[msg.sender].push(eggMonetIds[i]);
        }

        emit WeighingSubmitted(msg.sender, epoch, day, league);
    }

    // ── Cancel weighing ────────────────────────────────────────────────────────
    function cancelWeighing() external payable nonReentrant {
        if (!epochState.running) revert NotActive();
        (uint256 epoch, uint256 day,) = _epochDayFrom(
            epochState.startTimestamp,
            epochState.baseEpoch,
            epochState.running
        );

        if ((weighingDayMask[msg.sender][epoch] & (uint64(1) << uint64(day))) == 0) revert NoWeighing();

        if (cancelWeighingFee > 0) {
            if (msg.value < cancelWeighingFee) revert NoWeighing();
        }

        // Remove weighing
        delete weighings[msg.sender][epoch][day];
        weighingDayMask[msg.sender][epoch] &= ~(uint64(1) << uint64(day));

        // Unlock eggMonets
        _unlockPlayerEggMonets(msg.sender);

        emit WeighingCancelled(msg.sender, epoch, day, cancelWeighingFee);
    }

    // ── Internal helpers ───────────────────────────────────────────────────────
    function _unlockPlayerEggMonets(address player) internal {
        uint256[] storage locked = _playerLockedEggMonets[player];
        uint256 len = locked.length;
        for (uint256 i = 0; i < len; i++) {
            nft.unlockEggMonet(locked[i]);
        }
        delete _playerLockedEggMonets[player];
    }

    // Pure epoch/day computation from stored values — no state access
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

    // ── Views ──────────────────────────────────────────────────────────────────
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
        changeFee         = changeWeighingFee;
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

    function getWeighingSlots(address player, uint256 epoch, uint256 day)
        external view returns (uint8[5] memory playerIds, uint8[5] memory tiers)
    {
        DayWeighing storage dw = weighings[player][epoch][day];
        for (uint256 i = 0; i < SLOTS; i++) {
            playerIds[i] = dw.slots[i].playerId;
            tiers[i]     = dw.slots[i].tier;
        }
    }

    function getPlayerWeighings(address player, uint256 epoch)
        external view returns (uint256[] memory epochDays, uint8[] memory leagues)
    {
        uint256 count = 0;
        uint64 mask = weighingDayMask[player][epoch];
        for (uint256 d = 1; d <= EPOCH_DAYS; d++) {
            if ((mask & (uint64(1) << uint64(d))) != 0) count++;
        }
        epochDays = new uint256[](count);
        leagues   = new uint8[](count);
        uint256 idx = 0;
        for (uint256 d = 1; d <= EPOCH_DAYS; d++) {
            if ((mask & (uint64(1) << uint64(d))) != 0) {
                epochDays[idx] = d;
                leagues[idx]   = weighings[player][epoch][d].league;
                idx++;
            }
        }
    }

    function hasWeighingForDay(address player, uint256 epoch, uint256 day)
        external view returns (bool)
    {
        return (weighingDayMask[player][epoch] & (uint64(1) << uint64(day))) != 0;
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

    // Bulk weighing fetch for leaderboard worker — paginated
    function getDayWeighingsPaginated(
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
            if ((weighingDayMask[p][epoch] & (uint64(1) << uint64(day))) != 0) matchCount++;
        }

        addrs     = new address[](matchCount);
        playerIds = new uint8[](matchCount * SLOTS);
        tiers     = new uint8[](matchCount * SLOTS);
        uint256 idx = 0;
        for (uint256 i = offset; i < end; i++) {
            address p = participants[i];
            if ((weighingDayMask[p][epoch] & (uint64(1) << uint64(day))) != 0) {
                addrs[idx] = p;
                DayWeighing storage dw = weighings[p][epoch][day];
                for (uint256 s = 0; s < SLOTS; s++) {
                    playerIds[idx * SLOTS + s] = dw.slots[s].playerId;
                    tiers[idx * SLOTS + s]     = dw.slots[s].tier;
                }
                idx++;
            }
        }
    }

    function getCancelFee() external view returns (uint256) {
        return cancelWeighingFee;
    }

    function isEggMonetLocked(uint256 tokenId) external view returns (bool) {
        return nft.isEggMonetLocked(tokenId);
    }

    // ── ETH receive ────────────────────────────────────────────────────────────
    receive() external payable {
        emit PrizeDeposited(msg.sender, msg.value);
    }
}
