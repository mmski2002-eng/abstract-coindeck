<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# scripts

## Purpose
Utility scripts for contract deployment, testing, simulation, oracle posting, and bot operations. Target: Movement CLI (pre-migration) and Hardhat (post-migration to Abstract).

## Key Files
| File | Description |
|------|-------------|
| `bot.js` | Master bot: spawns 300 wallets (3 chest types), buys chests, opens 6, submits lineup, lists 6th card on marketplace |
| `daily_lineup_bot.js` | Cron bot: submits lineups daily for all 300 wallets (idempotent, skips rest days) |
| `loadtest_bot.js` | (implied) Load testing bot variant (reuses sim-wallets) |
| `sim-bot.js` | (implied) Simulation bot |
| `sim-daily.js` | (implied) Daily simulation runner |
| `check_lineup.js` | Utility: query player's lineup for a day |
| `oracle_post.js` | Manual tool: post player scores for a day to oracle |
| `compile.ps1` | PowerShell: compiles Move contracts (`move compile`) |
| `publish_testnet.ps1` | PowerShell: publishes Move module to testnet |
| `test.ps1` | PowerShell: runs Move unit tests (`move test`) |

## Script Ecosystem

### Deployment & Compilation
- `compile.ps1` — Move compiler wrapper
- `publish_testnet.ps1` — publishes compiled module to testnet
- Future: Hardhat equivalents (`compile.js`, `deploy.js` for Solidity)

### Simulation & Load Testing
- `bot.js` — full player lifecycle (300 bots, 3 tiers, chest opening, lineup, listing)
- `daily_lineup_bot.js` — daily lineup submission for all bots (target: cron job)
- `loadtest_bot.js` — stress test variant
- `sim-bot.js`, `sim-daily.js` — simulation runners

### Operations
- `check_lineup.js` — query player's current/historical lineup
- `oracle_post.js` — admin tool to post day scores

## Architecture: bot.js & daily_lineup_bot.js

### bot.js (One-time Setup)
**Purpose**: Generate 300 test wallets and run one full game loop per wallet.

**Workflow per bot**:
1. Generate or load existing wallet from `data/bot-wallets.json`
2. Faucet 2 MOVE
3. Register inventory + nickname (new wallets only)
4. Buy 6 chests (type = bot_idx % 100)
5. Open all 6 chests → 6 cards (randomized player_id, tier = chest_type)
6. Submit 5-card lineup
7. List 6th card on marketplace at tier-based price

**Wallets Grouped by Chest Type**:
- Bots 1-100: Wooden Chest (type 0) → Common/Rare
- Bots 101-200: Iron Chest (type 1) → Rare/Epic
- Bots 201-300: Silver Chest (type 2) → Epic/Legendary

**Persistence**: Wallets saved to `data/bot-wallets.json` after generation. Re-run reuses existing wallets (idempotent except for faucet + new inventory).

### daily_lineup_bot.js (Recurring Cron)
**Purpose**: Submit lineups for all 300 wallets once per active day (skips rest days).

**Workflow**:
1. Load wallets from `data/loadtest-wallets.json` (or `BOT_STATE_FILE`)
2. Fetch tournament state (running, epoch, day, is_rest_day)
3. Skip if: not running, rest day, or day < 1
4. For each wallet (concurrent, configurable):
   - Check if lineup already submitted for this day (idempotent)
   - Fetch cards (need at least 5)
   - Submit lineup with first 5 cards
5. Log results (submitted, skipped, errors)

**Idempotency**: Calls `has_lineup_for_day(addr, day)` before submitting. Safe to run multiple times.

**Concurrency**: Default 8 concurrent wallets, configurable via `BOT_CONCURRENCY` env var.

**Cron Setup**:
```bash
# Run daily at 8 AM
0 8 * * * /usr/bin/node /path/to/scripts/daily_lineup_bot.js --execute
```

## Environment Variables

### All Scripts
- `MODULE_ADDR` or `CONTRACT_ADDRESS` — moveinvestor module address (falls back to project-addresses.json)
- `REST_URL` — chain REST endpoint
- `FAUCET_URL` — faucet endpoint (bot.js only)

### daily_lineup_bot.js
- `BOT_STATE_FILE` — path to wallets JSON (default: `data/loadtest-wallets.json`)
- `BOT_CONCURRENCY` — parallel wallets (default: 8)
- `BOT_TX_WAIT_SECS` — tx confirmation timeout (default: 40)
- `BOT_BETWEEN_TX_MS` — delay between submissions (default: 400)

## For AI Agents

### Working In This Directory

#### Post-Migration to Solidity/EVM (Abstract Network)
- Move compilation (`compile.ps1`) → Hardhat compilation (`hardhat compile`)
- Move deployment (`publish_testnet.ps1`) → Hardhat deployment (`hardhat run scripts/deploy.js`)
- Script SDK imports: `@aptos-labs/ts-sdk` → `ethers.js` or `web3.js`
- Address format: `0x...` (Move addresses are 32-hex, EVM are 20-hex)
- Module addresses → contract addresses (new deployment needed)
- AptosConfig, Network → Ethers provider/signer setup
- Transaction building (`aptos.transaction.build`) → contract method calls + signing

#### Key Dependencies
- `@aptos-labs/ts-sdk` — Aptos SDK (pre-migration)
- `frontend/node_modules/` — shared SDK location
- `frontend/src/config/project-addresses.json` — address book

#### Common Patterns
- **View functions** (read-only):
  ```javascript
  const res = await fetch(`${REST_URL}/view`, {
    method: "POST",
    body: JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
  });
  ```
- **Transactions** (write):
  ```javascript
  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: fn, typeArguments: [], functionArguments: args },
  });
  const signed = aptos.transaction.sign({ signer: account, transaction: txn });
  const res = await aptos.transaction.submit.simple({ ... });
  await aptos.waitForTransaction({ ... });
  ```
- **Error handling**: Wrap in try-catch, retry on transient failures (3 attempts with backoff)

#### Testing the Bots
1. Deploy contracts (Move or Solidity)
2. Run `bot.js` to populate 300 wallets and first lineups
3. Post daily scores with `oracle_post.js`
4. Run `daily_lineup_bot.js --execute` to submit next day's lineups
5. Verify leaderboards in frontend

#### Debugging
- Add `--debug` flag to scripts to see verbose transaction details
- Check `data/*.json` for wallet state
- Query contract views directly: `check_lineup.js <address> <day>`
