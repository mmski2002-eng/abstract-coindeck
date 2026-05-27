import { NextRequest, NextResponse } from "next/server";
import { getBestCached, isStale, isRunning, runJob } from "./worker";
import {
  adminRateLimits,
  checkRateLimit,
  clientIp,
  verifyAdminAction,
} from "../admin/auth";
import { LEADERBOARD_REFRESH_ACTION } from "@/lib/adminAuth";
import { readRoleBonusPct, readRouteState, writeRouteState, getLeaderboardPage, type RouteState } from "@/lib/storage/leaderboard";
import { withDbTransaction } from "@/lib/db/client";

const MAX_CONCURRENT_JOBS = 3;
const LEADERBOARD_TOTAL_DAYS = 6;
const PUBLIC_GET_RATE_LIMIT = Number(process.env.LEADERBOARD_PUBLIC_RATE_LIMIT ?? "60");

let activeJobs = 0;
let queueDraining = false;

function jobKey(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): string {
  return `${epoch}:${totalDays}:${currentDay}:${roleBonusPct}`;
}

async function parseParams(params: URLSearchParams): Promise<{ epoch: number; totalDays: number; currentDay: number; roleBonusPct: number } | null> {
  const epoch = Number(params.get("epoch") ?? "1");
  const totalDays = Number(params.get("totalDays") ?? String(LEADERBOARD_TOTAL_DAYS));
  const currentDay = Number(params.get("currentDay") ?? String(totalDays));
  const roleBonusPct = Number(params.get("roleBonusPct") ?? String(await readRoleBonusPct()));
  if (!Number.isInteger(epoch) || epoch < 1 || epoch > 10_000) return null;
  if (!Number.isInteger(totalDays) || totalDays !== LEADERBOARD_TOTAL_DAYS) return null;
  if (!Number.isInteger(currentDay) || currentDay < 1 || currentDay > totalDays) return null;
  if (!Number.isInteger(roleBonusPct) || roleBonusPct < 0 || roleBonusPct > 10_000) return null;
  return { epoch, totalDays, currentDay, roleBonusPct };
}

type QueueEntry = { epoch: number; totalDays: number; currentDay: number; roleBonusPct: number };

async function isQueued(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): Promise<boolean> {
  const key = jobKey(epoch, totalDays, currentDay, roleBonusPct);
  const result = await withDbTransaction(async (client) => {
    const r = await client.query<{ payload: RouteState }>(
      `select payload from job_state where job_key = 'leaderboard-route-queue' and job_type = 'leaderboard-route' limit 1`,
    );
    return (r.rows[0]?.payload?.queue ?? []) as QueueEntry[];
  });
  return result.some((e) => jobKey(e.epoch, e.totalDays, e.currentDay, e.roleBonusPct) === key);
}

async function enqueueJob(epoch: number, totalDays: number, currentDay: number, roleBonusPct: number): Promise<boolean> {
  if (await isRunning(epoch, totalDays, currentDay, roleBonusPct)) return false;
  const key = jobKey(epoch, totalDays, currentDay, roleBonusPct);

  const enqueued = await withDbTransaction(async (client) => {
    await client.query(
      `insert into job_state (job_key, job_type, state, payload, updated_at)
       values ('leaderboard-route-queue', 'leaderboard-route', 'queued', '{"queue":[]}'::jsonb, now())
       on conflict (job_key) do nothing`,
    );
    const r = await client.query<{ payload: RouteState }>(
      `select payload from job_state where job_key = 'leaderboard-route-queue' and job_type = 'leaderboard-route' for update`,
    );
    const state: RouteState = { queue: (r.rows[0]?.payload?.queue ?? []) as QueueEntry[] };
    if (state.queue.some((e) => jobKey(e.epoch, e.totalDays, e.currentDay, e.roleBonusPct) === key)) return false;
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
      if (state.queue.length >= MAX_CONCURRENT_JOBS * 2) return false;
      state.queue.push({ epoch, totalDays, currentDay, roleBonusPct });
    } else {
      state.queue.unshift({ epoch, totalDays, currentDay, roleBonusPct });
    }
    await client.query(
      `update job_state set payload = $1::jsonb, updated_at = now()
       where job_key = 'leaderboard-route-queue' and job_type = 'leaderboard-route'`,
      [JSON.stringify(state)],
    );
    return true;
  });

  if (!enqueued) return false;
  void drainQueue();
  return true;
}

