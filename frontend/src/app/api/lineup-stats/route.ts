import { NextRequest, NextResponse } from "next/server";
import { isDatabaseEnabled } from "@/lib/db/client";
import { getPickCounts } from "@/lib/storage/leaderboard";
import { checkRateLimit, clientIp } from "../admin/auth";

const LINEUP_STATS_RATE_LIMIT = Number(process.env.LINEUP_STATS_RATE_LIMIT ?? "30");
const TOTAL_DAYS = 6;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (ip === "unknown") {
    return NextResponse.json({ error: "Unable to determine client IP" }, { status: 429 });
  }
  if (!await checkRateLimit(`lineup-stats:get:${ip}`, LINEUP_STATS_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const epoch = Number(req.nextUrl.searchParams.get("epoch"));
  const day = Number(req.nextUrl.searchParams.get("day"));

  if (!Number.isInteger(epoch) || epoch < 1 || !Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: "invalid epoch or day" }, { status: 400 });
  }

  if (!isDatabaseEnabled()) {
    return NextResponse.json({ data: null });
  }

  // Return pick counts for the last closed day (day - 1).
  let queryEpoch = epoch;
  let queryDay = day - 1;
  if (queryDay < 1) {
    if (epoch <= 1) return NextResponse.json({ data: null });
    queryEpoch = epoch - 1;
    queryDay = TOTAL_DAYS;
  }

  const counts = await getPickCounts(queryEpoch, queryDay).catch(() => null);
  return NextResponse.json(
    { data: counts },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
