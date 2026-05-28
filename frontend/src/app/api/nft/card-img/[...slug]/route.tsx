import { NextRequest, NextResponse } from "next/server";
import { getPlayerIdFromCoinGeckoId } from "../../shared";
import {
  ASSET_TICKERS as TICKERS,
  ASSET_NAMES as NAMES,
  ASSET_ROLES as ROLES,
} from "@/config/assetUniverse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const cgkId = Number(slug?.[0]);
  const playerId = getPlayerIdFromCoinGeckoId(cgkId);
  if (playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });

  const ticker = TICKERS[playerId];
  const name = NAMES[playerId];
  const role = ROLES[playerId];
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  return NextResponse.json({
    name: `${name} Card`,
    description: `CoinDeck NFT — ${ticker} (${role})`,
    image: `${origin}/cards/${playerId}_0.png`,
    attributes: [
      { trait_type: "Coin", value: ticker },
      { trait_type: "Role", value: role },
    ],
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
