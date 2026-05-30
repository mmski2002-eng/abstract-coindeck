import { buildCardImageResponse } from "../../shared";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const playerId = Number(slug?.[0]);
  const tier = Number(slug?.[1] ?? 0);
  return buildCardImageResponse(playerId, tier);
}
