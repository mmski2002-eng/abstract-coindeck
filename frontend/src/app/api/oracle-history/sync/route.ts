import { NextRequest, NextResponse } from "next/server";
import { checkSecretAuth } from "../../admin/auth";
import { runOracleSync } from "../lib";

export async function GET(req: NextRequest) {
  const auth = checkSecretAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.error }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runOracleSync(force);
  return NextResponse.json(result);
}
