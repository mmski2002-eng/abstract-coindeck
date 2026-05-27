import { dbQuery } from "@/lib/db/client";
import { readLeaderboardConfig } from "@/lib/storage/leaderboardConfig";

export type DayLineupEntry = { pids: number[]; tiers: number[] };

type LineupDayFile = {
  complete: boolean;
  entries: Record<string, DayLineupEntry>;
};

export type OracleScoreFile = {
  scores: number[];
  finalized: boolean;
  cachedAt: number;
};

export type CacheKey = {
  epoch: number;
  totalDays: number;
  currentDay: number;
  roleBonusPct: number;
};

export type RankRow = {
  addr: string;
  score: number;
  league: number;
  days: number;
  nickname?: string;
  prevDayTiers?: number[];
  prevDayPids?: number[];
};

export type LeaderboardCache = {
  epoch: number;
  totalDays: number;
  currentDay: number;
  roleBonusPct: number;
  leagueAlgorithmVersion: number;
  assetSetVersion: number;
  updatedAt: number;
  snapshotStartedAt: number;
  allOracleFinalized: boolean;
  rows: RankRow[];
};

export type RouteState = {
  queue: Array<{ epoch: number; totalDays: number; currentDay: number; roleBonusPct: number }>;
};

function cacheId(key: CacheKey): string {
  return `epoch-${key.epoch}-days-${key.totalDays}-day-${key.currentDay}-rb-${key.roleBonusPct}`;
}

export function normalizeCacheKey(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): CacheKey {
  return {
    epoch,
    totalDays,
    currentDay: Math.min(currentDay, totalDays),
    roleBonusPct,
  };
}

