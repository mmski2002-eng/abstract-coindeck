<!-- Generated: 2026-05-27 -->

# Abstract CoinDeck

## Purpose
Blockchain fantasy crypto league game — players draft teams of crypto coins, earn points based on real price performance, compete in tournament epochs. Migrating from Movement Network (Move/Aptos) to Abstract Network (Solidity/EVM, zkSync Era L2).

## Key Files
| File | Description |
|------|-------------|
| `CLAUDE.md` | AI coding instructions, stack context, migration mapping |
| `DEPLOY.md` | Deployment guide |
| `README.md` | Project overview |
| `SERVER_GIT_DEPLOY_LOCAL.md` | Server git deploy setup |
| `PROJECT_SCHEME.html` | Architecture diagram |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `contracts/` | Move contracts (reference) → Solidity/Hardhat target (see `contracts/AGENTS.md`) |
| `frontend/` | Next.js 14 app — UI, API routes, wallet, leaderboard (see `frontend/AGENTS.md`) |
| `database/` | PostgreSQL schema, migrations, setup scripts (see `database/AGENTS.md`) |
| `scripts/` | Bot scripts, deployment utilities (see `scripts/AGENTS.md`) |

## Architecture Overview

```
Abstract Network (zkSync Era L2)
         │
    Solidity contracts (Hardhat)
         │
    Abstract Global Wallet (AGW)
         │
    Next.js Frontend (wagmi + viem)
         │
    PostgreSQL (off-chain: leaderboard, oracle cache, marketplace index)
```

**Game Flow:**
1. Players connect via AGW (smart-contract wallet, native AA)
2. Buy NFT card packs (chests) → get crypto coin cards (ERC-721/1155)
3. Pick lineup of 5 cards per tournament day
4. Oracle posts daily coin price scores on-chain
5. Leaderboard computed off-chain, cached in Postgres
6. End of epoch: prize pool distributed to top players

## Migration Status: Movement → Abstract

| Layer | Status | Notes |
|---|---|---|
| Contracts | Reference only (Move) | Rewrite to Solidity/Hardhat |
| Frontend wallet | @razorlabs/razorkit | Replace with wagmi + @abstract-foundation/agw-react |
| Frontend chain calls | @aptos-labs/ts-sdk | Replace with viem |
| DB addresses | Aptos 32-byte hex | Update to EVM 20-byte `0x...` format |
| Scripts | Movement CLI | Replace with Hardhat scripts |

## Chain Config
| | Testnet | Mainnet |
|---|---|---|
| chainId | `11124` | `2741` |
| RPC | `https://api.testnet.abs.xyz` | `https://api.mainnet.abs.xyz` |
| Explorer | `https://explorer.testnet.abs.xyz` | `https://explorer.abs.xyz` |

## For AI Agents

### Working In This Repository
- All responses and code comments in Russian
- Solidity contracts → Hardhat project under `contracts/`
- Frontend wallet integration → wagmi + AGW (`useAbstractClient` for txns)
- Move files in `contracts/sources/` are READ-ONLY reference — do not modify
- After contract deploy: update addresses in `frontend/src/config/project-addresses.json` and `constants.ts`
- Use `rtk` prefix for CLI commands to save tokens (see CLAUDE.md)

### Testing Requirements
- Contracts: `cd contracts && npx hardhat test`
- Frontend: `cd frontend && npm run build` (type check + build)
- Frontend dev: `cd frontend && npm run dev`

### Security Checklist (per change)
- Can users cheat / replay transactions?
- Reentrancy risks in Solidity?
- Access control on admin functions?
- zkSync Era AA: validate paymaster logic if used

## Dependencies

### External
- `@abstract-foundation/agw-react` — Abstract Global Wallet React hooks
- `wagmi` + `viem` — EVM wallet + chain interactions
- `next` 14+ — App Router, API routes, SSR
- `hardhat` — Solidity compilation, deploy, test
- PostgreSQL — off-chain state, leaderboard cache

<!-- MANUAL: -->
