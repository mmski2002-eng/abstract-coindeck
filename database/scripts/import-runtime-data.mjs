import fs from "fs";
import path from "path";
import process from "process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRequire = createRequire(path.resolve(scriptDir, "../../frontend/package.json"));
const { Client } = frontendRequire("pg");

function resolveArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function ensureFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function ensureDir(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function readJsonIfExists(filePath, fallback = null) {
  if (!ensureFile(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonLines(filePath) {
  if (!ensureFile(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
}

function parseCacheKeyFromName(file) {
  const match = /^epoch-(\d+)-days-(\d+)-day-(\d+)-rb-(\d+)\.json$/.exec(file);
  if (!match) return null;
  return {
    cacheId: file.replace(/\.json$/, ""),
    epoch: Number(match[1]),
    totalDays: Number(match[2]),
    currentDay: Number(match[3]),
    roleBonusPct: Number(match[4]),
  };
}

function parseLineupKey(file) {
  const match = /^day-lineups-e(\d+)-d(\d+)\.json$/.exec(file);
  if (!match) return null;
  return { epoch: Number(match[1]), day: Number(match[2]) };
}

function parseOracleScoresKey(file) {
  const match = /^oracle-scores-e(\d+)-d(\d+)\.json$/.exec(file);
  if (!match) return null;
  return { epoch: Number(match[1]), day: Number(match[2]) };
}

function parseTimestamp(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const date = Date.parse(value);
    if (!Number.isNaN(date)) return date;
  }
  return Date.now();
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)]));
  }
  return value;
}

async function upsertOracleHistory(client, runtimeDir) {
  const filePath = path.join(runtimeDir, "bot-state", "oracle-history.json");
  const payload = readJsonIfExists(filePath, {});
  let count = 0;

  for (const [epoch, days] of Object.entries(payload ?? {})) {
    for (const [day, scores] of Object.entries(days ?? {})) {
      await client.query(
        `insert into oracle_history (epoch, day, scores, updated_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (epoch, day)
         do update set scores = excluded.scores, updated_at = now()`,
        [Number(epoch), Number(day), JSON.stringify(sanitizeValue(scores))],
      );
      count++;
    }
  }

  return count;
}

async function upsertSyncMeta(client, runtimeDir) {
  const filePath = path.join(runtimeDir, "bot-state", "oracle-sync-meta.json");
  const payload = readJsonIfExists(filePath, null);
  if (!payload) return 0;

  await client.query(
    `insert into sync_meta (key, value, updated_at)
     values ('oracle-sync-meta', $1::jsonb, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(sanitizeValue(payload))],
  );
  return 1;
}

async function upsertLeaderboardConfigs(client, runtimeDir) {
  const filePath = path.join(runtimeDir, "leaderboard-cache", "mults-config.json");
  const payload = readJsonIfExists(filePath, null);
  if (!payload) return 0;

  await client.query(
    `insert into app_config (namespace, key, value, updated_at)
     values ('leaderboard', 'config', $1::jsonb, now())
     on conflict (namespace, key)
     do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(sanitizeValue(payload))],
  );
  return 1;
}

async function upsertLineups(client, runtimeDir) {
  const dir = path.join(runtimeDir, "leaderboard-cache");
  if (!ensureDir(dir)) return 0;
  const files = fs.readdirSync(dir).filter((file) => /^day-lineups-e\d+-d\d+\.json$/.test(file));
  let count = 0;

  for (const file of files) {
    const key = parseLineupKey(file);
    if (!key) continue;
    const payload = readJsonIfExists(path.join(dir, file), {});
    const complete = Boolean(payload?.complete);
    const entries = payload && typeof payload === "object" && "entries" in payload
      ? payload.entries
      : payload;
    await client.query(
      `insert into leaderboard_day_lineups (epoch, day, complete, entries, updated_at)
       values ($1, $2, $3, $4::jsonb, $5)
       on conflict (epoch, day)
       do update set complete = excluded.complete, entries = excluded.entries, updated_at = excluded.updated_at`,
      [key.epoch, key.day, complete, JSON.stringify(sanitizeValue(entries ?? {})), Date.now()],
    );
    count++;
  }

  return count;
}

async function upsertOracleScoreCache(client, runtimeDir) {
  const dir = path.join(runtimeDir, "leaderboard-cache");
  if (!ensureDir(dir)) return 0;
  const files = fs.readdirSync(dir).filter((file) => /^oracle-scores-e\d+-d\d+\.json$/.test(file));
  let count = 0;

  for (const file of files) {
    const key = parseOracleScoresKey(file);
    if (!key) continue;
    const payload = readJsonIfExists(path.join(dir, file), {});
    await client.query(
      `insert into oracle_scores_cache (epoch, day, payload, updated_at)
       values ($1, $2, $3::jsonb, $4)
       on conflict (epoch, day)
       do update set payload = excluded.payload, updated_at = excluded.updated_at`,
      [key.epoch, key.day, JSON.stringify(sanitizeValue(payload)), Number(payload?.cachedAt ?? Date.now())],
    );
    count++;
  }

  return count;
}