export function parseCacheKeyFromName(file: string): CacheKey | null {
  const match = /^epoch-(\d+)-days-(\d+)-day-(\d+)-rb-(\d+)\.json$/.exec(file);
  if (!match) return null;
  return normalizeCacheKey(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
}

function isCacheKey(value: Partial<CacheKey>): value is CacheKey {
  return Number.isInteger(value.epoch) &&
    Number.isInteger(value.totalDays) &&
    Number.isInteger(value.currentDay) &&
    Number.isInteger(value.roleBonusPct) &&
    (value.epoch ?? 0) >= 1 &&
    (value.totalDays ?? 0) >= 1 &&
    (value.currentDay ?? 0) >= 1 &&
    (value.currentDay ?? 0) <= (value.totalDays ?? 0) &&
    (value.roleBonusPct ?? -1) >= 0;
}

function getCacheKeyFromPayload(cache: Partial<LeaderboardCache>, leagueAlgorithmVersion: number): CacheKey | null {
  if (cache.leagueAlgorithmVersion !== leagueAlgorithmVersion) return null;
  if (!isCacheKey(cache)) return null;
  return normalizeCacheKey(cache.epoch, cache.totalDays, cache.currentDay, cache.roleBonusPct);
}

export async function readRoleBonusPct(): Promise<number> {
  const config = await readLeaderboardConfig();
  return Number.isFinite(config.roleBonusPct) ? Number(config.roleBonusPct) : 15;
}

export async function getTierMults(): Promise<number[]> {
  const config = await readLeaderboardConfig();
  return config.tierMults;
}

export async function areAllLineupsComplete(epoch: number, totalDays: number): Promise<boolean> {
  const result = await dbQuery<{ day: number; complete: boolean }>(
    `select day, complete from leaderboard_day_lineups where epoch = $1 and day between 1 and $2`,
    [epoch, totalDays],
  );
  if (result.rows.length < totalDays) return false;
  return result.rows.every((row) => row.complete);
}

export async function loadDayLineupCache(epoch: number, day: number): Promise<{ map: Map<string, DayLineupEntry>; complete: boolean }> {
  const result = await dbQuery<{ complete: boolean; entries: Record<string, DayLineupEntry> }>(
    "select complete, entries from leaderboard_day_lineups where epoch = $1 and day = $2 limit 1",
    [epoch, day],
  );
  const row = result.rows[0];
  return {
    map: new Map(Object.entries(row?.entries ?? {})),
    complete: Boolean(row?.complete),
  };
}

export async function saveDayLineupCache(epoch: number, day: number, map: Map<string, DayLineupEntry>, complete: boolean): Promise<void> {
  if (map.size === 0 && !complete) return;
  const payload: LineupDayFile = { complete, entries: Object.fromEntries(map) };

  await dbQuery(
    `insert into leaderboard_day_lineups (epoch, day, complete, entries, updated_at)
     values ($1, $2, $3, $4::jsonb, $5)
     on conflict (epoch, day)
     do update set complete = excluded.complete, entries = excluded.entries, updated_at = excluded.updated_at`,
    [epoch, day, complete, JSON.stringify(payload.entries), Date.now()],
  );
}

export async function loadOracleCache(epoch: number, day: number): Promise<OracleScoreFile | null> {
  const result = await dbQuery<{ payload: OracleScoreFile }>(
    "select payload from oracle_scores_cache where epoch = $1 and day = $2 limit 1",
    [epoch, day],
  );
  return result.rows[0]?.payload ?? null;
}

export async function saveOracleCache(epoch: number, day: number, data: OracleScoreFile): Promise<void> {
  await dbQuery(
    `insert into oracle_scores_cache (epoch, day, payload, updated_at)
     values ($1, $2, $3::jsonb, $4)
     on conflict (epoch, day)
     do update set payload = excluded.payload, updated_at = excluded.updated_at`,
    [epoch, day, JSON.stringify(data), data.cachedAt],
  );
}

export async function getCached(
  epoch: number,
  totalDays: number,
  currentDay: number,
  roleBonusPct: number,
  leagueAlgorithmVersion: number,
): Promise<LeaderboardCache | null> {
  const key = normalizeCacheKey(epoch, totalDays, currentDay, roleBonusPct);
  const result = await dbQuery<{ payload: LeaderboardCache }>(
    `select payload
     from leaderboard_cache
     where cache_id = $1
     limit 1`,
    [cacheId(key)],
  );
  const payload = result.rows[0]?.payload;
  if (!payload || !Array.isArray(payload.rows)) return null;
  return getCacheKeyFromPayload(payload, leagueAlgorithmVersion) ? payload : null;
}

export async function hasOracleDataDrift(
  epoch: number,
  currentDay: number,
  cacheUpdatedAt: number,
): Promise<boolean> {
  const dayLimit = Math.max(1, Math.min(currentDay, 6));
  const newerHistory = await dbQuery<{ newer: boolean }>(
    `select exists(
       select 1
       from oracle_history
       where epoch = $1
         and day between 1 and $2
         and (extract(epoch from updated_at) * 1000)::bigint > $3
     ) as newer`,
    [epoch, dayLimit, cacheUpdatedAt],
  );
  if (newerHistory.rows[0]?.newer === true) return true;

  const suspiciousZeroCache = await dbQuery<{ drift: boolean }>(
    `select exists(
       select 1
       from oracle_scores_cache osc
       join oracle_history oh
         on oh.epoch = osc.epoch and oh.day = osc.day
       where osc.epoch = $1
         and osc.day between 1 and $2
         and coalesce((
           select sum(value::int)
           from jsonb_array_elements_text(osc.payload->'scores') as value
         ), 0) = 0
         and coalesce((
           select sum(value::int)
           from jsonb_array_elements_text(oh.scores) as value
         ), 0) > 0
     ) as drift`,
    [epoch, dayLimit],
  );
  return suspiciousZeroCache.rows[0]?.drift === true;
}

export async function getBestCached(
  epoch: number,
  totalDays: number,
  currentDay: number,
  roleBonusPct: number,
  leagueAlgorithmVersion: number,
): Promise<{ cache: LeaderboardCache | null; exact: boolean }> {
  const exact = await getCached(epoch, totalDays, currentDay, roleBonusPct, leagueAlgorithmVersion);
  if (exact) return { cache: exact, exact: true };

  const requested = normalizeCacheKey(epoch, totalDays, currentDay, roleBonusPct);
  const result = await dbQuery<{ payload: LeaderboardCache }>(
    `select payload
     from leaderboard_cache
     where epoch = $1 and total_days = $2 and role_bonus_pct = $3
     order by current_day desc, updated_at desc`,
    [requested.epoch, requested.totalDays, requested.roleBonusPct],
  );
  const matches = result.rows
    .map((row) => row.payload)
    .filter((payload) => Array.isArray(payload?.rows) && Boolean(getCacheKeyFromPayload(payload, leagueAlgorithmVersion)));
  if (matches.length === 0) return { cache: null, exact: false };
  const preferred = matches
    .filter((cache) => cache.currentDay <= requested.currentDay)
    .sort((a, b) => b.currentDay - a.currentDay || b.updatedAt - a.updatedAt)[0]
    ?? matches.sort((a, b) => b.currentDay - a.currentDay || b.updatedAt - a.updatedAt)[0]
    ?? null;
  return { cache: preferred, exact: false };
}

export async function savePickCounts(
  epoch: number,
  day: number,
  counts: number[],
): Promise<void> {
  await dbQuery(`delete from lineup_pick_counts where epoch = $1 and day = $2`, [epoch, day]);
  const entries = counts
    .map((picks, pid) => ({ pid, picks }))
    .filter((e) => e.picks > 0);
  if (entries.length === 0) return;
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let p = 1;
  for (const { pid, picks } of entries) {
    placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
    values.push(epoch, day, pid, picks);
  }
  await dbQuery(
    `insert into lineup_pick_counts (epoch, day, pid, picks) values ${placeholders.join(", ")}`,
    values,
  );
}

export async function getPickCounts(epoch: number, day: number): Promise<number[] | null> {
  const result = await dbQuery<{ pid: number; picks: number }>(
    `select pid, picks from lineup_pick_counts where epoch = $1 and day = $2`,
    [epoch, day],
  );
  if (result.rows.length === 0) return null;
  const counts = new Array(50).fill(0) as number[];
  for (const row of result.rows) {
    if (row.pid >= 0 && row.pid < 50) counts[row.pid] = row.picks;
  }
  return counts;
}

export async function saveLeaderboardRows(id: string, rows: RankRow[]): Promise<void> {
  await dbQuery(`delete from leaderboard_rows where cache_id = $1`, [id]);
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    chunk.forEach((row, j) => {
      placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::int[], $${p++}::int[])`);
      values.push(
        id,
        i + j + 1,
        row.addr,
        row.score,
        row.league,
        row.days,
        row.nickname ?? null,
        (row.prevDayTiers?.length ?? 0) > 0 ? row.prevDayTiers : null,
        (row.prevDayPids?.length ?? 0) > 0 ? row.prevDayPids : null,
      );
    });
    await dbQuery(
      `insert into leaderboard_rows (cache_id, rank, addr, score, league, days, nickname, prev_day_tiers, prev_day_pids)
       values ${placeholders.join(", ")}`,
      values,
    );
  }
}

type LeaderboardRowDb = {
  rank: number;
  addr: string;
  score: number;
  league: number;
  days: number;
  nickname: string | null;
  prev_day_tiers: number[] | null;
  prev_day_pids: number[] | null;
};

function dbRowToRankRow(r: LeaderboardRowDb): RankRow & { rank: number } {
  return {
    rank: r.rank,
    addr: r.addr,
    score: Number(r.score),
    league: r.league,
    days: r.days,
    ...(r.nickname != null ? { nickname: r.nickname } : {}),
    ...(r.prev_day_tiers != null ? { prevDayTiers: r.prev_day_tiers } : {}),
    ...(r.prev_day_pids != null ? { prevDayPids: r.prev_day_pids } : {}),
  };
}

export async function getLeaderboardPage(
  key: CacheKey,
  opts: { offset: number; limit: number; league?: number; addr?: string },
): Promise<{ rows: Array<RankRow & { rank: number }>; total: number }> {
  const id = cacheId(normalizeCacheKey(key.epoch, key.totalDays, key.currentDay, key.roleBonusPct));

  if (opts.addr) {
    const result = await dbQuery<LeaderboardRowDb & { total: string }>(
      `select rank, addr, score, league, days, nickname, prev_day_tiers, prev_day_pids,
              count(*) over() as total
       from leaderboard_rows where cache_id = $1 and addr = $2 limit 1`,
      [id, opts.addr],
    );
    if (result.rows.length === 0) return { rows: [], total: 0 };
    return { rows: [dbRowToRankRow(result.rows[0])], total: Number(result.rows[0].total) };
  }

  const conditions: string[] = [`cache_id = $1`];
  const params: unknown[] = [id];
  let p = 2;
  if (opts.league !== undefined) {
    conditions.push(`league = $${p++}`);
    params.push(opts.league);
  }
  const where = conditions.join(" and ");

  const [countResult, rowsResult] = await Promise.all([
    dbQuery<{ count: string }>(`select count(*) as count from leaderboard_rows where ${where}`, params),
    dbQuery<LeaderboardRowDb>(
      `select rank, addr, score, league, days, nickname, prev_day_tiers, prev_day_pids
       from leaderboard_rows where ${where}
       order by rank limit $${p++} offset $${p++}`,
      [...params, opts.limit, opts.offset],
    ),
  ]);

  return {
    rows: rowsResult.rows.map(dbRowToRankRow),
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}

export async function saveLeaderboardCache(
  key: CacheKey,
  rows: RankRow[],
  leagueAlgorithmVersion: number,
  allOracleFinalized: boolean,
  snapshotStartedAt: number,
  assetSetVersion = 1,
): Promise<void> {
  const payload: LeaderboardCache = {
    epoch: key.epoch,
    totalDays: key.totalDays,
    currentDay: key.currentDay,
    roleBonusPct: key.roleBonusPct,
    leagueAlgorithmVersion,
    assetSetVersion,
    updatedAt: Date.now(),
    snapshotStartedAt,
    allOracleFinalized,
    rows,
  };

  await dbQuery(
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
    [cacheId(key), key.epoch, key.totalDays, key.currentDay, key.roleBonusPct, JSON.stringify(payload), payload.updatedAt],
  );
}

export async function listLeaderboardCaches(leagueAlgorithmVersion: number): Promise<LeaderboardCache[]> {
  const result = await dbQuery<{ payload: LeaderboardCache }>("select payload from leaderboard_cache");
  return result.rows
    .map((row) => row.payload)
    .filter((payload) => Array.isArray(payload?.rows) && Boolean(getCacheKeyFromPayload(payload, leagueAlgorithmVersion)));
}

export async function readRouteState(): Promise<RouteState> {
  const result = await dbQuery<{ payload: RouteState }>(
    "select payload from job_state where job_key = 'leaderboard-route-queue' and job_type = 'leaderboard-route' limit 1",
  );
  const payload = result.rows[0]?.payload;
  return { queue: Array.isArray(payload?.queue) ? payload.queue : [] };
}

export async function writeRouteState(state: RouteState): Promise<void> {
  await dbQuery(
    `insert into job_state (job_key, job_type, state, payload, updated_at)
     values ('leaderboard-route-queue', 'leaderboard-route', 'queued', $1::jsonb, now())
     on conflict (job_key)
     do update set state = excluded.state, payload = excluded.payload, updated_at = now()`,
    [JSON.stringify(state)],
  );
}
