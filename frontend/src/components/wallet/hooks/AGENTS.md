<!-- Parent: ../../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# hooks

## Purpose
Business logic hooks for wallet app. Separate state management from UI; each hook handles a game feature: roster, tournament, marketplace, rankings, or admin panel.

## Key Files
| File | Description |
|------|-------------|
| `useRosterLogic.ts` | Manage cards and chests: buy, open, merge; track inventory state; chest NFT addresses by type (wooden/iron/silver) |
| `useTournamentLogic.ts` | Tournament daily lineups: fetch lineups by epoch, submit/cancel, fetch oracle scores, compute hero scores (base + tier mult + role bonus), countdown timer, market/lineup stats caching |
| `useMarketplaceLogic.ts` | Marketplace: fetch listings, create listing, quick-buy (single/bulk), bulk merge workflow, sell card state |
| `useRankingsLogic.ts` | Leaderboard: fetch paginated rankings by league, nickname management, player portfolio expansion, claims state (vault balance, claim window) |
| `useAdminLogic.ts` | Admin panel: role-based actions (oracle/treasury/nft/claim/emergency), governance policy state, pending admin actions with delays, audit logging |

## For AI Agents

### Working In This Directory
- **Hook interface**: Each hook returns an object with state and setters; state is passed from parent (WalletApp)
- **Dependencies**: Each hook receives deps object with restUrl, moduleAddress, submitTx, setBusy, walletAccount, lang
- **Async operations**: Use setBusy() to prevent double-submit; wrap in try/catch; call setBusy(null) in finally
- **Polling**: useEffect with setInterval for countdown timers; manual polling (refreshInventory, refreshTournament) with setTimeout between iterations
- **Caching**: useRef for promise dedup (refreshInventory), Map-based caches (oracleDayCache, marketSnapshotCache, lineupStatsCache)
- **localStorage**: Used for lineup submissions, locked card addresses, nicknames; cleared on epoch/day changes

### Common Patterns
- **Refresh functions**: Returns promise for chaining; handles errors and sets state atomically
- **Transaction flow**: submitTx → setBusy → poll for on-chain confirmation → refresh state → setBusy(null)
- **Error messages**: i18n strings in Russian/English; stored in state as `*Error` fields
- **Card matching**: findNewCard/findAllNewCards compare before/after inventory snapshots to detect new cards from chest opens
- **Oracle scoring**: heroScore(playerId, tier, slotIdx, dayScores) = base * tierMult * roleBonus / 10000
- **Epoch/day tracking**: tnState tracks active tournament, currentDay, currentEpoch; viewEpoch allows historical views

## Dependencies

### Internal
- `../constants.ts` – contract addresses, tier multipliers
- `../types.ts` – TransactionPayload, TxOptions, etc.
- `../utils.ts` – parseU8Vec, getErrorMessage

### External
- `react` – useState, useRef, useEffect
- REST API: restUrl for /view (contract queries), /accounts (resource fetches), /api/* (backend endpoints)

<!-- MANUAL: useTournamentLogic and useRosterLogic use lengthy refresh/polling loops; monitor performance on low-end devices. useAdminLogic requires special permission checks before executing role-based actions. -->
