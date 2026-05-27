// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * Migrated from admin_control.move
 * Timelock + role-based access + withdrawal policy + epoch guard
 */
contract AdminControl is Ownable, ReentrancyGuard {

    // в”Ђв”Ђ Roles (bitmask) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    uint8 public constant ROLE_ORACLE    = 1;
    uint8 public constant ROLE_TREASURY  = 2;
    uint8 public constant ROLE_NFT       = 4;
    uint8 public constant ROLE_CLAIM     = 8;
    uint8 public constant ROLE_EMERGENCY = 16;
    uint8 public constant ROLE_FULL      = 31;

    // в”Ђв”Ђ Action types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    uint8 public constant ACTION_SET_BASE_URIS          = 0;
    uint8 public constant ACTION_SET_CHEST_PRICES       = 1;
    uint8 public constant ACTION_ADMIN_MINT_TO          = 2;
    uint8 public constant ACTION_RESET_ALL_ORACLE_DAYS  = 3;
    uint8 public constant ACTION_TREASURY_WITHDRAW      = 4;
    uint8 public constant ACTION_SET_CLAIM_DAYS         = 5;
    uint8 public constant ACTION_SET_CLAIM_LIST         = 6;
    uint8 public constant ACTION_START_CLAIM            = 7;
    uint8 public constant ACTION_CLOSE_CLAIM            = 8;
    uint8 public constant ACTION_STOP_AND_RESET         = 9;
    uint8 public constant ACTION_CLEAR_LISTINGS         = 10;
    uint8 internal constant ACTION_COUNT                = 11;

    // в”Ђв”Ђ Structs в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    struct QueuedAction {
        uint8   actionType;
        bytes32 payloadHash;
        uint256 createdAt;
        uint256 executeAfter;
    }

    struct WithdrawalPolicy {
        bool    enabled;
        uint256 perTxLimit;
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 dayIndex;
    }

    struct EpochGuard {
        bool freezeDuringEpoch;
        bool epochActive;
    }

    // в”Ђв”Ђ State в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    mapping(uint8 => uint256) public actionDelays;
    QueuedAction[]            public queuedActions;

    WithdrawalPolicy public withdrawalPolicy;
    EpochGuard       public epochGuard;

    mapping(address => uint8) public roles;

    // в”Ђв”Ђ Events в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    event ActionQueued(uint8 indexed actionType, bytes32 payloadHash, uint256 executeAfter);
    event ActionExecuted(uint8 indexed actionType, bytes32 payloadHash);
    event ActionDelayUpdated(uint8 indexed actionType, uint256 delaySecs);
    event WithdrawalPolicyUpdated(bool enabled, uint256 perTxLimit, uint256 dailyLimit);
    event EpochGuardUpdated(bool freezeDuringEpoch, bool epochActive);
    event RoleGranted(address indexed addr, uint8 roleMask);
    event RoleRevoked(address indexed addr, uint8 roleMask);

    // в”Ђв”Ђ Errors в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    error NotOwner();
    error BadActionType();
    error ActionNotQueued();
    error ActionNotReady();
    error EpochConfigLocked();
    error WithdrawOverPerTxLimit();
    error WithdrawOverDailyLimit();
    error Unauthorized();

    constructor(address _owner) {
        _transferOwnership(_owner);
    }

    // в”Ђв”Ђ Role helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function hasRole(address addr, uint8 role) public view returns (bool) {
        if (addr == owner()) return true;
        return (roles[addr] & role) != 0;
    }

    function grantRole(address addr, uint8 roleMask) external onlyOwner {
        roles[addr] |= roleMask;
        emit RoleGranted(addr, roleMask);
    }

    function revokeRole(address addr, uint8 roleMask) external onlyOwner {
        roles[addr] &= ~roleMask;
        emit RoleRevoked(addr, roleMask);
    }

    function _requireRole(address addr, uint8 role) internal view {
        if (!hasRole(addr, role)) revert Unauthorized();
    }

    // в”Ђв”Ђ Timelock config в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function setActionDelay(uint8 actionType, uint256 delaySecs) external onlyOwner {
        if (actionType >= ACTION_COUNT) revert BadActionType();
        actionDelays[actionType] = delaySecs;
        emit ActionDelayUpdated(actionType, delaySecs);
    }

    // в”Ђв”Ђ Action queue/consume в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function _actionRequiredRole(uint8 actionType) internal pure returns (uint8) {
        if (actionType == ACTION_TREASURY_WITHDRAW)   return ROLE_TREASURY;
        if (actionType == ACTION_SET_CLAIM_DAYS)      return ROLE_CLAIM;
        if (actionType == ACTION_SET_CLAIM_LIST)      return ROLE_CLAIM;
        if (actionType == ACTION_START_CLAIM)         return ROLE_CLAIM;
        if (actionType == ACTION_CLOSE_CLAIM)         return ROLE_CLAIM;
        if (actionType == ACTION_RESET_ALL_ORACLE_DAYS) return ROLE_ORACLE;
        if (actionType == ACTION_STOP_AND_RESET)      return ROLE_EMERGENCY;
        if (actionType == ACTION_SET_BASE_URIS)       return ROLE_NFT;
        if (actionType == ACTION_SET_CHEST_PRICES)    return ROLE_NFT;
        if (actionType == ACTION_ADMIN_MINT_TO)       return ROLE_NFT;
        if (actionType == ACTION_CLEAR_LISTINGS)      return ROLE_NFT;
        return ROLE_FULL;
    }

    // Called directly by admin EOA вЂ” msg.sender is the admin
    function queueAction(uint8 actionType, bytes32 payloadHash) external {
        if (actionType >= ACTION_COUNT) revert BadActionType();
        _requireRole(msg.sender, _actionRequiredRole(actionType));

        uint256 delay = actionDelays[actionType];
        uint256 executeAfter = block.timestamp + delay;

        // Deduplicate: skip if exact same action+hash already queued
        uint256 len = queuedActions.length;
        for (uint256 i = 0; i < len; i++) {
            if (queuedActions[i].actionType == actionType &&
                queuedActions[i].payloadHash == payloadHash) {
                return;
            }
        }

        queuedActions.push(QueuedAction({
            actionType:   actionType,
            payloadHash:  payloadHash,
            createdAt:    block.timestamp,
            executeAfter: executeAfter
        }));
        emit ActionQueued(actionType, payloadHash, executeAfter);
    }

    function consumeAction(uint8 actionType, bytes32 payloadHash) external {
        if (actionType >= ACTION_COUNT) revert BadActionType();

        uint256 delay = actionDelays[actionType];
        if (delay == 0) return; // no timelock вЂ” immediate

        uint256 len = queuedActions.length;
        for (uint256 i = 0; i < len; i++) {
            if (queuedActions[i].actionType == actionType &&
                queuedActions[i].payloadHash == payloadHash) {
                if (block.timestamp < queuedActions[i].executeAfter) revert ActionNotReady();
                // Swap-remove
                queuedActions[i] = queuedActions[len - 1];
                queuedActions.pop();
                emit ActionExecuted(actionType, payloadHash);
                return;
            }
        }
        revert ActionNotQueued();
    }

    // в”Ђв”Ђ Withdrawal policy в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function setWithdrawalPolicy(
        bool    enabled,
        uint256 perTxLimit,
        uint256 dailyLimit
    ) external onlyOwner {
        _maybeResetDailyWindow();
        withdrawalPolicy.enabled    = enabled;
        withdrawalPolicy.perTxLimit = perTxLimit;
        withdrawalPolicy.dailyLimit = dailyLimit;
        emit WithdrawalPolicyUpdated(enabled, perTxLimit, dailyLimit);
    }

    function checkWithdrawal(uint256 amount) external {
        if (!withdrawalPolicy.enabled) return;
        _maybeResetDailyWindow();
        if (withdrawalPolicy.perTxLimit > 0 && amount > withdrawalPolicy.perTxLimit)
            revert WithdrawOverPerTxLimit();
        if (withdrawalPolicy.dailyLimit > 0 &&
            withdrawalPolicy.spentToday + amount > withdrawalPolicy.dailyLimit)
            revert WithdrawOverDailyLimit();
        withdrawalPolicy.spentToday += amount;
    }

    function _maybeResetDailyWindow() internal {
        uint256 today = block.timestamp / 1 days;
        if (withdrawalPolicy.dayIndex != today) {
            withdrawalPolicy.dayIndex  = today;
            withdrawalPolicy.spentToday = 0;
        }
    }

    // в”Ђв”Ђ Epoch guard в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function setEpochGuard(bool freezeDuringEpoch) external onlyOwner {
        epochGuard.freezeDuringEpoch = freezeDuringEpoch;
        emit EpochGuardUpdated(freezeDuringEpoch, epochGuard.epochActive);
    }

    function assertEpochSettingsMutable() external view {
        if (epochGuard.freezeDuringEpoch && epochGuard.epochActive)
            revert EpochConfigLocked();
    }

    function onEpochStarted() external {
        epochGuard.epochActive = true;
        emit EpochGuardUpdated(epochGuard.freezeDuringEpoch, true);
    }

    function onEpochStopped() external {
        epochGuard.epochActive = false;
        emit EpochGuardUpdated(epochGuard.freezeDuringEpoch, false);
    }

    // в”Ђв”Ђ Views в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function getPendingActions() external view returns (
        uint8[] memory actionTypes,
        uint256[] memory executeAfters,
        bytes32[] memory hashes
    ) {
        uint256 len = queuedActions.length;
        actionTypes   = new uint8[](len);
        executeAfters = new uint256[](len);
        hashes        = new bytes32[](len);
        for (uint256 i = 0; i < len; i++) {
            actionTypes[i]   = queuedActions[i].actionType;
            executeAfters[i] = queuedActions[i].executeAfter;
            hashes[i]        = queuedActions[i].payloadHash;
        }
    }

    function getActionDelay(uint8 actionType) external view returns (uint256) {
        if (actionType >= ACTION_COUNT) revert BadActionType();
        return actionDelays[actionType];
    }
}
