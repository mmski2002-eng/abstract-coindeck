# Abstract CoinDeck

# CLAUDE.md

## General Behavior

* Be concise and implementation-focused.
* Prefer working code over explanations.
* Do not explain basics unless explicitly asked.
* Avoid unnecessary abstractions.
* Always respond in Russian only. Never use Ukrainian.

---

## Project Context

Blockchain game (fantasy crypto league) — мигрируем с Movement (Move) на Abstract Network (Solidity/EVM).

Focus areas:

* smart contract logic (Solidity, Hardhat)
* frontend integration (wagmi, viem, Abstract Global Wallet)
* game mechanics and state handling
* performance and UX

---

## Development Rules

* Always provide production-ready code.
* Avoid pseudocode unless explicitly requested.
* Prefer minimal and clean solutions.
* Do not introduce heavy dependencies unless necessary.

---

## Smart Contract Guidelines

When working with contracts:

* Keep logic simple and auditable.
* Avoid complex inheritance.
* Minimize external calls.
* Validate all inputs strictly.
* Handle edge cases explicitly.

Always consider:

* access control
* reentrancy risks
* state consistency
* gas efficiency

---

## Frontend (dApp) Rules

* Use clear separation between UI and blockchain logic.
* Handle wallet connection gracefully.
* Always handle:

  * transaction pending state
  * errors
  * user rejection
* Do not block UI on async calls.

---

## Game Logic

* Keep game state deterministic.
* Avoid trusting client-side logic.
* Validate all critical actions on-chain.
* Prevent replay or double execution.

---

## Security Awareness

Even during development, always check:

* Can users cheat?
* Can transactions be replayed?
* Can state be manipulated?
* Can funds be locked or lost?

---

## Output Rules

When generating code:

* Provide complete, runnable snippets.
* Include only necessary comments.
* Avoid long explanations.

When suggesting changes:

* Show before/after if possible.
* Be explicit about what to modify.

---

## Debugging

When debugging:

* Identify root cause first.
* Suggest minimal fix.
* Do not rewrite entire modules unless required.

---

## Interaction Style

* Ask for missing context before guessing.
* If multiple solutions exist, give the simplest one.
* Prefer concrete examples over theory.

---

## Efficiency Rules

* Do not generate large boilerplate unless requested.
* Reuse existing project patterns.
* Avoid overengineering.

---

## Example Requests (Preferred Style)

* "Implement wallet connect flow"
* "Fix this transaction failing issue"
* "Write contract function for game reward claim"
* "Optimize this function for gas"
* "Handle transaction error in UI"

---

## Mindset

* Think like a senior blockchain engineer.
* Prioritize correctness over cleverness.
* Keep systems simple, predictable, and secure.

## Stack
- **Smart contracts**: Solidity, Hardhat, Abstract Network (zkSync Era-based EVM L2)
- **Frontend**: Next.js, TypeScript, React, wagmi, viem, @abstract-foundation/agw-react
- **Chain testnet**: Abstract Testnet — chainId `11124`, RPC `https://api.testnet.abs.xyz`
- **Chain mainnet**: Abstract Mainnet — chainId `2741`, RPC `https://api.mainnet.abs.xyz`
- **Explorer**: `https://explorer.abs.xyz`
- **DB**: PostgreSQL (адреса кошельков — EVM формат `0x...`)
- **Wallet**: Abstract Global Wallet (AGW) — native AA, смарт-контракт кошельки

## Migration: Movement → Abstract
| Было (Movement) | Стало (Abstract) |
|---|---|
| Move lang | Solidity |
| `movement aptos` CLI | Hardhat / Foundry |
| Aptos wallet adapter | wagmi + AGW (`@abstract-foundation/agw-react`) |
| `AccountAddress` (hex 32 bytes) | EVM address (20 bytes) |
| Resources / Tables | mappings, structs в Solidity |
| `aptos_framework::coin` | ERC-20 / native ETH |
| Move NFT (token v2) | ERC-721 / ERC-1155 |

## Structure
```
contracts/
  Move.toml              (устаревший — будет hardhat проект)
  sources/               Move контракты (референс для миграции)
frontend/
  src/
    app/                 Next.js pages + API routes
    components/          React components
    components/wallet/   Wallet logic (hooks, constants)
database/
  schema.sql             PostgreSQL схема
scripts/                 Deployment & testing utilities
```

## Commands
- Contracts dev: `cd contracts && npx hardhat compile`
- Deploy testnet: `cd contracts && npx hardhat run scripts/deploy.ts --network abstractTestnet`
- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`

## Key Files
- `contracts/sources/tournament.move` — референс: турнирные эпохи, lineup, prize pool
- `contracts/sources/fantasy_league.move` — референс: NFT карты, сундуки, инвентарь
- `frontend/src/components/WalletApp.tsx` — wallet UI entry
- `frontend/src/components/wallet/constants.ts` — адреса контрактов (обновлять после деплоя)
- `frontend/src/app/api/leaderboard/worker.ts` — off-chain leaderboard scoring
- `database/schema.sql` — PostgreSQL схема

## Notes
- AGW (Abstract Global Wallet) — смарт-контракт кошельки с native AA; используй `useAbstractClient` для транзакций
- После деплоя: обновить адреса в `constants.ts` и ENV переменные
- EVM адреса lowercase: `0x` + 40 hex символов
- zkSync Era специфика: `paymaster`, `factoryDeps` в транзакциях при AA

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