async function upsertLeaderboardCache(client, runtimeDir) {
  const dir = path.join(runtimeDir, "leaderboard-cache");
  if (!ensureDir(dir)) return 0;
  const files = fs.readdirSync(dir).filter((file) => /^epoch-\d+-days-\d+-day-\d+-rb-\d+\.json$/.test(file));
  let count = 0;

  for (const file of files) {
    const key = parseCacheKeyFromName(file);
    if (!key) continue;
    const payload = readJsonIfExists(path.join(dir, file), {});
    await client.query(
      `insert into leaderboard_cache (cache_id, epoch, total_days, current_day, role_bonus_pct, payload, updated_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)
       on conflict (cache_id)
       do update set
         epoch = excluded.epoch,
         total_days = excluded.total_days,
         current_day = excluded.current_day,
         role_bonus_pct = excluded.role_bonus_pct,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      [
        key.cacheId,
        key.epoch,
        key.totalDays,
        key.currentDay,
        key.roleBonusPct,
        JSON.stringify(sanitizeValue(payload)),
        Number(payload?.updatedAt ?? Date.now()),
      ],
    );
    count++;
  }

  return count;
}

async function upsertFeedback(client, runtimeDir) {
  const filePath = path.join(runtimeDir, "feedback.jsonl");
  const entries = readJsonLines(filePath);
  let count = 0;

  for (const entry of entries) {
    await client.query(
      `insert into feedback (created_at, ip_hash, rating, name, wallet, text)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        entry.ts ?? new Date().toISOString(),
        String(entry.ip ?? "unknown"),
        entry.rating ?? null,
        entry.name ?? null,
        entry.wallet ?? null,
        String(entry.text ?? ""),
      ],
    );
    count++;
  }

  return count;
}

async function upsertFeedbackRateLimits(client, runtimeDir) {
  const filePath = path.join(runtimeDir, "feedback-rate.json");
  const payload = readJsonIfExists(filePath, {});
  let count = 0;

  for (const [bucket, hits] of Object.entries(payload ?? {})) {
    await client.query(
      `insert into rate_limits (bucket, hits, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (bucket)
       do update set hits = excluded.hits, updated_at = now()`,
      [`feedback:${bucket}`, JSON.stringify(sanitizeValue(hits))],
    );
    count++;
  }

  return count;
}

async function upsertAdminAuthState(client, runtimeDir) {
  const filePath = path.join(runtimeDir, "leaderboard-cache", "admin-auth-state.json");
  const payload = readJsonIfExists(filePath, null);
  if (!payload) return { nonces: 0, rateLimits: 0 };

  let nonceCount = 0;
  let rateLimitCount = 0;

  for (const nonce of payload.nonces ?? []) {
    await client.query(
      `insert into admin_nonces (nonce, action, domain, issued_at, expires_at, used_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (nonce)
       do update set
         action = excluded.action,
         domain = excluded.domain,
         issued_at = excluded.issued_at,
         expires_at = excluded.expires_at,
         used_at = excluded.used_at`,
      [
        nonce.nonce,
        nonce.action,
        nonce.domain,
        Number(nonce.issuedAt ?? Date.now()),
        Number(nonce.expiresAt ?? Date.now()),
        nonce.usedAt ?? null,
      ],
    );
    nonceCount++;
  }

  for (const [bucket, hits] of Object.entries(payload.rateLimits ?? {})) {
    await client.query(
      `insert into rate_limits (bucket, hits, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (bucket)
       do update set hits = excluded.hits, updated_at = now()`,
      [bucket, JSON.stringify(sanitizeValue(hits))],
    );
    rateLimitCount++;
  }

  return { nonces: nonceCount, rateLimits: rateLimitCount };
}

