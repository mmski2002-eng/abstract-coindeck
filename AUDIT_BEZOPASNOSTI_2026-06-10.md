# Аудит безопасности — Abstract CoinDeck (2026-06-10)

Объекты: локальный код репозитория + прод https://escape.isgood.host/

---

## CRITICAL

### C1. SSH-пароль root от прод-сервера в открытом виде в `CLAUDE.md`, закоммичен в git
**Где:** `CLAUDE.md:197, 208` (трекается git с самого первого коммита `fe24bf9`)
```
- SSH: `ssh root@216.173.70.241` (password: `REDACTED`)
client.connect('216.173.70.241', username='root', password='REDACTED')
```
Любой, у кого есть доступ к репозиторию (или его клон/история), получает полный root-доступ к продакшен-серверу.

**Фикс:**
- Немедленно сменить пароль root на сервере, перейти на SSH-ключи, отключить `PasswordAuthentication` в `sshd_config`.
- Удалить пароль из `CLAUDE.md` (заменить на ссылку на секрет-хранилище / переменную окружения агента).
- Переписать историю git (`git filter-repo` / BFG) для удаления пароля из всех коммитов, либо считать пароль скомпрометированным и обязательно ротировать.

---

### C2. Реальные продакшен-секреты закоммичены в git (`frontend/doc_2026-05-28_16-45-45.env.local`)
**Где:** файл трекается git минимум в 9 коммитах (от `26f7024` до `dc283cb`), несмотря на то что `.gitignore` исключает `**/.env.local` — файл не попадает под маску из-за префикса `doc_...`.

Содержимое (совпадает с продовым `frontend/.env.local`):
```
MARKET_DATA_SECRET=c8c47cd7ea31b78b0bd465006a416dae4cda0980d682d25a9c988212c42a74de
ADMIN_SECRET=coindeck_local_dev_secret_abstract_2026
DATABASE_URL=postgresql://postgres:20021987@localhost:5432/coindeck_dev
CRON_SECRET=20021987
```
- `ADMIN_SECRET` используется в `checkSecretAuth()` (`frontend/src/app/api/admin/auth.ts:84-94`) как bearer-токен для админ-эндпоинтов (`/api/bot`, `/api/leaderboard/config`, `/api/admin/claim-list/preview` и др.).
- `CRON_SECRET` используется в `frontend/src/app/api/bot/tick/route.ts` для авторизации крон-тика бота.
- `DATABASE_URL` — пароль от Postgres.

Утечка любого из этих секретов даёт атакующему возможность дергать `/api/bot` (управление бот-кошельком, claim-list, timelock-действия) от имени админа без подписи кошелька.

**Фикс:**
- Удалить файл из репозитория и истории (`git rm` + `filter-repo`/BFG).
- Сгенерировать новые `ADMIN_SECRET`, `CRON_SECRET`, `MARKET_DATA_SECRET`, сменить пароль Postgres — старые считать скомпрометированными.
- Добавить в `.gitignore` маску `**/*.env.local` (без anchor на начало имени) либо `**/*env*.local`, проверить `git ls-files | grep -i env` перед каждым коммитом.

---

### C3. Слабые/предсказуемые секреты
**Где:** `frontend/.env.local`, `contracts/.env.local`
- `ADMIN_SECRET=coindeck_local_dev_secret_abstract_2026` — выглядит как dev-плейсхолдер, угадываемый по шаблону.
- `CRON_SECRET=20021987` и пароль БД `20021987` — похоже на дату (ddmmyyyy), легко брутфорсится.

**Фикс:** заменить на криптографически случайные строки ≥32 байт (`openssl rand -hex 32`), как уже сделано для `MARKET_DATA_SECRET`.

---

## HIGH

### H1. Отсутствует HSTS (`Strict-Transport-Security`)
**Где:** ответ `https://escape.isgood.host/` — заголовка нет вообще, хотя HTTP→HTTPS редирект (301) настроен.

Без HSTS первый запрос пользователя по HTTP (например, по старой ссылке/закладке) уязвим к SSL-stripping MITM.

**Фикс (nginx):**
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

---

