<!-- Parent: ../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# wallet

## Purpose
Game logic, types, constants, hooks, overlays, and tabs for the CoinDeck wallet app. Handles roster (card/chest management), tournament (lineup submission), marketplace, leaderboard rankings, and admin panel.

## Key Files
| File | Description |
|------|-------------|
| `types.ts` | Type definitions: Tab, TransactionPayload, HeroStats, ClaimState, GovernancePolicy, TournamentStateData, LineupEntry, RankRow, CardData, Listing, QuickBuyMergeData |
| `constants.ts` | Contract addresses, asset names/tickers/colors/icons/teams/roles, tier multipliers, tier styles, all teams list, hero images, GitHub repos |
| `utils.ts` | Utilities: parseU8Vec (hex string → number array), getErrorMessage |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `hooks/` | Business logic hooks (see `hooks/AGENTS.md`) |
| `overlays/` | Modal components: buy/open chest, reveal cards, merge animation, lineup confirm, onboarding (see `overlays/AGENTS.md`) |
| `tabs/` | Tab pages: Roster, Marketplace, Tournament, Rankings, Admin (see `tabs/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **Types**: Exhaustive; add new types to types.ts, not inline in component files
- **Constants**: All asset data, tier styles, contract addresses stored in constants.ts; imported by tabs and overlays
- **Utilities**: Only simple pure functions in utils.ts (parsing, error extraction); business logic goes in hooks
- **Exports**: Use named exports; index patterns (barrel exports) reserved for hooks, overlays, tabs subdirs if needed

### Common Patterns
- **Card identification**: playerId (0–49 for 50 assets), tier (0–3), cardAddr (NFT address on-chain)
- **Chest types**: type 0=wooden, type 1=iron, type 2=silver; each has fixed price and tier drop
- **Tier multipliers**: [100, 140, 190, 250]; applied to base oracle score
- **Role bonus**: +15% score if card's role matches lineup slot (L1, L2, DeFi, Exchange, Meme/Infra)
- **Status enums**: busy keys like "fl_buy_0" (buying chest type 0), "tn_submit" (submitting tournament lineup)

## Dependencies

### Internal
- `hooks/` – state management
- `overlays/` – modal UI
- `tabs/` – page UI
- `@/config/projectAddresses.ts` – contract addresses
- `@/config/assetUniverse.ts` – asset metadata

### External
- `react@19.2.4` – hooks, state
- `@razorlabs/razorkit` – Aptos wallet provider (deprecated)

<!-- MANUAL: Asset data (ASSETS array in assetUniverse.ts) defines all 50 coins; TIER_MULTS and TIER_COLORS hardcoded here and synced with /api/leaderboard/config. Ensure constants match on-chain values. -->
