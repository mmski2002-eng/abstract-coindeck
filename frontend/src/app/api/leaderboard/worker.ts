import { readHistory, saveDay } from "../oracle-history/lib";
import {
  getBestCached as loadBestCached,
  getCached as loadCached,
  getTierMults,
  loadDayLineupCache,
  loadOracleCache,
  normalizeCacheKey,
  saveDayLineupCache,
  saveLeaderboardCache,
  saveLeaderboardRows,
  savePickCounts,
  saveOracleCache,
  type CacheKey,
  type DayLineupEntry,
  type LeaderboardCache,
  type RankRow,
} from "@/lib/storage/leaderboard";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";
import { ASSET_ROLE_IDS, ASSET_SET_VERSION } from "@/config/assetUniverse";
import { readMarketJobState } from "@/lib/storage/marketData";
import { saveMarketSnapshot, readMarketSnapshot } from "@/lib/storage/marketSnapshot";
import { formatUtcDateKey } from "@/lib/oracleWindow";
import { dbQuery } from "@/lib/db/client";

const runtimeAddresses = getRuntimeProjectAddresses();
const MODULE = runtimeAddresses.moduleAddress;
const REST = runtimeAddresses.restUrl;
const STALE_MS = Number(process.env.LEADERBOARD_REFRESH_INTERVAL_MS ?? String(60 * 60 * 1000));
const ORACLE_STALE_MS = 4 * 60 * 60 * 1000;
const LEAGUE_ALGORITHM_VERSION = 2;
const LINEUP_CONCURRENCY = 20;
const LOCK_STALE_MINUTES = 30;

const PLAYER_ROLE_IDS = ASSET_ROLE_IDS;

async function tryAcquireLock(jobId: string): Promise<boolean> {
  const key = `leaderboard-lock:${jobId}`;
  const result = await dbQuery(
    `insert into job_state (job_key, job_type, state, payload, updated_at)
     values ($1, 'leaderboard_lock', 'running', '{}'::jsonb, now())
     on conflict (job_key) do update
       set job_type = 'leaderboard_lock', state = 'running', updated_at = now()
       where job_state.updated_at < now() - ($2 || ' minutes')::interval
     returning job_key`,
    [key, String(LOCK_STALE_MINUTES)],
  );
  return (result.rowCount ?? 0) > 0;
}

async function releaseLock(jobId: string): Promise<void> {
  await dbQuery(
    `delete from job_state where job_key = $1 and job_type = 'leaderboard_lock'`,
    [`leaderboard-lock:${jobId}`],
  ).catch(() => {});
}

function cacheId(key: CacheKey): string {
  return `epoch-${key.epoch}-days-${key.totalDays}-day-${key.currentDay}-rb-${key.roleBonusPct}`;
}

function parseU8Vec(raw: unknown): number[] {
  if (Array.isArray(raw)) return (raw as (string | number)[]).map(Number);
  if (typeof raw === "string") {
    const h = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (!h) return [];
    const out: number[] = [];
    for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
    return out;
  }
  return [];
}

