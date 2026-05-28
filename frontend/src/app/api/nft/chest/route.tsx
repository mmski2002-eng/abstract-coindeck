import { NextRequest } from "next/server";
import { buildChestImageResponse, getChestTypeFromPath } from "../shared";



export async function GET(req: NextRequest) {
  const { searchParams, pathname, origin } = req.nextUrl;

  let type = -1;
  const typeParam = searchParams.get("type");
  if (typeParam !== null) {
    type = Number(typeParam);
  } else {
    type = getChestTypeFromPath(pathname);
  }
  return buildChestImageResponse(type, origin);
}
