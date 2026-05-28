import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { abstractTestnet } from "viem/chains";
import { getCached, runJob, isRunning } from "../worker";
import { hasOracleDataDrift, readRoleBonusPct } from "@/lib/storage/leaderboard";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";
import { TOURNAMENT_VIEW_ABI } from "@/lib/evmContracts";

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
  const addrs = getRuntimeProjectAddresses();
  try {
    const client = createPublicClient({ chain: abstractTestnet, transport: http(addrs.restUrl) });
    const state = await client.readContract({
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_VIEW_ABI,
      functionName: "getState",
    });
    const epoch = Number(state[1]);
    const isRest = state[3];
    const rawDay = Number(state[2]);
    const currentDay = (isRest || rawDay < 1) ? LEADERBOARD_TOTAL_DAYS : Math.min(rawDay, LEADERBOARD_TOTAL_DAYS);
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

  const overrideEpoch = req.nextUrl.searchParams.get("epoch");
  const overrideDay = req.nextUrl.searchParams.get("day");

  let epoch: number;
  let currentDay: number;

  if (overrideEpoch !== null && overrideDay !== null) {
    epoch = Number(overrideEpoch);
    currentDay = Number(overrideDay);
    if (!Number.isInteger(epoch) || epoch < 1 || !Number.isInteger(currentDay) || currentDay < 1 || currentDay > LEADERBOARD_TOTAL_DAYS) {
      return NextResponse.json({ error: "Invalid epoch/day override" }, { status: 400 });
    }
  } else {
    const state = await getCurrentState();
    if (!state) {
      return NextResponse.json({ error: "Cannot fetch tournament state" }, { status: 503 });
    }
    epoch = state.epoch;
    currentDay = state.currentDay;
  }
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
