import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  checkRateLimit,
  adminRateLimits,
  verifyAdminAction,
  checkSecretAuth,
} from "../admin/auth";
import { MARKET_DATA_PARSE_ACTION } from "@/lib/adminAuth";
import { formatUtcDateKey } from "@/lib/oracleWindow";
import { getStatus, startJob } from "./worker";

const MAX_HISTORY_DAYS = Number(process.env.MARKET_DATA_MAX_HISTORY_DAYS ?? "90");

function parseDateKey(date: string, fromTsParam: string | null): { key: string; ts: number | "today" } | null {
  if (fromTsParam) {
    const fromTs = Number(fromTsParam);
    if (!Number.isInteger(fromTs) || fromTs < 0) return null;
    return { key: formatUtcDateKey(fromTs), ts: fromTs };
  }
  if (date === "today") return { key: "today", ts: "today" };
  const parsed = new Date(date + "T00:00:00Z");
  if (isNaN(parsed.getTime())) return null;
  return { key: formatUtcDateKey(parsed.getTime() / 1000), ts: parsed.getTime() / 1000 };
}

function checkDateRange(ts: number | "today"): boolean {
  if (ts === "today") return true;
  const now = Math.floor(Date.now() / 1000);
  const ageDays = (now - ts) / 86400;
  return ageDays >= 0 && ageDays <= MAX_HISTORY_DAYS;
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "missing date" }, { status: 400 });
  const fromTs = req.nextUrl.searchParams.get("fromTs");

  const parsed = parseDateKey(date, fromTs);
  if (!parsed) return NextResponse.json({ error: "invalid date" }, { status: 400 });

  const status = await getStatus(parsed.key, parsed.ts);
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const ip = clientIp(req);
  if (!await checkRateLimit(`market-data:post:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "missing date" }, { status: 400 });
  const fromTs = req.nextUrl.searchParams.get("fromTs");

  const parsed = parseDateKey(date, fromTs);
  if (!parsed) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  if (!checkDateRange(parsed.ts)) {
    return NextResponse.json({ error: `date is outside allowed ${MAX_HISTORY_DAYS}-day range` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const secretAuth = checkSecretAuth(req);
  const walletAuth = !secretAuth.ok ? await verifyAdminAction(req, body, MARKET_DATA_PARSE_ACTION, {}) : null;

  if (!secretAuth.ok && !walletAuth?.ok) {
    const reason = walletAuth && !walletAuth.ok ? walletAuth.error : "unauthorized";
    console.info("[market-data] auth failed", { ip, date: parsed.key, reason });
    return NextResponse.json({ error: "Unauthorized", reason }, { status: 401 });
  }

  const actor = secretAuth.ok ? secretAuth.actor : (walletAuth?.ok ? walletAuth.actor : "unknown");
  const force = body.force === true;
  const started = await startJob(parsed.key, parsed.ts, force);
  const status = await getStatus(parsed.key, parsed.ts);
  console.info("[market-data] job request", { actor, ip, date: parsed.key, started, force, status: status.state });
  return NextResponse.json({ started, status }, { status: started ? 202 : 200 });
}
