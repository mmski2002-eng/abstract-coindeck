# Отчет по аудиту безопасности Abstract CoinDeck

Дата: 2026-06-02

Область аудита: 6 Solidity-контрактов в `contracts/contracts/`:

- `AdminControl.sol`
- `CoinDeckNFT.sol`
- `Tournament.sol`
- `Oracle.sol`
- `Marketplace.sol`
- `Claim.sol`

Проверка сборки: `cd contracts && npx hardhat compile` проходит успешно под zkSync Era.

Критических публичных reentrancy/AA-несовместимостей не найдено. Основные риски перед mainnet связаны с governance/timelock, целостностью oracle/claim, учетом ETH через `address(this).balance` и механизмом NFT-инвентаря.

## Findings

### [HIGH] `AdminControl::hasRole()/setActionDelay()/consumeAction()`

Контракт: `AdminControl`

Файл: `contracts/contracts/AdminControl.sol`

Функции: `hasRole`, `setActionDelay`, `consumeAction`

Description: `owner` автоматически проходит все роли через `hasRole()`. Он может мгновенно менять delays для всех действий кроме treasury и тем самым обходить timelock для claim/oracle/NFT/emergency действий.

PoC:

1. `owner` вызывает `setActionDelay(ACTION_SET_CLAIM_LIST, 0)`.
2. Затем вызывает `Claim.setClaimList(...)` без предварительной очереди и ожидания.

Fix: убрать `owner`-bypass из `hasRole`, перевести владение на `Ownable2Step + multisig`, изменения delays проводить только через timelock с минимальными floor-delay для критичных действий.

### [HIGH] `AdminControl::grantRole()/revokeRole()`

Контракт: `AdminControl`

Файл: `contracts/contracts/AdminControl.sol`

Функции: `grantRole`, `revokeRole`

Description: роли выдаются и отзываются без timelock. Компрометированный или злонамеренный `owner` может выдать `ROLE_CLAIM`, `ROLE_ORACLE`, `ROLE_NFT`, `ROLE_EMERGENCY` и сразу менять критичную логику системы.

PoC:

1. `owner` вызывает `grantRole(attacker, ROLE_CLAIM)`.
2. После снижения delay attacker меняет claim-list или запускает claim-процесс.

Fix: изменения ролей проводить через timelock. Для экстренного отзыва ролей сделать отдельный ограниченный emergency-flow с событием и четкой областью действия.

### [HIGH] `CoinDeckNFT::setTournamentContract()`

Контракт: `CoinDeckNFT`

Файл: `contracts/contracts/CoinDeckNFT.sol`

Функция: `setTournamentContract`

Description: `owner` без timelock может поменять `tournamentContract`. Новый адрес получает право вызывать `lockEggMonet` и `unlockEggMonet` для любых tokenId.

PoC:

1. `owner` устанавливает malicious tournament через `setTournamentContract(attackerContract)`.
2. `attackerContract` вызывает `lockEggMonet(victimToken, type(uint256).max)`.
3. NFT жертвы становится заблокированным на неопределенно долгий срок.

Fix: добавить timelock и двухфазную смену tournament-адреса. Для mainnet предпочтительно сделать адрес tournament неизменяемым после первичной настройки или разрешить смену только через governance-delay.

### [HIGH] `Oracle::postDayScores()/setPosted()`

Контракт: `Oracle`

Файл: `contracts/contracts/Oracle.sol`

Функции: `postDayScores`, `setPosted`

Description: oracle не проверяет активную эпоху, допустимый day, полноту набора игроков и уникальность `playerIds`. `setPosted(day, true)` может финализировать день без очков.

PoC:

1. oracle вызывает `setPosted(3, true)`.
2. `getDayScores(3)` возвращает `posted = true`, но массивы очков могут быть пустыми.
3. leaderboard воспринимает день как finalized с нулевыми score.

Fix: хранить epoch/day, требовать `day` в диапазоне `1..6`, ровно 50 уникальных `playerIds`, запретить пустую финализацию через `setPosted`. Лучше убрать `setPosted(true)` как отдельную функцию или разрешить ее только для уже заполненного дня.

### [HIGH] `Claim::setClaimList()`

Контракт: `Claim`

Файл: `contracts/contracts/Claim.sol`

Функция: `setClaimList`

Description: winner list полностью задается claim-admin без on-chain merkle root, commit hash или проверки связи с leaderboard. Это дает администратору прямой контроль над распределением призового фонда.

PoC:

1. claim-admin задает `addrs = [attacker]`, `amounts = [vaultBalance]`.
2. claim-admin запускает `startClaim`.
3. attacker вызывает `claim()` и забирает весь vault.

