import { buildChestImageResponse, getChestTypeFromPath } from "../../shared";

export const runtime = "edge";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  return buildChestImageResponse(getChestTypeFromPath((slug ?? []).join("/")), new URL(req.url).origin);
}
