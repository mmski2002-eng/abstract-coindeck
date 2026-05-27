// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AdminControl.sol";

/**
 * Migrated from claim.move
 * Claim window СЃ РґРµРґР»Р°Р№РЅРѕРј, pull payment, РІРѕР·РІСЂР°С‚ РѕСЃС‚Р°С‚РєР°
 */
contract Claim is ReentrancyGuard {

    AdminControl public adminControl;

    struct ClaimEntry {
        uint256 amount;
        bool    claimed;
    }

    bool    public active;
    uint256 public startTimestamp;
    uint256 public deadlineTimestamp;
    uint256 public claimDays;
    address public prizeReturnAddr;

    mapping(address => ClaimEntry) public entries;
    address[] private _claimAddrs;

    event ClaimOpened(uint256 startTimestamp, uint256 totalRequired, address prizeReturnAddr);
    event PrizeClaimed(address indexed claimer, uint256 amount);
    event ClaimClosed(address returnAddr, uint256 remainingReturned);
    event ClaimDaysUpdated(address indexed admin, uint256 claimDays);
    event ClaimListUpdated(address indexed admin, uint256 entries, uint256 totalRequired);

    error NotClaimAdmin();
    error AlreadyActive();
    error NotActive();
    error AlreadyClaimed();
    error NothingToClaim();
    error ClaimExpired();
    error ClaimNotExpired();
    error InsufficientVault();
    error LengthsMismatch();
    error DuplicateAddress();
    error TransferFailed();

    modifier onlyClaimAdmin() {
        if (!adminControl.hasRole(msg.sender, adminControl.ROLE_CLAIM()) &&
            msg.sender != adminControl.owner())
            revert NotClaimAdmin();
        _;
    }

    constructor(address _adminControl) {
        adminControl = AdminControl(_adminControl);
        claimDays    = 6;
    }

    // в”Ђв”Ђ Admin config в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function setClaimDays(uint256 numDays) external onlyClaimAdmin {
        adminControl.assertEpochSettingsMutable();
        adminControl.consumeAction(
            adminControl.ACTION_SET_CLAIM_DAYS(),
            keccak256(abi.encode(numDays))
        );
        claimDays = numDays;
        emit ClaimDaysUpdated(msg.sender, numDays);
    }

    function setClaimList(
        address[] calldata addrs,
        uint256[] calldata amounts
    ) external onlyClaimAdmin {
        if (addrs.length != amounts.length) revert LengthsMismatch();
        if (active) revert AlreadyActive();

        adminControl.consumeAction(
            adminControl.ACTION_SET_CLAIM_LIST(),
            keccak256(abi.encode(addrs, amounts))
        );

        // Clear existing
        for (uint256 i = 0; i < _claimAddrs.length; i++) {
            delete entries[_claimAddrs[i]];
        }
        delete _claimAddrs;

        // Dedup check + populate
        uint256 total = 0;
        for (uint256 i = 0; i < addrs.length; i++) {
            if (entries[addrs[i]].amount != 0) revert DuplicateAddress();
            entries[addrs[i]] = ClaimEntry({ amount: amounts[i], claimed: false });
            _claimAddrs.push(addrs[i]);
            total += amounts[i];
        }

        emit ClaimListUpdated(msg.sender, addrs.length, total);
    }

    // в”Ђв”Ђ Start/close в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function startClaim(address returnAddr) external onlyClaimAdmin {
        if (active) revert AlreadyActive();
        adminControl.consumeAction(
            adminControl.ACTION_START_CLAIM(),
            keccak256(abi.encode(returnAddr))
        );

        uint256 totalRequired = 0;
        for (uint256 i = 0; i < _claimAddrs.length; i++) {
            totalRequired += entries[_claimAddrs[i]].amount;
        }
        if (address(this).balance < totalRequired) revert InsufficientVault();

        active             = true;
        startTimestamp     = block.timestamp;
        deadlineTimestamp  = block.timestamp + claimDays * 1 days;
        prizeReturnAddr    = returnAddr;

        emit ClaimOpened(startTimestamp, totalRequired, returnAddr);
    }

    function closeClaim() external onlyClaimAdmin nonReentrant {
        if (!active) revert NotActive();
        if (block.timestamp <= deadlineTimestamp) revert ClaimNotExpired();
        adminControl.consumeAction(adminControl.ACTION_CLOSE_CLAIM(), keccak256(""));

        active = false;
        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            (bool ok,) = payable(prizeReturnAddr).call{value: remaining}("");
            if (!ok) revert TransferFailed();
        }
        emit ClaimClosed(prizeReturnAddr, remaining);
    }

    // в”Ђв”Ђ User claim в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function claim() external nonReentrant {
        if (!active) revert NotActive();
        if (block.timestamp > deadlineTimestamp) revert ClaimExpired();

        ClaimEntry storage e = entries[msg.sender];
        if (e.amount == 0) revert NothingToClaim();
        if (e.claimed)     revert AlreadyClaimed();

        e.claimed = true;
        uint256 amount = e.amount;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PrizeClaimed(msg.sender, amount);
    }

    // в”Ђв”Ђ Fund vault в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    receive() external payable {}

    // в”Ђв”Ђ Views в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    function getClaimState() external view returns (
        bool    _active,
        uint256 _startTimestamp,
        uint256 _deadlineTimestamp,
        uint256 vaultBalance,
        uint256 _claimDays
    ) {
        return (active, startTimestamp, deadlineTimestamp, address(this).balance, claimDays);
    }

    function getClaimable(address addr) external view returns (uint256) {
        if (!active) return 0;
        ClaimEntry storage e = entries[addr];
        if (e.claimed) return 0;
        return e.amount;
    }
}