Fix: хранить заранее опубликованный `claimListHash` или merkle root через timelock. `claim()` должен проверять merkle proof, либо список должен быть неизменяемо зафиксирован с достаточным delay для проверки пользователями.

### [MEDIUM] `CoinDeckNFT::adminReissueEggMonet()`

Контракт: `CoinDeckNFT`

Файл: `contracts/contracts/CoinDeckNFT.sol`

Функция: `adminReissueEggMonet`

Description: функция вручную вызывает `_removeEggMonetFromInventory`, затем `_burn()` вызывает `_afterTokenTransfer`, где тот же token удаляется из inventory второй раз. Это может ревертить или портить локальный индекс инвентаря.

PoC:

1. У пользователя есть 2 EggMonet.
2. Админ вызывает `adminReissueEggMonet(tokenA)`.
3. Первый remove удаляет `tokenA`.
4. `_burn(tokenA)` запускает hook и повторно удаляет элемент из `_userEggMonets`, что может удалить чужой token из локального списка.

Fix: убрать ручной вызов `_removeEggMonetFromInventory` в `adminReissueEggMonet`; полагаться на hook `_afterTokenTransfer` при `_burn`.

### [MEDIUM] `CoinDeckNFT::burn()` inherited

Контракт: `CoinDeckNFT`

Файл: `contracts/contracts/CoinDeckNFT.sol`

Функция: inherited `burn`

Description: `ERC721Burnable.burn()` не переопределен. Locked EggMonet нельзя transfer, но можно burn, потому `_beforeTokenTransfer` исключает burn-путь (`to == address(0)`). Это ломает смысл lock-механизма: игрок может уничтожить карту, участвующую в lineup.

PoC:

1. Игрок отправляет lineup через `Tournament.submitWeighing`.
2. Tournament блокирует EggMonet.
3. Игрок вызывает `burn(lockedEggMonetId)`.
4. Locked NFT уничтожен, хотя transfer/merge/list запрещены.

Fix: переопределить `burn()` или изменить `_beforeTokenTransfer`, чтобы locked EggMonet нельзя было burn без специального tournament/admin recovery-flow.

### [MEDIUM] `Tournament::getState()` / prize accounting

Контракт: `Tournament`

Файл: `contracts/contracts/Tournament.sol`

Функция: `getState`

Description: prize pool берется из `address(this).balance`. Любой forced ETH/donation меняет pool math и off-chain генерацию claim-листа, потому фронт/бот используют `prizePool` из `Tournament.getState()`.

PoC:

1. Attacker force-sends ETH в `Tournament` перед генерацией claim-list.
2. `getState().prizePool` становится выше реальных игровых поступлений.
3. Off-chain claim generation может распределить больше, чем экономически должно быть распределено.

Fix: вести `accountedPrizePool` и изменять его только в разрешенных flows: `depositPrize`, forwarded ETH из `buyEgg`, fees и `withdrawTo`. Raw balance использовать только как техническую проверку платежеспособности.

### [MEDIUM] `Claim::startClaim()/closeClaim()/getClaimState()`

Контракт: `Claim`

Файл: `contracts/contracts/Claim.sol`

Функции: `startClaim`, `closeClaim`, `getClaimState`

Description: Claim vault тоже опирается на `address(this).balance`. Remainder возвращается как весь balance, включая посторонние forced funds.

PoC:

1. Attacker force-sends ETH в `Claim`.
2. После deadline `closeClaim()` отправляет весь raw balance на `prizeReturnAddr`.
3. Accounting claim vault не отделяет обязательства перед победителями от посторонних поступлений.

Fix: хранить `totalRequired`, `totalClaimed`, `accountedRemainder`. Не использовать raw `address(this).balance` как источник учетной истины.

### [MEDIUM] `CoinDeckNFT::_pseudoRand()`

Контракт: `CoinDeckNFT`

Файл: `contracts/contracts/CoinDeckNFT.sol`

Функция: `_pseudoRand`

Description: scratch randomness детерминирован из публичных inputs, `block.timestamp` и `block.prevrandao`. Игрок может симулировать результат и гриндить момент scratch.

PoC:

1. Пользователь вычисляет `playerId = hash(user, tokenId, timestamp, prevrandao) % maxPlayers`.
2. Scratch выполняется только при выгодном результате.
3. Экономика NFT и редкости может быть искажена.

Fix: commit-reveal или проверяемый randomness. Для mainnet не использовать такой randomness для экономически значимых NFT.

### [LOW] `Marketplace::cancelListing()` / emergency path

Контракт: `Marketplace`

Файл: `contracts/contracts/Marketplace.sol`

Функция: `cancelListing`

Description: одиночный cancel доступен только seller. Emergency admin может только массово очищать все listings через `adminClearListings`, что не соответствует требованию "seller OR admin(EMERG)".

