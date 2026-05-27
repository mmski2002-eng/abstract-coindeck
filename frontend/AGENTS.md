<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# frontend

## Purpose
Next.js 14+ frontend for CoinDeck, a blockchain fantasy crypto game on Abstract Network (Solidity/EVM/zkSync Era). Manages wallet connectivity, roster management (cards/chests), tournaments, leaderboards, and marketplace. Currently migrating from Movement (Aptos) wallet adapter to wagmi + Abstract Global Wallet (AGW).

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Node 19+ dependencies; @razorlabs/razorkit (Aptos—deprecated), next 16.2.4, pg 8.16.3 for DB queries |
| `src/app/layout.tsx` | Root layout: font setup (Lora display, Inter body), theme initialization, MetaMask noise suppression |
| `src/app/page.tsx` | Home page entry point: renders MarketingHome component |
| `src/app/globals.css` | Tailwind 4 + CSS custom properties for theming |
| `tsconfig.json` | TS strict mode, path aliases (@/components, @/config, @/lib) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages and API routes (see `src/app/AGENTS.md`) |
| `src/components/` | React components (see `src/components/AGENTS.md`) |
| `src/config/` | Runtime configuration: contract addresses, asset universe (see `src/config/AGENTS.md`) |
| `src/lib/` | Utilities: DB client, storage layer, oracle logic (see `src/lib/AGENTS.md`) |
| `public/` | Static assets: coin icons, chest sprites, coins.json metadata |

## For AI Agents

### Working In This Directory
- **TypeScript strict mode** enabled; use type guards and explicit typing
- **Path aliases**: @/components, @/config, @/lib, etc. resolve relative to src/
- **Tailwind 4**: utility-first CSS; custom properties via CSS vars (--font-display, --font-body, cd_theme)
- **Database URL** required in .env.local for /api routes (postgres, see lib/db/client.ts)
- **Environment variables**: CONTRACT_ADDRESS, MODULE_ADDR, ADMIN_ADDRESS, VAULT_ADDRESS, CLAIM_VAULT_ADDRESS, REST_URL, ACTIVE_NETWORK, LEADERBOARD_REFRESH_INTERVAL_MS
- **Wallet migration**: Code currently uses @razorlabs/razorkit (Aptos); transitioning to wagmi + @abstract-foundation/agw-react for Abstract Network

### Common Patterns
- **Hook-based business logic**: useRosterLogic, useTournamentLogic, useRankingsLogic, useMarketplaceLogic, useAdminLogic separate state from UI
- **Card model**: playerId (0–49), tier (0–3 common/rare/epic/legendary), cardAddr (NFT address on-chain)
- **Chest types**: wooden (tier 0), iron (tier 1), silver (tier 2); purchased, opened, and merged
- **Tournament**: daily lineups (5 cards per day), role-based scoring bonus, oracle day scores published post-deadline
- **Marketplace**: peer-to-peer card listings; quick-buy/quick-merge modal for bulk operations
- **API routes**: Next.js server-side handlers; leaderboard tick every 60 min, market data hourly, oracle history async

## Dependencies

### Internal
- `src/components/WalletApp.tsx` – main app wrapper; imports all tabs and overlays
- `src/components/wallet/` – game logic components and hooks
- `src/config/` – contract addresses, asset metadata
- `src/lib/db/` – postgres queries
- `src/lib/storage/` – leaderboard, marketplace, oracle caching

### External
- `next@16.2.4` – App Router SSR/static
- `react@19.2.4`, `react-dom@19.2.4` – UI
- `@razorlabs/razorkit@1.1.2` – Aptos wallet (deprecated, slated for removal)
- `pg@8.16.3` – postgres client
- `@tailwindcss/postcss@4` – CSS framework
- `lucide-react@1.8.0` – icons
- `cryptocurrency-icons@0.18.1` – coin logos

<!-- MANUAL: Update wallet integration section after moving to wagmi + AGW. Note: razorkit is deprecated; plan removal after Abstract Network cutover. -->
