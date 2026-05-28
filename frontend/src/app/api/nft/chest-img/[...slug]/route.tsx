import { NextRequest, NextResponse } from "next/server";
import { getChestTypeFromPath } from "../../shared";

const CHESTS = [
  { name: "Wooden Chest", file: "wooden_closed.png", rarity: "Common" },
  { name: "Iron Chest",   file: "iron_closed.png",   rarity: "Rare" },
  { name: "Silver Chest", file: "silver_closed.png",  rarity: "Epic" },
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const type = getChestTypeFromPath((slug ?? []).join("/"));
  if (type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const chest = CHESTS[type];
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  const metadata = {
    name: chest.name,
    description: `CoinDeck NFT Chest — ${chest.rarity}`,
    image: `${origin}/chests/${chest.file}`,
    attributes: [
      { trait_type: "Rarity", value: chest.rarity },
      { trait_type: "Type", value: chest.name },
    ],
  };

  return NextResponse.json(metadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
