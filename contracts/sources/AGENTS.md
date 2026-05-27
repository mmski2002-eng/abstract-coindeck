<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# contracts/sources

## Purpose
6 Move modules implementing a blockchain fantasy crypto game. Players draft 5-card lineups weekly, scores are posted by oracle, winners claim prizes.

## Key Files
| File | Description |
|------|-------------|
| `tournament.move` | Epoch/day lifecycle, lineup submission (5 slots per day), card locking, prize vault, participant registry |
| `fantasy_league.move` | Card NFTs (50 player-coins, 4 tiers), chest NFTs (3 types), merge mechanic, admin controls, nicknames |
| `admin_control.move` | Timelock state machine, withdrawal policy, role-based access (oracle, treasury, nft, claim, emergency), epoch guard |
| `oracle.move` | Daily player scores (per-player base points, max 10k), posted flag, score lookup |
| `claim.move` | Prize claim window (configurable days), claim list management, claim vault, deadline snapshot |
| `marketplace.move` | P2P card listing/buying (5% fee), paginated listings, emergency clear with pagination, listing ID reset |

## Module Dependencies & Friend Relationships

```
admin_control (root: owns state machines)
  ↓ friend imports
tournament, fantasy_league, claim, oracle, marketplace

fantasy_league (core NFT layer)
  ↓ friend imports
tournament, marketplace, claim

tournament
  ↓ imports
fantasy_league, admin_control

oracle
  ↓ imports
fantasy_league, admin_control

claim
  ↓ imports
fantasy_league, admin_control

marketplace
  ↓ imports
fantasy_league, tournament, admin_control
```

## Core Data Structures

### tournament.move
- `SlotEntry` (player_id: u8, tier: u8) — one card slot
- `DayLineup` (day, epoch, slots, league) — one day's 5-card submission
- `PlayerLineup` (lineups: vector<DayLineup>) — stored per player, max 6 entries (pruned by epoch)
- `Participants` (addrs, seen: SmartTable) — global registry of all players who ever submitted
- `EpochState` (running, start_timestamp, base_epoch, first_visible_epoch) — epoch clock
- `TournamentConfig` (change_lineup_fee) — resubmit fee (0.5 MOVE default)
- `LockedCards` (locks, player_locks) — card lock tracking per card and per player

### fantasy_league.move
- `PlayerCard` (player_id, tier, burn_ref, transfer_ref) — stored on card object
- `ChestToken` (chest_type, burn_ref, transfer_ref) — stored on chest object
- `UserCards` (card_addrs: vector<address>) — player's card inventory
- `UserChests` (chest_addrs: vector<address>) — player's unopened chests
- `PlayerProfile` (nickname) — stored once per player
- `CardLocks` (locks: SmartTable<card_addr, unlock_ts>) — per-card unlock timestamp
- `ChestPrices` (wooden, iron, silver) — 10M, 30M, 90M octas (0.1, 0.3, 0.9 MOVE)

### oracle.move
- `PlayerDayScore` (player_id, base_points) — score entry (max 10k points)
- `DayData` (day, scores, posted: bool) — all scores for one day + posted flag

### claim.move
- `ClaimEntry` (amount, claimed: bool) — per-claimer allocation
- `ClaimState` (active, start_timestamp, entries, addrs) — manages one claim window
- `ClaimMeta` (deadline_timestamp) — snapshot of deadline at start time (SC-06 fix)
- `ClaimConfig` (claim_days) — configurable window length

### marketplace.move
- `Listing` (id, seller, card_addr, player_id, tier, price, vec_idx) — one card listing
- `Marketplace` (listings, by_card, listing_ids, next_id, pending_clear) — manages all listings

## Game Rules

### Leagues
- **Gold** (tier 2): 5 Epic cards OR any Legendary
- **Silver** (tier 1): 1-4 Epic cards OR 5 Rare cards (no Epic/Legendary)
- **Bronze** (tier 0): everything else

### Card Tiers
- 0 = Common (Wooden Chest)
- 1 = Rare (Iron Chest)
- 2 = Epic (Silver Chest)
- 3 = Legendary (admin-only mint)

### Epoch/Day
- 6 active days + 1 rest day per epoch = 7-day week
- Day 1-6 playable, day 7 rest day (is_rest = true)
- Epochs auto-increment every 7 days from start_timestamp

## For AI Agents

### Working In This Directory
- **READ ONLY** — reference for Solidity migration
- Trace game flow: initialize → start_epoch → submit_lineup daily → post_day_scores → claim_prizes → close_claim
- Note SmartTable usage for O(1) lookups (seen, locks, by_card, entries)
- Card locking: locked while day is active (unlock_ts = start_ts + day * 86400)
- Marketplace: escrow cards in @moveinvestor account during listing, transfer on buy/cancel
- Timelock: queue_action + consume_action pattern with configurable delays per action type

### Common Patterns

#### Epoch/Day Computation
```move
fun epoch_day_from(start_ts: u64, base_epoch: u64, running: bool): (u64, u64, bool) {
  let elapsed_days = (now_seconds() - start_ts) / 86400;
  let week_pos = elapsed_days % 7;
  let weeks_passed = elapsed_days / 7;
  let epoch = base_epoch + weeks_passed;
  let is_rest = week_pos >= 6;
  let day_in_epoch = if (is_rest) 0 else week_pos + 1;
  (epoch, day_in_epoch, is_rest)
}
```

#### SmartTable O(1) Membership Test
```move
let seen = smart_table::new<address, bool>();
if (smart_table::contains(&seen, addr)) abort E_DUPLICATE;
smart_table::add(&mut seen, addr, true);
```

#### Friend Function for Escrow Transfer
```move
public(friend) fun extract_linear_transfer_ref(card_addr: address): object::LinearTransferRef
  acquires PlayerCard { ... }
```

#### Timelock Action Queue
```move
admin_control::queue_action(admin, ACTION_TYPE, hash_payload(&args));
// ... wait delay_secs ...
admin_control::consume_X_action(ACTION_TYPE, hash_payload(&args));
```

### Security Checks
- `assert_admin()` validates caller is owner or has admin role (via admin_control)
- `is_card_locked()` prevents card transfer during active tournament day
- `epoch_settings_mutable()` guards config changes during active epoch (if freeze_during_epoch=true)
- Withdrawal policy: per-tx and per-day limits (SC-01, SC-02)
- Claim deadline snapshot at start_claim (SC-06) prevents deadline from changing mid-window
