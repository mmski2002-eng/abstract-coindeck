import test from "node:test";
import assert from "node:assert/strict";
import { read, readJson } from "./helpers.mjs";

test("database/schema.sql содержит критичные таблицы и индексы", () => {
  const schema = read("database/schema.sql").toLowerCase();
  const requiredTables = [
    "oracle_history",
    "leaderboard_day_lineups",
    "oracle_scores_cache",
    "leaderboard_cache",
    "leaderboard_rows",
    "marketplace_listings",
    "market_snapshot",
    "rate_limit_counters",
    "admin_nonces",
    "job_state",
    "bot_state",
    "audit_log",
  ];

  for (const table of requiredTables) {
    assert.match(schema, new RegExp(`create table if not exists\\s+${table}\\b`), `Нет idempotent create table для ${table}`);
  }

  for (const index of [
    "leaderboard_cache_lookup_idx",
    "leaderboard_rows_addr_idx",
    "leaderboard_rows_league_idx",
    "marketplace_listings_player_tier_idx",
    "marketplace_listings_seller_idx",
    "job_state_type_idx",
  ]) {
    assert.match(schema, new RegExp(`create index if not exists\\s+${index}\\b`), `Нет индекса ${index}`);
  }
});

test("миграции БД идемпотентны и не содержат destructive SQL", () => {
  const migration = read("database/migrations/001_rate_limit_counters.sql").toLowerCase();
  assert.match(migration, /create table if not exists\s+rate_limit_counters\b/);
  assert.equal(/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/.test(migration), false, "Миграция содержит destructive SQL.");
});

test("assetUniverse задает ровно 50 уникальных игроков 0..49", () => {
  const source = read("frontend/src/config/assetUniverse.ts");
  const tickers = [...source.matchAll(/ticker:\s+"([^"]+)"/g)].map((m) => m[1]);
  const names = [...source.matchAll(/name:\s+"([^"]+)"/g)].map((m) => m[1]);

  assert.equal(tickers.length, 50, "Должно быть ровно 50 тикеров для playerId 0..49.");
  assert.equal(new Set(tickers).size, 50, "Тикеры asset universe должны быть уникальны.");
  assert.equal(names.length, 50, "Должно быть ровно 50 имен активов.");
});

test("project-addresses.json содержит активную сеть и валидные EVM адреса", () => {
  const book = readJson("frontend/src/config/project-addresses.json");
  assert.equal(typeof book.activeNetwork, "string");
  assert.equal(book.activeNetwork in book.networks, true, "activeNetwork отсутствует в networks.");

  const evmAddress = /^0x[a-fA-F0-9]{40}$/;
  for (const [network, cfg] of Object.entries(book.networks)) {
    assert.equal(typeof cfg.urls.restUrl, "string", `${network}: restUrl должен быть строкой.`);
    assert.match(cfg.urls.restUrl, /^https?:\/\//, `${network}: restUrl должен быть URL.`);
    for (const [key, value] of Object.entries(cfg.contracts)) {
      assert.match(value, evmAddress, `${network}.${key} должен быть EVM address.`);
    }
  }
});
