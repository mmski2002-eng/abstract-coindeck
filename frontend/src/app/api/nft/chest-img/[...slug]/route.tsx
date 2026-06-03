import { NextRequest, NextResponse } from "next/server";
import { getChestTypeFromPath } from "../../shared";
import { NFT_CHEST_RENDER_STYLES } from "../../palette";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const type = getChestTypeFromPath((slug ?? []).join("/"));
  if (type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const chest = NFT_CHEST_RENDER_STYLES[type];
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  const metadata = {
    name: chest.name,
    description: `HeavyEggs NFT Chest — ${chest.rarity}`,
    image: `${origin}${chest.image}`,
    attributes: [
      { trait_type: "Rarity", value: chest.rarity },
      { trait_type: "Type", value: chest.name },
    ],
  };

  return NextResponse.json(metadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
