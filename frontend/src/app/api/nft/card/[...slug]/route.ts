import fs from "fs";
import path from "path";
import { getPlayerIdFromCoinGeckoId } from "../../shared";
import { ASSET_TICKERS as TICKERS } from "@/config/assetUniverse";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const cgkId = Number(slug?.[0]);
  const playerId = getPlayerIdFromCoinGeckoId(cgkId);
  if (playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });

  const ticker = TICKERS[playerId];
  const pngPath = path.join(process.cwd(), "public", "coins", `${playerId}_${ticker}.png`);
  const jpgPath = path.join(process.cwd(), "public", "coins", `${playerId}_${ticker}.jpg`);

  const [filePath, ct] = fs.existsSync(pngPath)
    ? [pngPath, "image/png"]
    : fs.existsSync(jpgPath)
      ? [jpgPath, "image/jpeg"]
      : [null, null];

  if (!filePath) return new Response("Not found", { status: 404 });

  return new Response(fs.readFileSync(filePath), {
    headers: { "Content-Type": ct!, "Cache-Control": "public, max-age=86400" },
  });
}
