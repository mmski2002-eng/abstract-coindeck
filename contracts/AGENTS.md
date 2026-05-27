<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# contracts

## Purpose
Move smart contracts (REFERENCE ONLY for migration). Target: Solidity/Hardhat for Abstract Network (zkSync Era).

These contracts implement a blockchain fantasy crypto game on Movement network. They define the core game mechanics: tournament lineup submission, card NFTs, oracle-driven scoring, prize claims, and peer-to-peer marketplace.

## Key Files
| File | Description |
|------|-------------|
| `Move.toml` | Package manifest. Depends on AptosFramework + AptosTokenObjects (Movement fork) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `sources/` | 6 core Move modules (see `sources/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **READ ONLY** — reference for Solidity migration
- Use these Move contracts to understand game logic, state transitions, events
- Map Move resources → Solidity structs/mappings
- Map Move entry functions → Solidity external/public functions
- Map Move events → Solidity events
- Verify epoch/day timing, fee calculations, rate limits during porting

### Migration Notes
- Move uses Move::account resource accounts for vault escrow; Solidity uses address(this) or separate contracts
- Move SmartTable → Solidity mapping
- Move vector → Solidity array (bounded by MAX_CHEST_BATCH, MERGE_COUNT, etc.)
- Move coin transfers → Solidity ERC-20 transfers
- Move object model (NFTs) → Solidity ERC-721/ERC-1155
- Epoch/day calculation: (now - start_ts) / 86400 % 7, same in both

## Dependencies
### External
- AptosFramework (Movement fork): account, coin, event, timestamp, object
- AptosTokenObjects: collection, token

### Internal
- All 6 modules are interdependent via friend relationships (see `sources/AGENTS.md`)
