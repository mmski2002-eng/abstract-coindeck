import { NextRequest, NextResponse } from "next/server";

const CHESTS = [
  { name: "Small Egg",  rarity: "Small",  fill: "#D9D3C2", file: "wooden_closed.png" },
  { name: "Medium Egg", rarity: "Medium", fill: "#7AC7E8", file: "iron_closed.png" },
  { name: "Large Egg",  rarity: "Large",  fill: "#26C6A8", file: "silver_closed.png" },
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const type = Number(slug?.[0]);
  if (isNaN(type) || type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const chest = CHESTS[type];
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  return NextResponse.json({
    name: chest.name,
    description: `CoinDeck NFT Egg — ${chest.rarity}`,
    image: `${origin}/chests-anim/${type}.gif`,
    animation_url: `${origin}/api/nft/chest-anim/${type}`,
    attributes: [
      { trait_type: "Size", value: chest.rarity },
    ],
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
