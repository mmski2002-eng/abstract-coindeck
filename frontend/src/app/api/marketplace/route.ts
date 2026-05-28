import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "../admin/auth";
import {
  getMarketplaceListings,
  getMarketplaceSyncState,
  isMarketplaceSyncStale,
} from "@/lib/storage/marketplace";
import { syncMarketplace } from "./worker";
import { isDatabaseEnabled } from "@/lib/db/client";

const PUBLIC_RATE_LIMIT = Number(process.env.MARKETPLACE_RATE_LIMIT ?? "60");

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (ip === "unknown") {
    return NextResponse.json({ error: "Unable to determine client IP" }, { status: 429 });
  }
  if (!await checkRateLimit(`marketplace:get:${ip}`, PUBLIC_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!isDatabaseEnabled()) {
    return NextResponse.json({ listings: [], total: 0, updatedAt: null, status: "unavailable" }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const playerIdRaw = params.get("player_id");
  const tierRaw = params.get("tier");
  const seller = params.get("seller") ?? undefined;

  const playerId = playerIdRaw !== null ? Number(playerIdRaw) : undefined;
  const tier = tierRaw !== null ? Number(tierRaw) : undefined;

  try {
    const { syncedAt } = await getMarketplaceSyncState();
    const stale = isMarketplaceSyncStale(syncedAt);

    if (stale) {
      void syncMarketplace().catch(() => {});
    }

    const rows = await getMarketplaceListings({
      ...(playerId !== undefined && Number.isInteger(playerId) ? { player_id: playerId } : {}),
      ...(tier !== undefined && Number.isInteger(tier) && tier >= 0 && tier <= 3 ? { tier } : {}),
      ...(seller ? { seller } : {}),
    });

    return NextResponse.json({
      listings: rows,
      total: rows.length,
      updatedAt: syncedAt,
      status: stale ? "refreshing" : "done",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (ip === "unknown") {
    return NextResponse.json({ error: "Unable to determine client IP" }, { status: 429 });
  }
  if (!await checkRateLimit(`marketplace:sync:${ip}`, 10)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!isDatabaseEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  void syncMarketplace().catch(() => {});
  return NextResponse.json({ status: "syncing" }, { status: 202 });
}
