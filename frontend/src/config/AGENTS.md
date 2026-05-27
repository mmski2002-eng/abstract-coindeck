<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# config

## Purpose
Runtime configuration and static asset metadata: contract addresses (environment-aware), asset universe (50 crypto coins with metadata), and initialization helpers.

## Key Files
| File | Description |
|------|-------------|
| `projectAddresses.ts` | Contract address resolution: moduleAddress, adminAddress, prizeVaultAddress, claimVaultAddress, restUrl, faucetUrl, explorerUrl; supports network override via ACTIVE_NETWORK env |
| `project-addresses.json` | Static config file with networks, contract addresses, and debug wallets per network |
| `assetUniverse.ts` | Asset metadata for all 50 game coins: names, tickers, CoinGecko IDs, roles (L1/L2/DeFi/Exchange/Meme), teams, brand colors, icon paths, GitHub repos |

## For AI Agents

### Working In This Directory
- **Runtime addresses**: Use getRuntimeProjectAddresses() in server-side code (API routes); use projectAddresses constant in client code
- **Environment overrides**: ACTIVE_NETWORK, CONTRACT_ADDRESS, MODULE_ADDR, ADMIN_ADDRESS, VAULT_ADDRESS, CLAIM_VAULT_ADDRESS, REST_URL env vars override JSON defaults
- **Asset array**: ASSETS in assetUniverse.ts is single source of truth for all 50 coins; indexed by playerId
- **Exports**: Both default and named exports; re-exported as constants (HEROES, COIN_TICKERS, etc.) from wallet/constants.ts

### Common Patterns
- **Network awareness**: Code works on multiple blockchains (Movement/Aptos and soon Abstract); network determined at build/runtime
- **Asset lookup**: playerId → ASSETS[playerId] for name, ticker, role, color, icon; used throughout UI
- **Icon paths**: Public directory paths (/coins/0_BTC.webp); use ASSET_ICON_PATHS or COIN_ICONS constant
- **Role IDs**: 0=L1, 1=L2, 2=DeFi, 3=Exchange, 4=Meme/Infra; used for tournament slot-matching bonus
- **CoinGecko IDs**: cgkId for market data API queries; stored in ASSET_CGK_IDS

## Dependencies

### Internal
- None (pure config files)

### External
- `fs` (Node.js only in getRuntimeProjectAddresses)

<!-- MANUAL: Contract addresses must be updated after each smart contract deployment. ASSET_SET_VERSION tracks schema changes to asset list; increment if roles or names change. Icon assets (coin/chest sprites) live in public/coins/ and public/chests/; ensure WebP versions exist for optimization. -->
