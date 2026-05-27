<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# components

## Purpose
React components for CoinDeck frontend: main app wrapper, wallet integration, game UI overlays, tabs, and shared utilities.

## Key Files
| File | Description |
|------|-------------|
| `WalletApp.tsx` | Main app component; manages tab state, all game modals, wallet logic (currently Aptos, transitioning to Abstract) |
| `RazorKitStyles.tsx` | Injects @razorlabs/razorkit CSS (deprecated with Aptos wallet) |
| `LanguageProvider.tsx` | Context provider for i18n (Russian/English) |
| `MarketingHome.tsx` | Landing page component (not used in main app, only on home route) |
| `SuppressExtensionErrors.tsx` | Suppresses noisy extension errors in console |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `wallet/` | Game logic: hooks, types, constants, overlays, tabs (see `wallet/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **Client components**: Use `"use client"` directive at top of files
- **Hooks**: Import from wallet/hooks/ (useRosterLogic, useTournamentLogic, etc.)
- **Types**: Import from wallet/types.ts for Card, Listing, RankRow, LineupSlot, etc.
- **Constants**: Import from wallet/constants.ts for contract addresses, hero names, tier styles
- **Language**: Use useI18n() hook from LanguageProvider for i18n strings
- **Tailwind**: Use utility classes; custom colors defined in constants (CARD_TIER_STYLES, TIER_HEX, TIER_COLORS)

### Common Patterns
- **Tab navigation**: WalletApp manages Tab state; renders RosterTab, MarketplaceTab, TournamentTab, RankingsTab, AdminTab
- **Modal overlays**: ChestBuyModal, ChestOpenModal, ChestOpeningOverlay, ChestReveal (single/multi), MergeAnimation, LineupConfirmModal, etc.
- **Wallet context**: WalletApp receives submitTx function; passed to all child hooks and modals
- **Busy states**: setBusy("key") prevents multiple concurrent actions on same resource

## Dependencies

### Internal
- `wallet/hooks/` – business logic hooks
- `wallet/overlays/` – modal components
- `wallet/tabs/` – tab page components
- `wallet/constants.ts` – contract addresses, asset metadata
- `wallet/types.ts` – type definitions
- `wallet/utils.ts` – utility functions
- `LanguageProvider.tsx` – i18n context

### External
- `react@19.2.4` – hooks, context
- `next` – routing, script
- `@razorlabs/razorkit` – Aptos wallet (deprecated)
- `lucide-react` – icons

<!-- MANUAL: Plan wallet migration: replace @razorlabs/razorkit with wagmi + @abstract-foundation/agw-react. Update RazorKitStyles.tsx and WalletApp.tsx integration points accordingly. -->
