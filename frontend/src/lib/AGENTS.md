<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# lib

## Purpose
Core utility libraries for database, caching, and business logic: postgres connection pool, leaderboard state machine, marketplace queries, oracle scoring, admin auth, rate limiting.

## Key Files
| File | Description |
|------|-------------|
| `db/client.ts` | Postgres pool and query helpers; connection pooling, transaction helpers, statement timeout |
| `oracleWindow.ts` | Oracle publish window logic: determines if day is closed, formats date keys |
| `oracleScoring.ts` | Score computation: base oracle score, tier multiplier, role bonus aggregation |
| `claimList.ts` | Claim distribution logic: allocates prize pool to claimants by rank |
| `adminAuth.ts` | Admin key verification: nonce-based signature checking |
| `preflight.ts` | Pre-flight checks before executing sensitive operations |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `db/` | Database client and pool (see `db/AGENTS.md`) |
| `storage/` | Caching and state persistence layer (see `storage/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **Database access**: Always use dbQuery() or withDbTransaction() from db/client.ts; never instantiate pool directly
- **Oracle timing**: Use oracleWindow.ts functions to determine if day is finalized and scores can be published
- **Score computation**: Use oracleScoring.ts for consistent hero point calculation across app
- **Admin actions**: Verify nonce signatures via adminAuth.ts before executing role-based operations
- **Caching patterns**: Storage layer handles job_state table; lock acquisition in worker.ts before running jobs

### Common Patterns
- **Connection pooling**: Global pool with max 10 connections, 30s statement timeout
- **Job locking**: Prevents duplicate work; LOCK_STALE_MINUTES (30) auto-releases hung locks
- **Cache keys**: Normalized by epoch, day, totalDays, currentDay, roleBonusPct (see leaderboard storage)
- **Role bits**: ROLE_ORACLE (1), ROLE_TREASURY (2), ROLE_NFT (4), ROLE_CLAIM (8), ROLE_EMERGENCY (16), ROLE_FULL (31)
- **Nonce verification**: Admin requests signed with ethereum-compatible signature; verified before action execution

## Dependencies

### Internal
- `db/` – postgres operations
- `storage/` – cache and state management

### External
- `pg@8.16.3` – postgres client
- `next` – API context (only in lib, not used directly in utility funcs)

<!-- MANUAL: Database credentials (DATABASE_URL) required for API routes. Ensure migrations are up-to-date (job_state, leaderboard, rankings tables). Admin auth uses standard EIP-191 signature format; compatible with wagmi/ethers signing. -->
