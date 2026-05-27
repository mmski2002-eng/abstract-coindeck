import { NextResponse } from "next/server";
import { readHistory } from "./lib";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const epochParam = searchParams.get("epoch");
  const all = await readHistory();
  return NextResponse.json(epochParam ? (all[epochParam] ?? {}) : all);
}
