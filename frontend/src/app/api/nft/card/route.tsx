import { NextRequest } from "next/server";
import { buildCardImageResponse, getPlayerIdFromCardPath } from "../shared";



export async function GET(req: NextRequest) {
  // URL: /api/nft/card?pid=0&tier=0  (called from web app)
  // URL: /api/nft/card/<cgk_id>/small/<file>  (called from NFT metadata, via rewrite)
  const { searchParams, pathname } = req.nextUrl;

  let playerId = -1;
  let tier = 0;

  // Query-param mode: ?pid=0&tier=1
  const pidParam = searchParams.get("pid");
  const tierParam = searchParams.get("tier");
  if (pidParam !== null) {
    playerId = Number(pidParam);
    tier = Number(tierParam ?? "0");
  } else {
    playerId = getPlayerIdFromCardPath(pathname);
  }
  const proto  = req.headers.get("x-forwarded-proto") ?? "https";
  const host   = req.headers.get("host") ?? "escape.isgood.host";
  return await buildCardImageResponse(playerId, tier, `${proto}://${host}`);
}
