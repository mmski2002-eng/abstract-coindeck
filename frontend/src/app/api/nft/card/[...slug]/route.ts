import { buildCardImageResponse, getPlayerIdFromCoinGeckoId } from "../../shared";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const cgkId = Number(slug?.[0]);
  return buildCardImageResponse(getPlayerIdFromCoinGeckoId(cgkId), 0);
}
