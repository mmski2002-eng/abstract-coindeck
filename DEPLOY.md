# MoveInvestor — Deployment Guide

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Linux x86_64 | macOS works too |
| `curl`, `unzip` | for CLI download |
| Movement CLI v7.4.0 | see Step 1 — do **not** use standard Aptos CLI or Aptos CLI v9+ |
| Testnet MOVE tokens | ~1 MOVE per full deploy |

---

## 1. Install Movement CLI

The standard Aptos CLI v9+ generates bytecode v9 which is rejected by the Movement testnet (requires bytecode v7). Always use the Movement-specific fork.

```bash
mkdir -p /tmp/movement-cli
curl -sL "https://github.com/movementlabsxyz/aptos-core/releases/download/movement-cli-v7.4.0/movement-cli-7.4.0-Linux-x86_64.zip" \
  -o /tmp/movement-cli.zip
unzip -o /tmp/movement-cli.zip -d /tmp/movement-cli
chmod +x /tmp/movement-cli/movement
/tmp/movement-cli/movement --version
# Expected: movement 7.4.0
```

The CLI reads profiles from `.movement/config.yaml` in the **project root** (not `.aptos/`). Always run deploy commands from the project root, not from `contracts/`.

---

## 2. Create a Deployer Account

Generate a new keypair:

```bash
/tmp/movement-cli/movement key generate --output-file /tmp/deploy_key_vN.txt
cat /tmp/deploy_key_vN.txt      # private key (hex)
cat /tmp/deploy_key_vN.txt.pub  # public key (hex)
```

Derive the account address from the public key:

```bash
python3 -c "
import hashlib
pub_hex = '<PUBLIC_KEY_HEX>'
pub_bytes = bytes.fromhex(pub_hex)
addr = hashlib.sha3_256(pub_bytes + bytes([0])).digest()
print('0x' + addr.hex())
"
```

Add the profile to `.movement/config.yaml`:

```yaml
---
profiles:
  moveinvestor_vN:
    network: Custom
    private_key: "ed25519-priv-0x<PRIVATE_KEY>"
    public_key: "ed25519-pub-0x<PUBLIC_KEY>"
    account: <ACCOUNT_ADDRESS>
    rest_url: "https://testnet.movementnetwork.xyz/v1"
    faucet_url: "https://faucet.testnet.movementnetwork.xyz/"
```

---

## 3. Update Move.toml

```toml
# contracts/Move.toml
[addresses]
moveinvestor = "0x<ACCOUNT_ADDRESS>"
```

---

## 4. Fund the Account

```bash
/tmp/movement-cli/movement account fund-with-faucet --profile moveinvestor_vN
# Adds 100 000 000 Octas (1 MOVE) to the account.
```

Web faucet: https://faucet.testnet.movementnetwork.xyz/

---

## 5. Compile

Run from the project root (not from `contracts/`):

```bash
/tmp/movement-cli/movement move compile \
  --package-dir contracts \
  --skip-fetch-latest-git-deps
```

All 6 modules must compile: `admin_control`, `fantasy_league`, `oracle`, `tournament`, `claim`, `marketplace`.

---

## 6. Publish

```bash
/tmp/movement-cli/movement move publish \
  --profile moveinvestor_vN \
  --package-dir contracts \
  --skip-fetch-latest-git-deps \
  --included-artifacts none \
  --assume-yes
```

Successful output: `"vm_status": "Executed successfully"` with a transaction hash.

Explorer: `https://explorer.testnet.movementnetwork.xyz/txn/<TX_HASH>?network=custom`

---

## 7. Initialize Modules

**Order matters.** `fantasy_league` creates the shared `AdminList` resource used by all other modules.

```bash
ADDR="0x<ACCOUNT_ADDRESS>"

for mod in fantasy_league oracle tournament claim marketplace; do
  /tmp/movement-cli/movement move run \
    --profile moveinvestor_vN \
    --function-id "${ADDR}::${mod}::initialize" \
    --assume-yes
done
```

`CardLocks` (fantasy_league) and `LockedCards` (tournament) are initialized automatically inside their respective `initialize` calls — no separate steps needed.

---

## 8. Retrieve Vault Addresses

```bash
ADDR="0x<ACCOUNT_ADDRESS>"

# Prize vault
/tmp/movement-cli/movement move view \
  --profile moveinvestor_vN \
  --function-id "${ADDR}::tournament::get_vault_address"

# Claim vault
/tmp/movement-cli/movement move view \
  --profile moveinvestor_vN \
  --function-id "${ADDR}::claim::get_claim_vault_address"
```

Vault seeds (for independent derivation):
- Prize vault: `moveinvestor_prize_vault_v2`
- Claim vault: `moveinvestor_claim_vault_v1`

---

## 9. Update Frontend Constants

Edit `frontend/src/config/project-addresses.json` — `movementTestnet` section:

```json
"contracts": {
  "moduleAddress":    "0x<ACCOUNT_ADDRESS>",
  "adminAddress":     "0x<ACCOUNT_ADDRESS>",
  "prizeVaultAddress":"0x<PRIZE_VAULT>",
  "claimVaultAddress":"0x<CLAIM_VAULT>"
}
```

Also update `frontend/.env.local`:
```
CONTRACT_ADDRESS=0x<ACCOUNT_ADDRESS>
ADMIN_ADDRESS=0x<ACCOUNT_ADDRESS>
```

And `contracts/Move.toml` (Step 3) to keep compiled artifacts in sync.

