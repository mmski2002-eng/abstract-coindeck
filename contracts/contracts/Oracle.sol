// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AdminControl.sol";

/**
 * Migrated from oracle.move
 * Admin posts base points per player per day
 */
contract Oracle {

    uint256 public constant MAX_BASE_POINTS = 10_000;

    AdminControl public adminControl;

    // day → playerId → base points
    mapping(uint256 => mapping(uint8 => uint256)) public dayScores;
    // day → posted flag
    mapping(uint256 => bool) public dayPosted;
    // day → list of playerIds posted (for enumeration)
    mapping(uint256 => uint8[]) private _dayPlayerIds;

    event ScoresPosted(address indexed admin, uint256 indexed day, uint256 entries);
    event PostedFlagChanged(address indexed admin, uint256 indexed day, bool posted);
    event DaysReset(address indexed admin);

    error NotOracleAdmin();
    error WrongLengths();
    error ScoreTooHigh();
    error DayAlreadyPosted();
    error CannotUnpostDay();

    modifier onlyOracleAdmin() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_ORACLE()) &&
            msg.sender != adminControl.owner())
            revert NotOracleAdmin();
        _;
    }

    constructor(address _adminControl) {
        adminControl = AdminControl(_adminControl);
    }

    function postDayScores(
        uint256   day,
        uint8[]   calldata playerIds,
        uint256[] calldata basePoints
    ) external onlyOracleAdmin {
        if (dayPosted[day]) revert DayAlreadyPosted();
        uint256 len = playerIds.length;
        if (len != basePoints.length) revert WrongLengths();

        // Clear existing entries for this day
        uint8[] storage existing = _dayPlayerIds[day];
        uint256 exLen = existing.length;
        for (uint256 i = 0; i < exLen; i++) {
            delete dayScores[day][existing[i]];
        }
        delete _dayPlayerIds[day];

        for (uint256 i = 0; i < len; i++) {
            if (basePoints[i] > MAX_BASE_POINTS) revert ScoreTooHigh();
            dayScores[day][playerIds[i]] = basePoints[i];
            _dayPlayerIds[day].push(playerIds[i]);
        }
        dayPosted[day] = true;

        emit ScoresPosted(msg.sender, day, len);
    }

    function setPosted(uint256 day, bool posted) external onlyOracleAdmin {
        if (!posted && dayPosted[day]) revert CannotUnpostDay();
        dayPosted[day] = posted;
        emit PostedFlagChanged(msg.sender, day, posted);
    }

    function resetAllDays(uint256[] calldata daysToReset) external onlyOracleAdmin {
        adminControl.consumeAction(adminControl.ACTION_RESET_ALL_ORACLE_DAYS(), keccak256(abi.encode(daysToReset)));
        for (uint256 d = 0; d < daysToReset.length; d++) {
            uint256 day = daysToReset[d];
            uint8[] storage pids = _dayPlayerIds[day];
            for (uint256 i = 0; i < pids.length; i++) {
                delete dayScores[day][pids[i]];
            }
            delete _dayPlayerIds[day];
            delete dayPosted[day];
        }
        emit DaysReset(msg.sender);
    }

    // ── Views ─────────────────────────────────────────────────────────────────
    function getDayScores(uint256 day) external view returns (
        uint8[]   memory playerIds,
        uint256[] memory points,
        bool             posted
    ) {
        playerIds = _dayPlayerIds[day];
        uint256 len = playerIds.length;
        points = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            points[i] = dayScores[day][playerIds[i]];
        }
        posted = dayPosted[day];
    }

    function isDayPosted(uint256 day) external view returns (bool) {
        return dayPosted[day];
    }
}