### H2. CSP разрешает `'unsafe-inline'` для `script-src` и `style-src`
**Где:** заголовок `Content-Security-Policy` на проде:
```
script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
```
`unsafe-inline` для script-src фактически нейтрализует основную защиту CSP от XSS — любой инжектированный `<script>` или `onerror=` выполнится.

**Фикс:** перейти на nonce/hash-based CSP (Next.js поддерживает `nonce` через middleware), убрать `unsafe-inline` для `script-src`. Для `style-src` риск ниже, но желательно тоже заменить на nonce/hash при наличии возможности.

---

## MEDIUM

### M1. `/api/bot` (GET) отдаёт состояние бота без авторизации
**Где:** `frontend/src/app/api/bot/route.ts:21-31`, проверено живьём — `curl https://escape.isgood.host/api/bot` отдаёт 200 и полный JSON: режим, статус, все `txHashes` (вкл. `set-claim-list`, `start-claim`, `oracle-post-day-N`), внутренние сообщения (`"Claim window already active"`), а также адрес кошелька бота через `botWalletStatus()`.

Сами по себе tx-хэши публичны в чейне, но раскрытие внутреннего стейджа/стадии бота и адреса кошелька облегчает таргетированный фронтраннинг или тайминг-атаки на действия бота (например, момент `start-claim`/`set-claim-list`).

**Фикс:** требовать `checkSecretAuth`/`verifyAdminAction` и для GET, либо отдавать публично только безопасное подмножество (например, `enabled`, без `txHashes`/`message`/`wallet.address`).

---

## LOW / INFO

### L1. `X-Powered-By: Next.js`
Раскрывает фреймворк. Отключается в `next.config.js`:
```js
module.exports = { poweredByHeader: false };
```

### L2. `CLAUDE.md` раскрывает топологию инфраструктуры
IP сервера, пути приложения, имя PM2-процесса, имена БД/пользователя — в сочетании с C1 (пароль) даёт атакующему готовую карту для атаки. После ротации пароля (C1) рекомендуется вынести подобную информацию из файла, который коммитится в публично доступный (или потенциально утекающий) репозиторий.

### L3. Хорошие практики, подтверждённые аудитом (для информации)
- Админ-эндпоинты (`/api/bot`, `/api/leaderboard/config`, `/api/admin/claim-list/preview`) защищены либо bearer-секретом с `timingSafeEqual` (защита от timing-атак), либо EIP-191 подписью кошелька с проверкой domain/origin/chainId/timestamp/nonce (replay-защита) — `frontend/src/app/api/admin/auth.ts`.
- Все SQL-запросы в `worker.ts`, `botState.ts` параметризованы (`$1, $2...`) — SQL-инъекций не найдено.
- `dangerouslySetInnerHTML` (layout.tsx) и `innerHTML` (BeachScene.tsx) используют только серверные/статические данные, не пользовательский ввод — XSS-риска не обнаружено.
- `.env`/`.env.local` корректно в `.gitignore` (кроме файла из C2, который не подпадает под маску).
- Live-сайт: `.env`, `.git/config`, `/api/admin`, `/admin` — недоступны (404), `/api/bot`, `/api/leaderboard/config` без auth не модифицируют состояние (POST требует авторизацию).

---

## Сводка по приоритетам

| # | Severity | Проблема | Действие |
|---|----------|----------|----------|
| C1 | CRITICAL | SSH root-пароль в `CLAUDE.md` (в git) | Сменить пароль, перейти на ключи, вычистить историю |
| C2 | CRITICAL | Прод-секреты в `frontend/doc_*.env.local` (в git) | Удалить из git+истории, ротировать все секреты |
| C3 | CRITICAL | Слабые секреты (ADMIN_SECRET/CRON_SECRET/DB pass) | Заменить на случайные 32+ байт |
| H1 | HIGH | Нет HSTS | Добавить заголовок в nginx |
| H2 | HIGH | CSP `unsafe-inline` для script-src | Перейти на nonce/hash CSP |
| M1 | MEDIUM | `/api/bot` GET без авторизации | Добавить auth или урезать ответ |
| L1 | LOW | `X-Powered-By: Next.js` | `poweredByHeader: false` |
| L2 | LOW | Топология сервера в `CLAUDE.md` | Вынести после ротации пароля |
