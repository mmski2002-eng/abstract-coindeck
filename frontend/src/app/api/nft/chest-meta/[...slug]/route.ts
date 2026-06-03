import { NextRequest, NextResponse } from "next/server";
import { NFT_CHEST_ANIM_STYLES } from "../../palette";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const type = Number(slug?.[0]);
  if (isNaN(type) || type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const chest = NFT_CHEST_ANIM_STYLES[type];
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  return NextResponse.json({
    name: chest.name,
    description: `HeavyEggs NFT Egg — ${chest.label}`,
    image: `${origin}/chests-anim/${type}.gif`,
    animation_url: `${origin}/api/nft/chest-anim/${type}`,
    attributes: [
      { trait_type: "Size", value: chest.label },
    ],
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
