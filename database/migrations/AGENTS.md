<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# database/migrations

## Purpose
SQL upgrade scripts for schema evolution. Deployed in order by migration runner (e.g., flyway, alembic, custom runner).

Currently: 1 migration.

## Key Files
| File | Description |
|------|-------------|
| `001_rate_limit_counters.sql` | Adds `rate_limit_counters` table (fixed-window counter model) |

## Migration History

### 001_rate_limit_counters.sql (deployed ~2025)
**Purpose**: Replace JSONB array-based rate limiting with fixed-window counters for better performance and semantics.

**Changes**:
- Creates `rate_limit_counters(bucket, window_start, count)` table
- Primary key: (bucket, window_start)
- Old `rate_limits` table kept for rollback compatibility (contains JSONB hit arrays)
- New table enables O(1) counter increment instead of O(n) array append

**Migration Strategy**:
1. Deploy schema (backward compatible)
2. Code changes: update consumeRateLimit to use new table
3. Optional: backfill old data if needed
4. Drop old table in future migration if confident

## For AI Agents

### Working In This Directory
- Migrations are **idempotent** (`if not exists`, `add column if not exists`)
- Run all migrations on fresh DB in order: 001, 002, etc.
- Rollback requires manual SQL (no "down" migrations defined yet)
- After migration to Solidity: address formats change from Move addresses (16 bytes) to EVM addresses (20 bytes)
  - Schema is abstraction-agnostic (addresses stored as TEXT/VARCHAR)
  - No migration needed — just app code handles format conversion

### Running Migrations
```bash
# Option 1: Manual psql
psql -h localhost -U dbuser -d moveinvestor -f migrations/001_rate_limit_counters.sql

# Option 2: Flyway (if configured)
flyway -placeholders.tablespace=pg_default migrate

# Option 3: App startup hook (if migrations bundled in backend)
npm run db:migrate  # or similar
```

### Future Migrations
When adding new tables or columns:
1. Create `NNN_description.sql` in numeric order
2. Use `if not exists` / `if not present` clauses
3. Keep old tables for 1-2 releases before dropping
4. Document rollback procedure in comments
