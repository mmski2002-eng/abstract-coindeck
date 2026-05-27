# MoveInvestor

A crypto fantasy league built on the Movement Network. Players assemble portfolios of real crypto assets as on-chain NFT cards and compete in weekly tournaments for MOVE token prizes.

## How It Works

Each epoch (7 days) players pick 5 cards from their roster as a daily lineup. Cards score points based on the underlying asset's real-world price performance, fetched from CoinGecko and committed to the oracle on-chain. At epoch close, scores are tallied, prize pool is distributed, and winners claim directly from the on-chain vault.

Three leagues (Bronze, Silver, Gold) are determined by card rarity — encouraging players to chase higher-tier cards through purchases and on-chain merges.

## Business Value & Turnkey Monetization

This repository is designed as a production-ready, white-label solution for founders and communities looking to launch a robust Web3 ecosystem. 

**Revenue Streams:**
- **Chest Sales:** 100% of the revenue from chest minting goes directly to the prize pool (configurable by the admin).
- **Marketplace Royalties:** The integrated peer-to-peer marketplace automatically enforces a 5% protocol fee on all secondary trades, generating passive revenue for the platform owner.

**Customization:**
The Next.js 16 frontend is fully decoupled and utilizes Tailwind CSS 4, making it incredibly simple to rebrand. Global color schemes, typography, and card assets can be swapped out in minutes to match your specific community or brand identity.

## Architecture

```
contracts/          Move smart contracts (Movement Network)
frontend/           Next.js 16 web application
  src/app/          Pages + API routes (leaderboard, market data, NFT metadata)
  src/components/   UI — wallet app split into 5 domain hooks + tab components
scripts/            CLI utilities (load test bots, oracle posting, chain queries)
```

### Smart Contract Modules

| Module | Responsibility |
|---|---|
| `fantasy_league` | NFT cards & chests, inventory, merge, card locking |
| `tournament` | Epoch lifecycle, lineup submission, prize vault |
| `oracle` | On-chain daily price scores (admin-controlled) |
| `claim` | Time-windowed prize claim flow |
| `marketplace` | Peer-to-peer card trading with 5% protocol fee |

Card locking ties the contract modules together: when a player submits a lineup, `tournament` locks the submitted cards via a `friend`-scoped call into `fantasy_league`, preventing transfer or marketplace listing until the day ends.

### Off-Chain Components

- **Leaderboard worker** (`frontend/src/app/api/leaderboard/worker.ts`) — aggregates on-chain lineup data and oracle scores into ranked tables; caches results to disk, refreshes stale entries on next request.
- **Market data worker** (`frontend/src/app/api/market-data/worker.ts`) — pulls CoinGecko price feeds on-demand; supports both historical day ranges and live data, with retry/backoff and atomic file writes.
- **NFT metadata endpoints** (`/api/nft/card`, `/api/nft/chest`) — serve dynamic on-chain metadata and rendered SVG card images for wallets and explorers.

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Move 2.1, Movement Network (Aptos-compatible) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Wallet integration | RazorKit (Movement wallet adapter) |
| NFT standard | Aptos Token Objects v2 (soulbound transfer model) |
| Price data | CoinGecko API (50 assets) |
| Chain indexing | Movement Indexer GraphQL |

## Local Development

**Prerequisites:** Node.js 20+, Movement CLI (`~/.movement/bin/movement`).

```bash
# Start the frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

**Environment variables** (`frontend/.env.local`):

```
CONTRACT_ADDRESS=0x...   # optional runtime override for the shared address file
ADMIN_ADDRESS=0x...      # optional runtime override for admin auth
CGK_DELAY_MS=2200        # CoinGecko rate-limit delay between requests
```

### Shared Address File

All runtime contract addresses and network endpoints are stored in:

`frontend/src/config/project-addresses.json`

This file is now the single source of truth for:

- module contract address
- admin wallet address
- prize vault address
- claim vault address
- REST / faucet / explorer URLs
- debug wallets used by local scripts

The frontend, API routes, and local `scripts/` now read their defaults from this file. When you redeploy, update `frontend/src/config/project-addresses.json` first, then only use `.env.local` if you intentionally need a runtime override on a specific machine or host.

## Compiling & Deploying Contracts

```bash
cd contracts
movement aptos move compile
movement aptos move publish --profile moveinvestor --assume-yes
```

Module initialization order matters — `fantasy_league` creates the shared `AdminList` resource that all other modules read:

```bash
ADDR="0x<deployer>"
for mod in fantasy_league oracle tournament claim marketplace; do
  movement aptos move run --profile moveinvestor \
    --function-id "${ADDR}::${mod}::initialize" --assume-yes
done
```

See `DEPLOY.md` for full deployment and vault address derivation.

## Testnet Deployment

| | |
|---|---|
| Network | Movement Testnet |
| Contract | `0x5a4706b72470f8d6c2dfc3a0bbbf258736ba19bf06494712e69041c9ab4bcc7e` |
| RPC | `https://testnet.movementnetwork.xyz/v1` |
| Explorer | `https://explorer.testnet.movementnetwork.xyz` |

## Load Testing

The `scripts/loadtest_bot.js` utility generates bot wallets, funds them from the testnet faucet, and exercises the full user flow (chest purchase → open → lineup submission → marketplace listing) across 300 concurrent wallets in three rarity cohorts:

```bash
# Dry run — shows plan without executing
node scripts/loadtest_bot.js

# Execute
node scripts/loadtest_bot.js --execute --concurrency 8
```