function sanitizeNickname(raw: string): string {
  return raw.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function decodeNickname(raw: unknown): string {
  if (typeof raw !== "string") return "";
  if (!raw) return "";

  if (!raw.startsWith("0x")) return sanitizeNickname(raw);

  const hex = raw.slice(2);
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return sanitizeNickname(raw);
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return sanitizeNickname(new TextDecoder("utf-8").decode(bytes));
}

async function heroScore(playerId: number, tier: number, slotIdx: number, dayScores: number[], roleBonusPct: number): Promise<number> {
  const base = dayScores[playerId] ?? 0;
  const mult = (await getTierMults())[tier] ?? 100;
  const roleBonus = PLAYER_ROLE_IDS[playerId] === slotIdx ? (100 + roleBonusPct) : 100;
  return Math.floor(base * mult * roleBonus / 10000);
}

async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function viewFn(fn: string, args: string[], signal: AbortSignal): Promise<unknown[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${REST}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: `${MODULE}::${fn}`, type_arguments: [], arguments: args }),
        signal,
      });
      if (response.ok) {
        const json = await response.json() as unknown;
        if (Array.isArray(json)) return json;
        if (json && typeof json === "object" && "value" in json && Array.isArray((json as { value: unknown }).value)) {
          return (json as { value: unknown[] }).value;
        }
        return null;
      }
      if (response.status === 404) return null;
    } catch {
      if (signal.aborted) return null;
    }
    if (attempt < 2) await new Promise<void>((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  return null;
}

async function getLiveState(signal: AbortSignal): Promise<{ epoch: number; closedDay: number; startTimestamp: number; baseEpoch: number } | null> {
  const state = await viewFn("tournament::get_state", [], signal);
  if (!state) return null;
  const epoch = Number(state[1] ?? 0);
  const currentDay = Number(state[2] ?? 0);
  const isRest = state[3] === true || state[3] === "true";
  const startTimestamp = Number(state[4] ?? 0);
  if (!Number.isInteger(epoch) || epoch < 1) return null;
  const closedDay = isRest ? 6 : Math.max(0, Math.min(6, currentDay - 1));
  const weeksElapsed = startTimestamp > 0 ? Math.floor((Math.floor(Date.now() / 1000) - startTimestamp) / (7 * 86400)) : 0;
  const baseEpoch = Math.max(1, epoch - weeksElapsed);
  return { epoch, closedDay, startTimestamp, baseEpoch };
}

const INDEXER_URL = process.env.INDEXER_URL ?? "";
const INDEXER_PAGE_SIZE = 1000;
const LINEUP_SUBMITTED_CREATION_NUMBER = "4";
const NEW_ADDR_BULK_THRESHOLD = 200;

async function fetchAddressesFromIndexer(
  epoch: number,
  day: number,
  signal: AbortSignal,
): Promise<Set<string> | null> {
  if (!INDEXER_URL) return null;
  const addresses = new Set<string>();
  let offset = 0;

  while (!signal.aborted) {
    let resp: Response;
    try {
      resp = await fetch(INDEXER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query($moduleAddr: String!, $filter: jsonb!, $limit: Int!, $offset: Int!) {
            events(
              where: {
                account_address: { _eq: $moduleAddr }
                creation_number: { _eq: "${LINEUP_SUBMITTED_CREATION_NUMBER}" }
                data: { _contains: $filter }
              }
              order_by: { sequence_number: asc }
              limit: $limit
              offset: $offset
            ) { data }
          }`,
          variables: {
            moduleAddr: MODULE,
            filter: { epoch: String(epoch), day: String(day) },
            limit: INDEXER_PAGE_SIZE,
            offset,
          },
        }),
        signal,
      });
    } catch {
      return null;
    }

    if (!resp.ok) return null;
    const json = await resp.json() as { data?: { events?: Array<{ data: Record<string, unknown> }> } };
    const events = json.data?.events;
    if (!Array.isArray(events)) return null;

    for (const evt of events) {
      const addr = evt.data?.addr;
      if (typeof addr === "string" && addr) addresses.add(addr);
    }

    if (events.length < INDEXER_PAGE_SIZE) break;
    offset += INDEXER_PAGE_SIZE;
  }

  return signal.aborted ? null : addresses;
}

async function fetchLineupSlotsForAddresses(
  epoch: number,
  day: number,
  addrs: string[],
  signal: AbortSignal,
): Promise<Map<string, DayLineupEntry>> {
  const result = new Map<string, DayLineupEntry>();
  await withConcurrency(addrs, LINEUP_CONCURRENCY, async (addr) => {
    const response = await viewFn(
      "tournament::get_lineup_slots_epoch",
      [addr, String(day), String(epoch)],
      signal,
    );
    if (!response) return;
    const pids = parseU8Vec(response[0]);
    const tiers = parseU8Vec(response[1]);
    if (pids.length > 0) result.set(addr, { pids, tiers });
  });
  return result;
}

const BULK_PAGE_SIZE = 200;

async function fetchDayLineupsBulk(
  epoch: number,
  day: number,
  signal: AbortSignal,
): Promise<{ data: Map<string, DayLineupEntry>; complete: boolean } | null> {
  const result = new Map<string, DayLineupEntry>();
  let offset = 0;
  let firstCall = true;

  while (true) {
    const response = await viewFn(
      "tournament::get_day_lineups_paginated",
      [String(day), String(epoch), String(offset), String(BULK_PAGE_SIZE)],
      signal,
    );
    if (!response) {
      if (firstCall) return null;
      return { data: result, complete: false };
    }
    firstCall = false;

    const [rawAddrs, rawPids, rawTiers, rawTotal] = response as [string[], unknown, unknown, string];
    const total = Number(rawTotal);
    const pids = parseU8Vec(rawPids);
    const tiers = parseU8Vec(rawTiers);

    (rawAddrs ?? []).forEach((addr: string, i: number) => {
      result.set(addr, {
        pids: pids.slice(i * 5, i * 5 + 5),
        tiers: tiers.slice(i * 5, i * 5 + 5),
      });
    });

    offset += BULK_PAGE_SIZE;
    if (offset >= total) break;
  }

  return { data: result, complete: true };
}

export async function getCached(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): Promise<LeaderboardCache | null> {
  return loadCached(epoch, totalDays, currentDay, roleBonusPct, LEAGUE_ALGORITHM_VERSION);
}

export async function getBestCached(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): Promise<{ cache: LeaderboardCache | null; exact: boolean }> {
  return loadBestCached(epoch, totalDays, currentDay, roleBonusPct, LEAGUE_ALGORITHM_VERSION);
}

export function isStale(cache: LeaderboardCache | null): boolean {
  if (!cache) return true;
  return Date.now() - cache.updatedAt > STALE_MS;
}

export async function isRunning(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): Promise<boolean> {
  try {
    const jobId = cacheId(normalizeCacheKey(epoch, totalDays, currentDay, roleBonusPct));
    const result = await dbQuery<{ exists: boolean }>(
      `select exists(
         select 1 from job_state
         where job_key = $1 and job_type = 'leaderboard_lock'
           and state = 'running'
           and updated_at > now() - ($2 || ' minutes')::interval
       ) as exists`,
      [`leaderboard-lock:${jobId}`, String(LOCK_STALE_MINUTES)],
    );
    return result.rows[0]?.exists === true;
  } catch {
    return false;
  }
}

export async function runJob(epoch: number, totalDays: number, currentDay: number, roleBonusPct = 15): Promise<void> {
  const key = normalizeCacheKey(epoch, totalDays, currentDay, roleBonusPct);
  const jobId = cacheId(key);
  if (!await tryAcquireLock(jobId)) return;

  const abort = new AbortController();
  const timeoutMs = Number(process.env.LEADERBOARD_TIMEOUT_MS ?? "600000");
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const snapshotStartedAt = Date.now();
    const scoreDays = Array.from({ length: Math.min(key.currentDay, key.totalDays) }, (_, i) => i + 1);
    const scoreCache = new Map<number, number[]>();
    const finalizedDays = new Set<number>();
    const history = await readHistory();
    const liveState = await getLiveState(abort.signal);

    await Promise.all(scoreDays.map(async (day) => {
      const historical = history[key.epoch]?.[day];
      if (Array.isArray(historical) && historical.length === 50) {
        scoreCache.set(day, historical);
        finalizedDays.add(day);
        await saveOracleCache(key.epoch, day, { scores: historical, finalized: true, cachedAt: Date.now() });
        if (liveState && liveState.startTimestamp > 0) {
          const existing = await readMarketSnapshot(key.epoch, day).catch(() => null);
          if (!existing) {
            const dayStartTs = liveState.startTimestamp + (key.epoch - liveState.baseEpoch) * 7 * 86400 + (day - 1) * 86400;
            const dateKey = formatUtcDateKey(dayStartTs);
            const jobKey = `${dateKey}.${dayStartTs}-${dayStartTs + 86400}`;
            const marketJob = await readMarketJobState(jobKey);
            if (marketJob.state === "done" && marketJob.data && marketJob.data.length > 0) {
              await saveMarketSnapshot(key.epoch, day, marketJob.data).catch(() => {});
            }
          }
        }
        return;
      }

      const existing = await loadOracleCache(key.epoch, day);
      if (existing?.finalized) {
        scoreCache.set(day, existing.scores);
        finalizedDays.add(day);
        return;
      }
      if (existing && day < key.currentDay && Date.now() - existing.cachedAt < ORACLE_STALE_MS) {
        scoreCache.set(day, existing.scores);
        return;
      }
      if (liveState?.epoch !== key.epoch || day > liveState.closedDay) {
        if (existing) scoreCache.set(day, existing.scores);
        return;
      }

      const response = await viewFn("oracle::get_day_scores", [String(day)], abort.signal);
      if (!response) {
        if (existing) scoreCache.set(day, existing.scores);
        return;
      }

      const [pidRaw, ptsRaw, rawFinalized] = response as [unknown, string[], unknown];
      const pids = parseU8Vec(pidRaw);
      const scores = new Array(50).fill(0) as number[];
      pids.forEach((pid, i) => {
        if (pid < 50) scores[pid] = Number(ptsRaw[i] ?? 0);
      });
      scoreCache.set(day, scores);
      const finalized = rawFinalized === true || rawFinalized === "true";
      if (finalized) finalizedDays.add(day);
      await saveOracleCache(key.epoch, day, { scores, finalized, cachedAt: Date.now() });
      if (finalized && scores.length === 50) {
        await saveDay(key.epoch, day, scores, "chain");
        if (liveState && liveState.startTimestamp > 0) {
          const dayStartTs = liveState.startTimestamp + (key.epoch - liveState.baseEpoch) * 7 * 86400 + (day - 1) * 86400;
          const dateKey = formatUtcDateKey(dayStartTs);
          const jobKey = `${dateKey}.${dayStartTs}-${dayStartTs + 86400}`;
          const marketJob = await readMarketJobState(jobKey);
          if (marketJob.state === "done" && marketJob.data && marketJob.data.length > 0) {
            await saveMarketSnapshot(key.epoch, day, marketJob.data).catch(() => {});
          }
        }
      }
    }));

    const lineupCachesByDay = new Map<number, Map<string, DayLineupEntry>>();
    let bulkAvailable = true;
    const isLiveEpoch = liveState?.epoch === key.epoch;

    for (const day of scoreDays) {
      const { map: cached, complete } = await loadDayLineupCache(key.epoch, day);
      const needsFetch = isLiveEpoch || !complete;

      if (needsFetch) {
        const indexerAddrs = await fetchAddressesFromIndexer(key.epoch, day, abort.signal);

        if (indexerAddrs !== null) {
          const newAddrs = [...indexerAddrs].filter((a) => !cached.has(a));

          if (newAddrs.length > NEW_ADDR_BULK_THRESHOLD && bulkAvailable) {
            const bulkResult = await fetchDayLineupsBulk(key.epoch, day, abort.signal);
            if (bulkResult === null) {
              bulkAvailable = false;
            } else {
              const { data: fresh, complete: fetchComplete } = bulkResult;
              for (const [addr, entry] of fresh) cached.set(addr, entry);
              await saveDayLineupCache(key.epoch, day, cached, fetchComplete);
            }
          } else {
            const fresh = await fetchLineupSlotsForAddresses(key.epoch, day, newAddrs, abort.signal);
            for (const [addr, entry] of fresh) cached.set(addr, entry);
            if (isLiveEpoch) {
              for (const addr of [...cached.keys()]) {
                if (!indexerAddrs.has(addr)) cached.delete(addr);
              }
            }
            await saveDayLineupCache(key.epoch, day, cached, !isLiveEpoch);
          }
        } else if (bulkAvailable) {
          const bulkResult = await fetchDayLineupsBulk(key.epoch, day, abort.signal);
          if (bulkResult === null) {
            bulkAvailable = false;
          } else {
            const { data: fresh, complete: fetchComplete } = bulkResult;
            for (const [addr, entry] of fresh) cached.set(addr, entry);
            await saveDayLineupCache(key.epoch, day, cached, fetchComplete);
          }
        }
      }

      lineupCachesByDay.set(day, cached);
    }

    await Promise.all(scoreDays.map(async (day) => {
      const dayMap = lineupCachesByDay.get(day);
      if (!dayMap) return;
      const counts = new Array(50).fill(0) as number[];
      for (const entry of dayMap.values()) {
        for (const pid of entry.pids) {
          if (pid >= 0 && pid < 50) counts[pid]++;
        }
      }
      await savePickCounts(key.epoch, day, counts);
    }));

    const allAddrs = new Set<string>();
    for (const dayMap of lineupCachesByDay.values()) {
      for (const addr of dayMap.keys()) allAddrs.add(addr);
    }

    const allOracleFinalized = scoreDays.length > 0 && scoreDays.every((day) => finalizedDays.has(day));

    if (allAddrs.size === 0) {
      await saveLeaderboardCache(key, [], LEAGUE_ALGORITHM_VERSION, allOracleFinalized, snapshotStartedAt, ASSET_SET_VERSION);
      await saveLeaderboardRows(`epoch-${key.epoch}-days-${key.totalDays}-day-${key.currentDay}-rb-${key.roleBonusPct}`, []);
      return;
    }

    const rows = await withConcurrency([...allAddrs], LINEUP_CONCURRENCY, async (addr) => {
      let totalScore = 0;
      let leagueSum = 0;
      let participatedDays = 0;
      let latestDay = -1;
      let prevDayTiers: number[] | undefined;
      let prevDayPids: number[] | undefined;

      for (const day of scoreDays) {
        const entry = lineupCachesByDay.get(day)?.get(addr);
        if (!entry || entry.pids.length === 0) continue;

        const { pids, tiers } = entry;
        participatedDays++;

        if (day >= latestDay) {
          latestDay = day;
          prevDayTiers = tiers.slice(0, 5);
          prevDayPids = pids.slice(0, 5);
        }

        let rare = 0;
        let epic = 0;
        let legendary = 0;
        tiers.forEach((tier) => {
          if (tier === 1) rare++;
          if (tier === 2) epic++;
          if (tier === 3) legendary++;
        });
        leagueSum += (legendary > 0 || epic >= 5) ? 2 : (epic > 0 || rare >= 5) ? 1 : 0;

        const oracle = scoreCache.get(day);
        if (!oracle) continue;
        for (let i = 0; i < pids.length; i++) {
          totalScore += await heroScore(pids[i], tiers[i] ?? 0, i, oracle, key.roleBonusPct);
        }
      }

      const leagueAvg = participatedDays > 0 ? leagueSum / participatedDays : 0;
      const finalLeague = leagueAvg >= 1.5 ? 2 : leagueAvg >= 0.5 ? 1 : 0;

      return { addr, score: totalScore, league: finalLeague, days: participatedDays, prevDayTiers, prevDayPids };
    });

    const scored = rows.filter((row) => row.days > 0).sort((a, b) => b.score - a.score);

    const nicknames = await withConcurrency(scored, LINEUP_CONCURRENCY, async (row) => {
      try {
        const response = await viewFn("fantasy_league::get_nickname", [row.addr], abort.signal);
        return decodeNickname(response?.[0]);
      } catch {
        return "";
      }
    });

    const rowsWithNick: RankRow[] = scored.map((row, index) => ({
      ...row,
      nickname: nicknames[index] || undefined,
    }));

    await saveLeaderboardCache(key, rowsWithNick, LEAGUE_ALGORITHM_VERSION, allOracleFinalized, snapshotStartedAt, ASSET_SET_VERSION);
    await saveLeaderboardRows(`epoch-${key.epoch}-days-${key.totalDays}-day-${key.currentDay}-rb-${key.roleBonusPct}`, rowsWithNick);
  } finally {
    clearTimeout(timer);
    await releaseLock(jobId);
  }
}
