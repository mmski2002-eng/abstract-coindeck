import { NextRequest, NextResponse } from "next/server";
import {
  ASSET_TICKERS as TICKERS,
  ASSET_NAMES as NAMES,
  ASSET_ROLES as ROLES,
} from "@/config/assetUniverse";
import { NFT_RARITY_STYLES } from "../../palette";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const playerId = Number(slug?.[0]);
  const tier = Number(slug?.[1] ?? 0);
  if (isNaN(playerId) || playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });
  if (isNaN(tier) || tier < 0 || tier > 3) return new Response("Not found", { status: 404 });

  const ticker = TICKERS[playerId];
  const name = NAMES[playerId];
  const role = ROLES[playerId];
  const tierLabel = NFT_RARITY_STYLES[tier]?.label ?? NFT_RARITY_STYLES[0].label;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  return NextResponse.json({
    name: `${name} — ${tierLabel}`,
    description: `HeavyEggs NFT Card — ${ticker} (${role})`,
    image: `${origin}/cards-anim/${playerId}_${tier}.gif`,
    animation_url: `${origin}/api/nft/card-anim/${playerId}/${tier}`,
    attributes: [
      { trait_type: "Coin", value: name },
      { trait_type: "Ticker", value: ticker },
      { trait_type: "Tier", value: tierLabel },
      { trait_type: "Role", value: role },
    ],
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