async function drainQueue() {
  if (queueDraining) return;
  queueDraining = true;
  try {
    while (activeJobs < MAX_CONCURRENT_JOBS) {
      const state: RouteState = await readRouteState();
      const next = state.queue.shift();
      if (!next) break;
      await writeRouteState(state);
      if (await isRunning(next.epoch, next.totalDays, next.currentDay, next.roleBonusPct)) continue;
      activeJobs++;
      runJob(next.epoch, next.totalDays, next.currentDay, next.roleBonusPct)
        .catch(async (error) => {
          console.error(error);
          try {
            await enqueueJob(next.epoch, next.totalDays, next.currentDay, next.roleBonusPct);
          } catch { /* best effort */ }
        })
        .finally(() => {
          activeJobs--;
          void drainQueue();
        });
    }
  } finally {
    queueDraining = false;
  }
}

const MAX_PAGE_LIMIT = 500;
const DEFAULT_PAGE_LIMIT = 100;

function parsePaginationParams(params: URLSearchParams): { limit: number; offset: number; league?: number; addr?: string } {
  const limit = Math.min(Number(params.get("limit") ?? DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const leagueRaw = params.get("league");
  const league = leagueRaw !== null ? Number(leagueRaw) : undefined;
  const addr = params.get("addr") ?? undefined;
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_PAGE_LIMIT,
    offset: Number.isFinite(offset) ? Math.floor(offset) : 0,
    ...(league !== undefined && Number.isInteger(league) && league >= 0 && league <= 2 ? { league } : {}),
    ...(addr ? { addr } : {}),
  };
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (ip === "unknown") {
    return NextResponse.json({ error: "Unable to determine client IP" }, { status: 429 });
  }
  if (!await checkRateLimit(`leaderboard:get:${ip}`, PUBLIC_GET_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseParams(req.nextUrl.searchParams);
  if (!parsed) return NextResponse.json({ error: "invalid params" }, { status: 400 });

  const { epoch, totalDays, currentDay, roleBonusPct } = parsed;
  const { cache, exact } = await getBestCached(epoch, totalDays, currentDay, roleBonusPct);
  const running = await isRunning(epoch, totalDays, currentDay, roleBonusPct);
  const queued = await isQueued(epoch, totalDays, currentDay, roleBonusPct);
  const status = running || queued ? "refreshing" : "done";

  if (!cache) {
    return NextResponse.json(
      { status: running || queued ? "loading" : "unavailable", rows: [], total: 0, offset: 0, limit: DEFAULT_PAGE_LIMIT, updatedAt: null },
      { status: running || queued ? 202 : 404 },
    );
  }

  const pg = parsePaginationParams(req.nextUrl.searchParams);
  const pageKey = exact
    ? parsed
    : {
        epoch: cache.epoch,
        totalDays: cache.totalDays,
        currentDay: cache.currentDay,
        roleBonusPct: cache.roleBonusPct,
      };
  const { rows, total } = await getLeaderboardPage(pageKey, pg);

  return NextResponse.json({
    status,
    rows,
    total,
    offset: pg.offset,
    limit: pg.limit,
    updatedAt: cache.updatedAt,
    stale: isStale(cache),
    exact,
  });
}

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const ip = clientIp(req);
  if (ip === "unknown") {
    return NextResponse.json({ error: "Unable to determine client IP" }, { status: 429 });
  }
  if (!await checkRateLimit(`leaderboard:post:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseParams(req.nextUrl.searchParams);
  if (!parsed) return NextResponse.json({ error: "invalid params" }, { status: 400 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const auth = await verifyAdminAction(req, body, LEADERBOARD_REFRESH_ACTION, parsed);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enqueued = await enqueueJob(parsed.epoch, parsed.totalDays, parsed.currentDay, parsed.roleBonusPct);
  return NextResponse.json({
    status: enqueued || await isRunning(parsed.epoch, parsed.totalDays, parsed.currentDay, parsed.roleBonusPct) ? "loading" : "busy",
    rows: [],
    updatedAt: null,
  }, { status: enqueued ? 202 : 200 });
}
