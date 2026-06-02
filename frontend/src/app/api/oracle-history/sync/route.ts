import { NextRequest, NextResponse } from "next/server";
import { checkSecretAuth } from "../../admin/auth";
import { runOracleSync } from "../lib";

function checkCronOrAdminAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const provided = req.headers.get("authorization") ?? "";
  if (cronSecret && provided === `Bearer ${cronSecret}`) {
    return { ok: true as const };
  }
  return checkSecretAuth(req);
}

export async function GET(req: NextRequest) {
  const auth = checkCronOrAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.error }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runOracleSync(force);
  return NextResponse.json(result);
}
