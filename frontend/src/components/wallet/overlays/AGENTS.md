<!-- Parent: ../../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# overlays

## Purpose
Modal dialogs and overlay components for game interactions: buying/opening chests, merging cards, confirming lineups, revealing new cards, wallet connection, onboarding.

## Key Files
| File | Description |
|------|-------------|
| `ChestBuyModal.tsx` | Modal: select chest type, qty, confirm purchase; shows price and rarity |
| `ChestOpenModal.tsx` | Modal: select chest type, qty, confirm open; lists available chest NFT addresses |
| `ChestOpeningOverlay.tsx` | Fullscreen overlay during chest opening animation; shows spinning chest, reveals card |
| `ChestReveal.tsx` | Card reveal modal (single or multi); displays new card(s) with tier color and stats |
| `MergeAnimation.tsx` | Merge animation overlay; shows 5→1 merge progression with visual feedback |
| `LineupConfirmModal.tsx` | Confirm tournament lineup; displays 5 selected cards, role match indicators, submit/cancel buttons |
| `QuickBuyMergeModal.tsx` | Combined quick-buy and quick-merge workflow; shows needed qty to merge vs. market price |
| `OnboardingModal.tsx` | Onboarding flow: collect player nickname, create on-chain inventory account, initial chest claim |
| `SellModal.tsx` | Sell card modal; lists selected card with price input and confirmation |
| `TransferModal.tsx` | Transfer card modal; select recipient address and confirm |
| `ConnectPortals.tsx` | Wallet connection UI (Aptos wallets); deprecated with move to Abstract + wagmi |

## For AI Agents

### Working In This Directory
- **Modal pattern**: Each modal receives isOpen, onClose, and data (what to show/edit)
- **Button states**: Monitor busy flag (submitted, waiting for on-chain); disable buttons during tx
- **Language**: Use useI18n() from LanguageProvider for i18n strings (Russian/English)
- **Tailwind**: Use palette from wallet/constants.ts (CARD_TIER_STYLES, TIER_COLORS) for consistent styling
- **Animations**: CSS keyframes (ModalKeyframes from @/components/ui); Framer Motion if complex
- **Form validation**: Simple client-side checks (qty > 0, nickname length <= MAX_NICKNAME_BYTES)

### Common Patterns
- **Controlled inputs**: onInput/onChange → setState immediately for UI responsiveness
- **Spinner/busy**: Show spinner during submitTx or fetch; disable buttons until completion
- **Error display**: Red text below input or in toast; cleared on modal close
- **Tier colors**: Use TIER_COLORS[tier] for card tiers (common/rare/epic/legendary)
- **Price display**: Format as currency with commas (e.g., "10,000,000")
- **Nested modals**: Keep simple; prefer sequential modals (open → close → open next)

## Dependencies

### Internal
- `../constants.ts` – TIER_COLORS, TIER_MULTS, COIN_TICKERS, COIN_ICONS
- `../types.ts` – CardData, Listing, QuickBuyMergeData
- `../../LanguageProvider.tsx` – useI18n() hook
- `@/components/ui` – ModalKeyframes, spinner, icon components

### External
- `react@19.2.4` – useState, useEffect
- `lucide-react` – UI icons
- `tailwindcss@4` – styling

<!-- MANUAL: ChestOpeningOverlay and MergeAnimation have CPU-intensive animations; test on mobile/low-end devices. ConnectPortals is deprecated (Aptos wallet); replace with Abstract wallet connector once wagmi + AGW integration is complete. -->
