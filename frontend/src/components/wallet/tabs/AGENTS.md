<!-- Parent: ../../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# tabs

## Purpose
Tab page components for CoinDeck: Roster (card/chest management), Marketplace (trading), Tournament (daily lineups + results), Rankings (leaderboard + claims), Admin (privileged operations).

## Key Files
| File | Description |
|------|-------------|
| `RosterTab.tsx` | Card inventory, chest balances, open/buy/merge UI; shows card grid with tier/player labels, chest count by type |
| `MarketplaceTab.tsx` | Card listings, quick-buy modal, sell card; paginated listings table, price sorting, seller nickname display |
| `TournamentTab.tsx` | Daily lineup submission, results view; role-matched scoring, countdown timer, epoch/day picker, portfolio expansion |
| `RankingsTab.tsx` | Leaderboard pagination, per-player portfolio, claims vault state; league filter, nickname edit, claim rewards modal |
| `AdminTab.tsx` | Admin role management, governance policy, pending actions with delays; role bit flags (oracle/treasury/nft/claim/emergency) |
| `AdminInfoPanel.tsx` | Helper component; displays admin policy, pending actions, role definitions |

## For AI Agents

### Working In This Directory
- **Tab entry point**: Props include wallet state, hooks (useRosterLogic, etc.), submitTx function
- **Layout**: Header with title/filters, content grid or table, footer with pagination/controls
- **Busy states**: Disable buttons and show spinner during submitTx; key pattern "tn_submit", "fl_buy_0", etc.
- **Language**: useI18n() from LanguageProvider for Russian/English text
- **Styling**: Tailwind + TIER_COLORS/TIER_STYLES for card theming; dark mode via [data-theme="dark"] selector

### Common Patterns
- **Pagination**: Tracks pageStart/pageSize in component state or parent; fetches data lazily
- **Sorting**: Default by most relevant (price asc for marketplace, score desc for rankings)
- **Filtering**: Tabs may filter by tier, team, rarity; state managed by hook or component
- **Card grid**: Responsive layout; show playerId, tier, count; click to open modals
- **Table**: Marketplace listings, rankings rows; sortable columns (price, score, days played)
- **Modal launch**: Click card/listing → setState in hook → modal renders conditionally
- **Countdown**: useEffect with setInterval; updates every 1s; formatted HH:MM:SS

## Dependencies

### Internal
- `../hooks/` – useRosterLogic, useTournamentLogic, useMarketplaceLogic, useRankingsLogic, useAdminLogic
- `../constants.ts` – contract addresses, asset metadata, tier styles
- `../types.ts` – CardData, Listing, RankRow, LineupSlot
- `../overlays/` – modal components (ChestBuyModal, ChestOpenModal, etc.)
- `../../LanguageProvider.tsx` – useI18n()
- `@/components/ui` – spinners, icons, tables

### External
- `react@19.2.4` – useState, useEffect
- `lucide-react` – icons (ChevronUp, ChevronDown, Settings, etc.)
- `tailwindcss@4` – utilities

<!-- MANUAL: TournamentTab computes hero scores dynamically; ensure oracle cache (oracleDayCache) is populated before rendering. RankingsTab with large portfolios may render hundreds of cards; consider virtualization if performance degrades. AdminTab operations are permanent; require clear confirmation before executing. -->