async function upsertMarketData(client, runtimeDir) {
  const dir = path.join(runtimeDir, "market-data-cache");
  if (!ensureDir(dir)) return { cache: 0, jobs: 0 };

  const files = fs.readdirSync(dir);
  let cacheCount = 0;
  let jobCount = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (!ensureFile(fullPath) || !file.endsWith(".json")) continue;
    const payload = readJsonIfExists(fullPath, {});
    const key = file.replace(/\.json$/, "");

    if (file.endsWith(".progress.json")) {
      const jobKey = key.replace(/\.progress$/, "");
      await client.query(
        `insert into job_state (job_key, job_type, state, payload, updated_at)
         values ($1, 'market-data', $2, $3::jsonb, now())
         on conflict (job_key)
         do update set state = excluded.state, payload = excluded.payload, updated_at = now()`,
        [jobKey, String(payload?.state ?? "running"), JSON.stringify(payload)],
      );
      jobCount++;
      continue;
    }

    await client.query(
      `insert into market_data_cache (cache_key, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (cache_key)
       do update set payload = excluded.payload, updated_at = now()`,
      [key, JSON.stringify(sanitizeValue(payload))],
    );
    cacheCount++;

    if (payload?.state) {
      await client.query(
        `insert into job_state (job_key, job_type, state, payload, updated_at)
         values ($1, 'market-data', $2, $3::jsonb, now())
         on conflict (job_key)
         do update set state = excluded.state, payload = excluded.payload, updated_at = now()`,
        [key, String(payload.state), JSON.stringify(sanitizeValue(payload))],
      );
      jobCount++;
    }
  }

  return { cache: cacheCount, jobs: jobCount };
}

async function upsertBotState(client, runtimeDir) {
  const botDir = path.join(runtimeDir, "bot-state");
  let configCount = 0;
  let stateCount = 0;

  const botConfig = readJsonIfExists(path.join(botDir, "bot-config.json"), null);
  if (botConfig) {
    await client.query(
      `insert into bot_config (key, value, updated_at)
       values ('default', $1::jsonb, now())
       on conflict (key)
       do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(sanitizeValue(botConfig))],
    );
    configCount++;
  }

  const botState = readJsonIfExists(path.join(botDir, "bot-state.json"), null);
  if (botState) {
    await client.query(
      `insert into bot_state (key, value, updated_at)
       values ('default', $1::jsonb, now())
       on conflict (key)
       do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(sanitizeValue(botState))],
    );
    stateCount++;
  }

  return { config: configCount, state: stateCount };
}

async function upsertAuditLogs(client, runtimeDir) {
  const adminEntries = readJsonLines(path.join(runtimeDir, "leaderboard-cache", "admin-audit.log"));
  const botEntries = readJsonLines(path.join(runtimeDir, "bot-state", "bot-audit.log"));
  let count = 0;

  for (const entry of adminEntries) {
    await client.query(
      "insert into audit_log (scope, payload, created_at) values ('admin', $1::jsonb, $2)",
      [JSON.stringify(sanitizeValue(entry)), entry.at ?? new Date().toISOString()],
    );
    count++;
  }

  for (const entry of botEntries) {
    await client.query(
      "insert into audit_log (scope, payload, created_at) values ('bot', $1::jsonb, $2)",
      [JSON.stringify(sanitizeValue(entry)), entry.ts ?? new Date().toISOString()],
    );
    count++;
  }

  return count;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const frontendDir = resolveArg("frontend-dir", path.resolve(process.cwd(), "frontend"));
  const runtimeDir = resolveArg("runtime-dir", frontendDir);

  console.log(`[import] frontend dir: ${frontendDir}`);
  console.log(`[import] runtime dir:  ${runtimeDir}`);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");

    const oracleHistory = await upsertOracleHistory(client, runtimeDir);
    const syncMeta = await upsertSyncMeta(client, runtimeDir);
    const leaderboardConfig = await upsertLeaderboardConfigs(client, runtimeDir);
    const lineups = await upsertLineups(client, runtimeDir);
    const oracleScores = await upsertOracleScoreCache(client, runtimeDir);
    const leaderboardCache = await upsertLeaderboardCache(client, runtimeDir);
    const feedback = await upsertFeedback(client, runtimeDir);
    const feedbackRates = await upsertFeedbackRateLimits(client, runtimeDir);
    const adminAuth = await upsertAdminAuthState(client, runtimeDir);
    const marketData = await upsertMarketData(client, runtimeDir);
    const botState = await upsertBotState(client, runtimeDir);
    const auditLog = await upsertAuditLogs(client, runtimeDir);

    await client.query("commit");

    console.log("[import] completed");
    console.log(JSON.stringify({
      oracleHistory,
      syncMeta,
      leaderboardConfig,
      lineups,
      oracleScores,
      leaderboardCache,
      feedback,
      feedbackRates,
      adminNonces: adminAuth.nonces,
      adminRateLimits: adminAuth.rateLimits,
      marketCache: marketData.cache,
      marketJobs: marketData.jobs,
      botConfig: botState.config,
      botState: botState.state,
      auditLog,
    }, null, 2));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[import] failed");
  console.error(error);
  process.exit(1);
});
