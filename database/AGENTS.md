<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# database

## Purpose
PostgreSQL schema for off-chain game data: leaderboard cache, oracle history, lineup snapshots, marketplace index, bot state, feedback, rate limiting.

Decoupled from chain — used by backend workers to compute leaderboards, cache oracle scores, track player stats, and serve queries without re-parsing blockchain events.

## Key Files
| File | Description |
|------|-------------|
| `schema.sql` | Core tables: oracle_history, leaderboard, listings, feedback, admin nonces, rate limits, job state, bot config |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `migrations/` | SQL upgrade scripts (e.g., rate limit counter refactor) |

## Core Tables

### Leaderboard & Scoring
- `oracle_history` — (epoch, day) → scores (player_id→base_points), source (chain/backup), ledger_version
- `leaderboard_day_lineups` — (epoch, day) → entries (players' 5-card lineup submissions), complete flag
- `oracle_scores_cache` — (epoch, day) → cached score payload, updated_at timestamp
- `leaderboard_cache` — (cache_id) → epoch, total_days, current_day, role_bonus_pct, payload (full leaderboard)
- `leaderboard_rows` — (cache_id, rank) → addr, score, league, days, nickname, prev_day_tiers, prev_day_pids

### Marketplace
- `marketplace_listings` — (listing_id) → seller, card_addr, player_id, tier, price, updated_at
- `market_snapshot` — (epoch, day) → coin_data (CoinGecko snapshot for scoring)

### Rate Limiting & Admin
- `rate_limit_counters` — (bucket, window_start) → count (fixed-window counter, replaces old JSONB array model)
- `rate_limits` — (bucket) → hits (JSONB array, legacy, may be deprecated)
- `admin_nonces` — (nonce) → action, domain, issued_at, expires_at, used_at (multi-sig nonces)

### Configuration & State
- `app_config` — (namespace, key) → value (app-wide settings, e.g., active epoch, role bonus %)
- `bot_config` — (key) → value (bot runtime parameters, e.g., concurrency, delays)
- `bot_state` — (key) → value (bot state snapshots between runs)
- `job_state` — (job_key) → job_type, state, payload, updated_at (worker job tracking)

### Utility
- `sync_meta` — (key) → value (sync checkpoints, ledger version tracking)
- `feedback` — (id) → created_at, ip_hash, rating, name, wallet, text (user feedback form)
- `market_data_cache` — (cache_key) → payload, updated_at (CoinGecko/other API responses)
- `audit_log` — (id) → scope, payload, created_at (admin action audit trail)
- `lineup_pick_counts` — (epoch, day, pid) → picks (histogram of which players were picked most)

## For AI Agents

### Working In This Directory

#### After Migration to Solidity/EVM
- Addresses become EVM format (0x...): update address columns to VARCHAR(42) or CHAR(42)
- Block numbers + timestamps replace Move's ledger versions
- Contract events still populate oracle_history, leaderboard tables the same way
- Worker scripts (e.g., leaderboard computation) remain mostly unchanged

#### Key Patterns
- Leaderboard cache is computed once per epoch/day/config tuple, stored in `leaderboard_cache`
  - `leaderboard_rows` is denormalized for fast paginated queries
  - Indices: (cache_id, rank), (cache_id, addr), (cache_id, league, rank)
- Rate limiting uses fixed-window counters: (bucket, window_start) → count
  - window_start = now / window_duration (e.g., 3600 for hourly buckets)
  - Read-before-write pattern: fetch current window, increment, write back
- Oracle scores must be cached immediately after posting so leaderboard worker doesn't re-fetch chain
- Marketplace listings indexed by (player_id, tier) for filter queries, (seller) for user's listings

### Common Queries
```sql
-- Get leaderboard for epoch 5, total_days=6, current_day=3, role_bonus=0
SELECT * FROM leaderboard_cache 
WHERE epoch=5 AND total_days=6 AND current_day=3 AND role_bonus_pct=0;

-- Get top 10 players in Gold league (league=2)
SELECT rank, addr, score, nickname FROM leaderboard_rows 
WHERE cache_id='...' AND league=2 ORDER BY rank LIMIT 10;

-- Check if user claimed on (epoch, day)
SELECT claimed FROM leaderboard_rows 
WHERE cache_id='...' AND addr='0x...';

-- Listings by tier
SELECT * FROM marketplace_listings 
WHERE player_id=0 AND tier=2 ORDER BY price ASC;

-- Rate limit check (bucket='api:mint', window_duration=3600)
SELECT count FROM rate_limit_counters 
WHERE bucket='api:mint' AND window_start = FLOOR(EXTRACT(EPOCH FROM now()) / 3600);
```

### Maintenance Notes
- `leaderboard_cache` entries can be safely deleted after next recomputation (stateless cache)
- `rate_limit_counters` rows can be pruned after window passes
- `oracle_history` is immutable (append-only) — keep for archive
- `job_state` should expire old completed jobs (e.g., jobs > 30 days old)