PoC:

1. Один listing зависает из-за edge-case.
2. Emergency admin не может точечно вернуть NFT продавцу.
3. Единственный путь - массовый clear всех listings.

Fix: добавить `emergencyCancelListing(listingId)` с `ROLE_EMERGENCY`, событием и timelock или коротким emergency-delay.

### [LOW] `Marketplace::getListingsPage()`

Контракт: `Marketplace`

Файл: `contracts/contracts/Marketplace.sol`

Функция: `getListingsPage`

Description: нет upper bound на `limit`. View может стать дорогим или падать по OOG при on-chain вызовах или слишком большом ответе.

PoC:

1. Вызов `getListingsPage(0, 1_000_000)`.
2. Контракт пытается аллоцировать большие массивы.

Fix: ограничить `limit <= MAX_PAGE_SIZE`.

## Timelock actions

| Action | Default delay | Bypass |
|---|---:|---|
| `ACTION_SET_BASE_URIS` | 10 min | `owner` может поставить 0 |
| `ACTION_SET_EGG_PRICES` | 10 min | `owner` может поставить 0 |
| `ACTION_ADMIN_MINT_TO` | 30 min | `owner` может поставить 0 |
| `ACTION_RESET_ALL_ORACLE_DAYS` | 30 min | `owner` может поставить 0 |
| `ACTION_TREASURY_WITHDRAW` | 1 hour | min 1h, но `owner` имеет treasury-role |
| `ACTION_SET_CLAIM_DAYS` | 30 min | `owner` может поставить 0 |
| `ACTION_SET_CLAIM_LIST` | 30 min | `owner` может поставить 0 |
| `ACTION_START_CLAIM` | 30 min | `owner` может поставить 0 |
| `ACTION_CLOSE_CLAIM` | 10 min | `owner` может поставить 0 |
| `ACTION_STOP_AND_RESET` | 0 | always immediate |
| `ACTION_CLEAR_LISTINGS` | 0 | always immediate |

## Reentrancy и zkSync Era / Abstract notes

- `tx.origin` не найден.
- `msg.sender == tx.origin` checks не найдены.
- `.transfer()` не найден; ETH отправляется через `.call{value:}`.
- `Tournament.withdrawTo`, `Marketplace.buyEggMonet`, `Marketplace.buyEggMonetsBatch`, `Claim.claim`, `Claim.closeClaim`, `CoinDeckNFT.buyEgg` используют `nonReentrant`.
- Основной zkSync/AA-риск не в gas stipend, а в governance и учетной модели ETH.
- `block.timestamp` используется для epoch/day и lockUntil. Для дневных окон это приемлемо, но oracle должен проверять закрытие дня и epoch-boundaries, а не доверять только off-chain worker.

## Risk summary

| Contract | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|---|---:|---:|---:|---:|---:|
| `AdminControl` | 0 | 2 | 0 | 0 | 1 |
| `CoinDeckNFT` | 0 | 1 | 3 | 0 | 0 |
| `Tournament` | 0 | 0 | 1 | 0 | 0 |
| `Oracle` | 0 | 1 | 0 | 0 | 0 |
| `Marketplace` | 0 | 0 | 0 | 2 | 0 |
| `Claim` | 0 | 1 | 1 | 0 | 0 |

## Top 3 fixes before mainnet

1. Закрыть governance bypass: `Ownable2Step`, multisig, timelocked role/delay changes, без `owner()` как super-role.
2. Зафиксировать claim/oracle integrity: merkle/commit hash для winners, строгая валидация oracle day scores.
3. Исправить NFT lock/inventory: `adminReissueEggMonet()` double-remove и запрет burn locked EggMonet.

## Invariants для Foundry/Hardhat fuzz tests

- Locked EggMonet нельзя transfer, burn, merge, list или buy через любой ERC721 path.
- После любого mint/burn/transfer/reissue `getUserEggMonets(owner)` совпадает с реальным `ownerOf`.
- `sum(unclaimed) + totalClaimed <= accountedClaimVault`, независимо от forced ETH.
- `accountedPrizePool` меняется только разрешенными flows и не зависит от raw `address(this).balance`.
- Oracle day finalized только если ids уникальны, полный диапазон игроков, day принадлежит активной или закрытой эпохе.
- Timelocked action не исполняется раньше `executeAfter`, даже если owner меняет delay после queue.
- `consumeAction` должен требовать именно тот payload hash, который был queued.
- Claim-list нельзя изменить во время active claim window.
- Marketplace `accumulatedFees` всегда равно сумме fee по успешным продажам минус withdrawn fees.
- Emergency clear listings должен возвращать все escrow NFT их sellers и очищать `byEggMonet`.
