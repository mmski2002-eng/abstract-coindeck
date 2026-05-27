import { NextRequest, NextResponse } from "next/server";
import { checkSecretAuth } from "../../admin/auth";
import { botWalletStatus, readConfig, readState, recoverStaleRun, runOnce } from "../runner";
import { runOracleSync } from "../../oracle-history/lib";


export async function GET(req: NextRequest) {
  const auth = checkSecretAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.error }, { status: 401 });
  }

  const config = await readConfig();
  let state = await readState();

  if (state.running && (state.leaseUntil ?? 0) < Date.now()) {
    await recoverStaleRun();
    state = await readState();
  }

  if (config.mode === "auto" && config.enabled && !state.running) {
    void runOnce();
  }

  void runOracleSync();

  return NextResponse.json({
    config,
    state: await readState(),
    wallet: botWalletStatus(),
  });
}
