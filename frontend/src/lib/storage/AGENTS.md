<!-- Parent: ../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# storage

## Purpose
Caching and state persistence layer. Abstracts postgres job_state table for worker job locking, leaderboard/marketplace/oracle caching, market data snapshots, rate limiting, and admin auth state.

## Key Files
| File | Description |
|------|-------------|
| `leaderboard.ts` | Leaderboard cache operations: fetch/save leaderboard rows, tier mults, oracle cache, day lineup cache; cache key normalization by (epoch, totalDays, currentDay, roleBonusPct) |
| `marketplace.ts` | Marketplace state queries: fetch listings, create listing, determine seller info |
| `marketData.ts` | Market data caching: fetch/save price data (volume, change %, high/low); CoinGecko integration or cached fallback |
| `marketSnapshot.ts` | Snapshot by epoch/day: price/vol/hype state at specific game moment |
| `lineupStats.ts` | Lineup stats caching: aggregate which cards were picked most often on a day |
| `oracleHistory.ts` | Oracle score history: read/write finalized day scores for completed epochs |
| `botState.ts` | Bot job state tracking: last run timestamp, job status |
| `leaderboardConfig.ts` | Configuration cache: tier multipliers, role bonus percentage, asset set version |
| `adminAuth.ts` | Admin nonce storage: nonce for signature-based auth |
| `rateLimit.ts` | Rate limiting state: track requests per user/IP; return 429 if exceeded |
| `feedback.ts` | User feedback storage: saves feedback submissions to job_state |

## For AI Agents

### Working In This Directory
- **Cache access**: All read/write via dbQuery; all cache keys are deterministic strings
- **Job locking**: tryAcquireLock(jobId) in worker.ts prevents concurrent executions; LOCK_STALE_MINUTES (30) auto-releases
- **Cache invalidation**: Manual invalidation via DELETE from job_state; no TTL-based expiry (caller responsible)
- **Consistency**: Each cache read checks if stale (updated_at < now); caller decides whether to refresh
- **State tracking**: job_state table tracks all cache entries with payload (JSONB), job_type, state, updated_at

### Common Patterns
- **Cache hit/miss**: Load via getCached() or similar; if null or stale, refresh and save
- **Normalization**: Cache keys are deterministic (e.g., "epoch-1-days-6-day-3-rb-15"); same key always maps to same epoch state
- **Batch operations**: saveLeaderboardRows() saves multiple rows in single transaction
- **Atomic updates**: Use transactions for multi-step operations (save leaderboard, save oracle cache, update config)
- **Error handling**: Silently continue if cache write fails; fetching fresh data always works

## Dependencies

### Internal
- `@/lib/db/client.ts` – dbQuery, withDbTransaction

### External
- `pg` types (via db/client.ts)

<!-- MANUAL: job_state table must exist with columns: job_key (text, primary key), job_type (text), state (text), payload (jsonb), updated_at (timestamp). Leaderboard cache is sensitive to (epoch, totalDays, currentDay, roleBonusPct) tuple; any change invalidates cache. -->
