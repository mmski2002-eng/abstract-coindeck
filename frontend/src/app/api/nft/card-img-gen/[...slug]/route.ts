import { NextRequest } from "next/server";
import { buildCardImageResponse } from "../../shared";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const playerId = Number(slug?.[0]);
  const tier = Number(slug?.[1] ?? 0);
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("host") ?? "escape.isgood.host";
  return await buildCardImageResponse(playerId, tier, `${proto}://${host}`);
}
