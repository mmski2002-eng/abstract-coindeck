import { NextRequest, NextResponse } from "next/server";
import { BOT_CONTROL_ACTION } from "@/lib/adminAuth";
import {
  adminRateLimits,
  checkRateLimit,
  checkSecretAuth,
  clientIp,
  verifyAdminAction,
} from "../admin/auth";
import {
  botWalletStatus,
  readConfig,
  readState,
  requestStop,
  resetError,
  runOnce,
  writeConfig,
  type BotMode,
} from "./runner";

async function statusResponse() {
  return NextResponse.json({
    config: await readConfig(),
    state: await readState(),
    wallet: botWalletStatus(),
  });
}

export async function GET() {
  return statusResponse();
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!await checkRateLimit(`bot:post:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const payload = {
    action,
    mode: typeof body.mode === "string" ? body.mode : undefined,
  };

  const secretAuth = checkSecretAuth(req);
  const walletAuth = !secretAuth.ok ? await verifyAdminAction(req, body, BOT_CONTROL_ACTION, payload) : null;
  if (!secretAuth.ok && !walletAuth?.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: walletAuth && !walletAuth.ok ? walletAuth.error : "unauthorized" }, { status: 401 });
  }

  if (action === "set-mode") {
    const mode = (body.mode === "auto" ? "auto" : "manual") as BotMode;
    await writeConfig({ mode, enabled: mode === "auto" });
    if (mode === "auto") void runOnce();
    return statusResponse();
  }
  if (action === "run-once") {
    void runOnce();
    return statusResponse();
  }
  if (action === "stop") {
    await requestStop();
    return statusResponse();
  }
  if (action === "reset-error") {
    await resetError();
    return statusResponse();
  }
  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
