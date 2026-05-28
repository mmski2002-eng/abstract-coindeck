import { NextRequest, NextResponse } from "next/server";
import { readMarketSnapshot, saveMarketSnapshot } from "@/lib/storage/marketSnapshot";
import { isDatabaseEnabled } from "@/lib/db/client";
import { readMarketJobState } from "@/lib/storage/marketData";
import { formatUtcDateKey } from "@/lib/oracleWindow";
import { checkSecretAuth, verifyAdminAction } from "@/app/api/admin/auth";
import { MARKET_SNAPSHOT_SAVE_ACTION } from "@/lib/adminAuth";
import { getTopPickPids } from "@/lib/storage/lineupStats";

export async function GET(req: NextRequest) {
  const epoch = Number(req.nextUrl.searchParams.get("epoch"));
  const day = Number(req.nextUrl.searchParams.get("day"));

  if (!Number.isInteger(epoch) || epoch < 1 || !Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: "invalid epoch or day" }, { status: 400 });
  }

  if (!isDatabaseEnabled()) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  const data = await readMarketSnapshot(epoch, day).catch(() => null);
  if (!data) return NextResponse.json({ data });

  const topPids = await getTopPickPids(epoch, day);
  const coinData = data.map((coin) => ({ ...coin, hype: topPids.has(coin.pid) }));
  return NextResponse.json({ data: coinData });
}

export async function POST(req: NextRequest) {
  if (!isDatabaseEnabled()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const epoch = Number(body.epoch);
  const day = Number(body.day);

  const secretAuth = checkSecretAuth(req);
  const walletAuth = !secretAuth.ok ? await verifyAdminAction(req, body, MARKET_SNAPSHOT_SAVE_ACTION, { epoch, day }) : null;

  if (!secretAuth.ok && !walletAuth?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startTimestamp = Number(body.startTimestamp);
  const baseEpoch = Number(body.baseEpoch ?? 1);

  if (!Number.isInteger(epoch) || epoch < 1 || !Number.isInteger(day) || day < 1 || day > 6 || !startTimestamp) {
    return NextResponse.json({ error: "required: epoch (≥1), day (1-6), startTimestamp" }, { status: 400 });
  }
  if (!Number.isInteger(baseEpoch) || baseEpoch < 1 || baseEpoch > epoch) {
    return NextResponse.json({ error: "baseEpoch must be integer ≥1 and ≤epoch" }, { status: 400 });
  }

  const dayStartTs = startTimestamp + (epoch - baseEpoch) * 7 * 86400 + (day - 1) * 86400;
  const dateKey = formatUtcDateKey(dayStartTs);
  const jobKey = `${dateKey}.${dayStartTs}-${dayStartTs + 86400}`;

  const marketJob = await readMarketJobState(jobKey);
  if (marketJob.state !== "done" || !marketJob.data || marketJob.data.length === 0) {
    return NextResponse.json({ error: "market-data job not done", jobKey, state: marketJob.state }, { status: 422 });
  }

  const topPids = await getTopPickPids(epoch, day);
  const coinData = marketJob.data.map(coin => ({ ...coin, hype: topPids.has(coin.pid) }));

  await saveMarketSnapshot(epoch, day, coinData);
  return NextResponse.json({ ok: true, epoch, day, coins: coinData.length, jobKey, hypeCount: topPids.size });
}
