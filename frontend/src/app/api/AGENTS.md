<!-- Parent: ../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# api

## Purpose
Server-side API route handlers (Next.js Route Handlers). Endpoints for leaderboard updates, marketplace queries, oracle history, admin auth/nonce, NFT metadata, market data, and bot tick logic.

## Key Files
| File | Description |
|------|-------------|
| `leaderboard/route.ts` | GET: fetch leaderboard rows (paginated, sorted by score) |
| `leaderboard/config/route.ts` | GET: tier multipliers, role bonus percentage, asset set version |
| `leaderboard/tick/route.ts` | POST: hourly trigger to refresh leaderboard cache (not exposed publicly) |
| `leaderboard/worker.ts` | Core logic: fetches tournament state, oracle scores, computes roster points, updates DB |
| `marketplace/route.ts` | GET/POST: list listings, create new listing |
| `marketplace/worker.ts` | Core logic: queries on-chain user cards and marketplace state |
| `market-data/route.ts` | GET: price data for assets (volume, change %, high/low) |
| `market-data/worker.ts` | Core logic: fetches from CoinGecko or cached market snapshot |
| `market-snapshot/route.ts` | GET: snapshot of market data for a specific epoch/day |
| `oracle-history/route.ts` | GET: day scores for completed epochs (cache backed) |
| `oracle-history/sync/route.ts` | POST: sync oracle history from on-chain state |
| `lineup-stats/route.ts` | GET: aggregate lineup stats (usage counts) for epoch/day |
| `admin/auth.ts` | Admin auth check: verifies nonce signature matches known admin keys |
| `admin/nonce/route.ts` | GET: fetch nonce for signing admin requests |
| `admin/audit/route.ts` | GET: audit log of admin actions |
| `admin/claim-list/preview/route.ts` | GET: preview claim list before publishing |
| `bot/route.ts` | POST: bot endpoint (stub; placeholder) |
| `bot/tick/route.ts` | POST: hourly bot tick (market data refresh, leaderboard sync) |
| `bot/runner.ts` | Core logic: triggers worker jobs (leaderboard, market data) |
| `nft/card/route.tsx` | GET: NFT metadata for a card (ERC721 standard) |
| `nft/card/[...slug]/route.ts` | Dynamic: card metadata by playerId/tier/index |
| `nft/card-img/[...slug]/route.tsx` | Dynamic: card image PNG/WebP by playerId/tier |
| `nft/chest/route.tsx` | GET: NFT metadata for a chest (ERC721 standard) |
| `nft/chest/[...slug]/route.ts` | Dynamic: chest metadata by type/index |
| `nft/chest-img/[...slug]/route.tsx` | Dynamic: chest image PNG/WebP by type |
| `nft/shared.tsx` | Shared NFT rendering: card art, chest sprites, text overlays |
| `feedback/route.ts` | POST: user feedback endpoint |
| `_lib/errors.ts` | Shared error response helpers |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `leaderboard/` | Leaderboard state machine (refresh tick, config) |
| `marketplace/` | Marketplace listing queries |
| `market-data/` | Market data fetcher (CoinGecko integration) |
| `oracle-history/` | Oracle day scores caching and sync |
| `admin/` | Admin auth, nonce, audit log |
| `bot/` | Scheduled worker tick logic |
| `nft/` | ERC721 metadata endpoints (cards, chests) |
| `_lib/` | Shared helpers for API routes |

## For AI Agents

### Working In This Directory
- **Route Handlers**: Use `export async function GET(req)` or `export async function POST(req)`
- **Database access**: `import { dbQuery } from "@/lib/db/client"`; only available server-side
- **Environment variables**: Contract addresses, REST_URL, DATABASE_URL (all available in route handlers)
- **Return types**: `NextResponse` for JSON/binary, `NextRequest` for request parsing
- **Errors**: Use _lib/errors.ts helpers for consistent error format
- **Caching**: Leaderboard, market data, oracle history all backed by postgres job_state and cached results
- **Admin auth**: Verify signature in headers before executing privileged endpoints

### Common Patterns
- **Worker pattern**: heavy logic (fetchLineups, computeScores) in separate _worker.ts files
- **Job locking**: tryAcquireLock() prevents concurrent runs; LOCK_STALE_MINUTES (30) auto-releases stale locks
- **Pagination**: leaderboard GET accepts page/pageSize query params; returns totalRows for client pagination
- **Snapshot caching**: market-snapshot, lineup-stats store results by epoch/day cache key
- **NFT metadata**: card/chest routes return ERC721-compliant JSON + image data
- **Rate limiting**: feedback endpoint may have rate limit checks via lib/storage/rateLimit.ts

## Dependencies

### Internal
- `@/lib/db/client.ts` – postgres pool and query helpers
- `@/lib/storage/leaderboard.ts` – leaderboard cache operations
- `@/lib/storage/marketplace.ts` – marketplace state queries
- `@/lib/storage/marketData.ts` – market data caching
- `@/lib/storage/marketSnapshot.ts` – snapshot by epoch/day
- `@/lib/storage/oracleHistory.ts` – oracle history read/write
- `@/lib/storage/lineupStats.ts` – lineup stats cache
- `@/lib/storage/adminAuth.ts` – admin key verification
- `@/lib/oracleWindow.ts` – oracle scoring window logic
- `@/lib/oracleScoring.ts` – score computation (base + tier mult + role bonus)
- `@/config/projectAddresses.ts` – contract addresses
- `@/config/assetUniverse.ts` – asset metadata (names, tickers, roles)

### External
- `next` – NextResponse, NextRequest
- `pg` – postgres client (accessed via pool in lib/db/client.ts)

<!-- MANUAL: Admin endpoints require nonce-based signature verification; ensure admin keys are rotated. NFT metadata uses dynamically generated images; ensure image generation stays within reasonable time/memory bounds. -->