---

## 10. Verify Deployment

```bash
ADDR="0x<ACCOUNT_ADDRESS>"

# admin_control initialized
/tmp/movement-cli/movement move view \
  --profile moveinvestor_vN \
  --function-id "${ADDR}::admin_control::is_initialized"
# Expected: [true]

# marketplace live
/tmp/movement-cli/movement move view \
  --profile moveinvestor_vN \
  --function-id "${ADDR}::marketplace::listing_count"
# Expected: ["0"]

# claim state
/tmp/movement-cli/movement move view \
  --profile moveinvestor_vN \
  --function-id "${ADDR}::claim::get_claim_state"
# Expected: [false, "0", "0", "0", "6"]
```

---

## Current Deployment

| Parameter | Value |
|---|---|
| Network | Movement Testnet |
| Contract address | `0x9682243a73270da1443505065b514a2f4c5a867c304df712cad7941a1b920536` |
| Prize vault | `0xde20fcd852a7c5e42631fd78d38395f7095cc5596e871d5d5a60588bd4dcd8c6` |
| Claim vault | `0xf0ae2048d95acc5df91a09beabc5cd9b0f15f428fb81fc93b8918103a52d37d` |
| CLI profile | `moveinvestor_v6` |
| Deploy date | 2026-05-19 |
| RPC | `https://testnet.movementnetwork.xyz/v1` |
| Explorer | `https://explorer.testnet.movementnetwork.xyz` |

---

## После редеплоя на новый адрес — обязательный чеклист

При любом редеплое на новый адрес сделать **оба пункта вместе**:

**1. Обновить `frontend/src/config/project-addresses.json`** (коммитить в репо):
```json
"movementTestnet": {
  "contracts": {
    "moduleAddress":    "0xNEW_ADDRESS",
    "adminAddress":     "0xNEW_ADDRESS",
    "prizeVaultAddress":"0xNEW_PRIZE_VAULT",
    "claimVaultAddress":"0xNEW_CLAIM_VAULT"
  }
}
```

**2. Обновить `.env.local` на сервере** и задеплоить:
```bash
# Отредактировать на сервере:
nano /var/www/moveinvestor-shared/.env.local
# Изменить:
#   CONTRACT_ADDRESS=0xNEW_ADDRESS
#   ADMIN_ADDRESS=0xNEW_ADDRESS
#   VAULT_ADDRESS=0xNEW_PRIZE_VAULT
#   CLAIM_VAULT_ADDRESS=0xNEW_CLAIM_VAULT

# Применить:
cp /var/www/moveinvestor-shared/.env.local /var/www/moveinvestor-repo/frontend/.env.local
pm2 restart moveinvestor --update-env
```

**3. Очистить стейт бота** (стейл от старого контракта):
```bash
psql postgresql://moveinvestor_app:MoveInvestorDb2026Local@127.0.0.1:5432/moveinvestor \
  -c "DELETE FROM bot_state; DELETE FROM bot_config;"
```

> Схема БД (`marketplace_listings` и др.) применяется автоматически при каждом деплое через `deploy-moveinvestor-from-git.sh` — дополнительных действий не нужно.

---

## Upgrade vs. Redeploy

`upgrade_policy = "compatible"` allows in-place upgrades only when the public interface is fully backward-compatible.

| Scenario | Action |
|---|---|
| Bug fix, logic change, new private function | Upgrade in-place (Steps 5–6 only) |
| New public/public(friend) function added | Upgrade in-place (Steps 5–6 only) |
| New struct added (no existing struct changed) | Upgrade in-place |
| `#[event]` annotation added/removed on existing struct | **Redeploy** to new address |
| Field added/removed from existing struct | **Redeploy** to new address |
| Module added or removed from package | **Redeploy** to new address |

> Movement testnet disables `upgrade_policy = "arbitrary"` (`EINCOMPATIBLE_POLICY_DISABLED`). There is no workaround — incompatible changes require a fresh deploy to a new address.

---

## Randomness: Testnet vs Mainnet

`open_chest` и `open_chest_batch` сейчас используют **псевдорандом** — SHA3-256 от `(sender_addr + chest_addr + timestamp + nonce)`.

**Причина:** Movement testnet не заполняет `PerBlockRandomness.seed` — оно всегда `None`. Вызов `randomness::u8_range()` → `randomness::next_32_bytes()` → `option::borrow(None)` → abort с `EOPTION_NOT_SET`.

**Риск на мейннете:** псевдорандом предсказуем валидатором (он контролирует timestamp). Игрок или валидатор может предсказать, какую карту получит из сундука.

**Перед деплоем на мейннет:**
1. Проверить, поддерживает ли Movement mainnet `PerBlockRandomness` (seed не `None`).
2. Если да — вернуть `randomness::u8_range(0, MAX_PLAYERS)` вместо `pseudo_rand_u8(...)` и убедиться, что `#[randomness]` на функциях сохранён.
3. Если нет — оставить псевдорандом, но задокументировать это как известное ограничение.

Текущая реализация `pseudo_rand_u8` в `contracts/sources/fantasy_league.move` (функция в конце файла).

---

## Security Notes

- **Keep the deployer private key secret.** The deployer account is the contract owner and can call all privileged functions. Store the key outside the repository.
- **Testnet only.** Mainnet deployment requires a separate security review and key management process.
- **Admin list.** Additional admins can be granted via `fantasy_league::add_admin`. Only the deployer (`@moveinvestor`) can call this.
