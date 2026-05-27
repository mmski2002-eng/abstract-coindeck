import { NextRequest, NextResponse } from "next/server";
import { getCached, runJob, isRunning } from "../worker";
import { hasOracleDataDrift, readRoleBonusPct } from "@/lib/storage/leaderboard";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const LEADERBOARD_TOTAL_DAYS = 6;
const REFRESH_INTERVAL_MS = Number(process.env.LEADERBOARD_REFRESH_INTERVAL_MS ?? String(60 * 60 * 1000));

function auth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const header = req.headers.get("authorization") ?? "";
  const query = req.nextUrl.searchParams.get("secret") ?? "";
  return header === `Bearer ${CRON_SECRET}` || query === CRON_SECRET;
}

async function getCurrentState(): Promise<{ epoch: number; currentDay: number } | null> {
  const { restUrl, moduleAddress } = getRuntimeProjectAddresses();
  try {
    const resp = await fetch(`${restUrl}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: `${moduleAddress}::tournament::get_state`, type_arguments: [], arguments: [] }),
    });
    if (!resp.ok) return null;
    const json = await resp.json() as unknown;
    const state = Array.isArray(json)
      ? json
      : json && typeof json === "object" && "value" in json && Array.isArray((json as { value: unknown }).value)
        ? (json as { value: unknown[] }).value
        : null;
    if (!state) return null;
    const [, rawEpoch, rawDay] = state as [unknown, string, string];
    const epoch = Number(rawEpoch ?? 1);
    const rawDayNum = Number(rawDay ?? 1);
    const currentDay = rawDayNum < 1 ? LEADERBOARD_TOTAL_DAYS : Math.min(rawDayNum, LEADERBOARD_TOTAL_DAYS);
    if (!Number.isInteger(epoch) || epoch < 1) return null;
    return { epoch, currentDay };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getCurrentState();
  if (!state) {
    return NextResponse.json({ error: "Cannot fetch tournament state" }, { status: 503 });
  }

  const { epoch, currentDay } = state;
  const roleBonusPct = await readRoleBonusPct();
  const cache = await getCached(epoch, LEADERBOARD_TOTAL_DAYS, currentDay, roleBonusPct);
  const hasDrift = cache ? await hasOracleDataDrift(epoch, currentDay, cache.updatedAt) : false;

  if (await isRunning(epoch, LEADERBOARD_TOTAL_DAYS, currentDay, roleBonusPct)) {
    return NextResponse.json({ status: "already_running", epoch, currentDay });
  }
  if (cache && !hasDrift && Date.now() - cache.updatedAt < REFRESH_INTERVAL_MS) {
    return NextResponse.json({
      status: "fresh",
      epoch,
      currentDay,
      updatedAt: cache.updatedAt,
      nextRefreshAt: cache.updatedAt + REFRESH_INTERVAL_MS,
    });
  }

  // Fire and forget — cron doesn't wait for completion
  runJob(epoch, LEADERBOARD_TOTAL_DAYS, currentDay, roleBonusPct).catch(console.error);

  return NextResponse.json({ status: hasDrift ? "started_due_to_oracle_drift" : "started", epoch, currentDay });
}

// Also support GET for simple cron services that only do GET
export async function GET(req: NextRequest) {
  return POST(req);
}
