import { NextRequest, NextResponse } from "next/server";
import { serverErrorResponse } from "../../_lib/errors";
import {
  adminRateLimits,
  appendAuditLog,
  checkRateLimit,
  checkSecretAuth,
  clientIp,
  requestDomain,
  verifyAdminAction,
} from "../../admin/auth";
import { LEADERBOARD_CONFIG_ACTION } from "@/lib/adminAuth";
import {
  DEFAULT_PRIZE_CONFIG,
  normalizeLeaderboardConfig,
  readLeaderboardConfig,
  writeLeaderboardConfig,
} from "@/lib/storage/leaderboardConfig";

function normalizePayload(body: Record<string, unknown>) {
  if (!Array.isArray(body.tierMults) || body.tierMults.length !== 4) {
    return { error: "tierMults must be array[4]" } as const;
  }
  const tierMults = (body.tierMults as unknown[]).map(Number);
  if (tierMults.some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) {
    return { error: "each multiplier must be 0-10000" } as const;
  }

  const roleBonusPct = Number(body.roleBonusPct);
  if (!Number.isFinite(roleBonusPct) || roleBonusPct < 0 || roleBonusPct > 10000) {
    return { error: "roleBonusPct must be 0-10000" } as const;
  }

  return {
    payload: normalizeLeaderboardConfig({
      tierMults,
      roleBonusPct,
      prizeConfig: body.prizeConfig ?? DEFAULT_PRIZE_CONFIG,
    }),
  } as const;
}

export async function GET() {
  return NextResponse.json(await readLeaderboardConfig());
}

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const normalized = normalizePayload(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const ip = clientIp(req);
  if (!await checkRateLimit(`config:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const secretAuth = checkSecretAuth(req);
  const walletAuth = secretAuth.ok
    ? secretAuth
    : await verifyAdminAction(req, body, LEADERBOARD_CONFIG_ACTION, normalized.payload);
  if (!walletAuth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await writeLeaderboardConfig(normalized.payload);
    await appendAuditLog({
      scope: "leaderboard-config",
      actor: walletAuth.actor,
      authType: walletAuth.authType,
      ip,
      domain: requestDomain(req),
      payload: normalized.payload,
    });
  } catch (error) {
    return serverErrorResponse("leaderboard-config", error);
  }

  return NextResponse.json(normalized.payload);
}
