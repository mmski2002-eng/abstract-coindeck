import { NextRequest, NextResponse } from "next/server";
import { CLAIM_LIST_PREVIEW_ACTION } from "@/lib/adminAuth";
import { buildClaimListForEpoch, getCurrentTournamentProgress } from "@/lib/claimList";
import {
  adminRateLimits,
  checkRateLimit,
  checkSecretAuth,
  clientIp,
  verifyAdminAction,
} from "../../auth";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!await checkRateLimit(`claim-list-preview:post:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const epoch = Number(body.epoch ?? 0);
  if (!Number.isInteger(epoch) || epoch < 1) {
    return NextResponse.json({ error: "invalid epoch" }, { status: 400 });
  }

  const payload = { epoch };
  const secretAuth = checkSecretAuth(req);
  const walletAuth = !secretAuth.ok ? await verifyAdminAction(req, body, CLAIM_LIST_PREVIEW_ACTION, payload) : null;
  if (!secretAuth.ok && !walletAuth?.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: walletAuth && !walletAuth.ok ? walletAuth.error : "unauthorized" }, { status: 401 });
  }

  const progress = await getCurrentTournamentProgress();
  if (!progress) {
    return NextResponse.json({ error: "tournament state unavailable" }, { status: 503 });
  }
  if (epoch !== progress.epoch) {
    return NextResponse.json({ error: "claim preview is only available for the current epoch" }, { status: 409 });
  }
  if (progress.closedDay < 6) {
    return NextResponse.json({ error: "claim preview is available only after day 6 is closed" }, { status: 409 });
  }

  try {
    const result = await buildClaimListForEpoch(epoch);
    return NextResponse.json({
      epoch: result.epoch,
      updatedAt: result.updatedAt,
      poolOctas: result.poolOctas,
      totalOctas: result.totalOctas,
      entries: result.addrs.length,
      claimListText: result.claimListText,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "failed to build claim list", reason: message }, { status: 500 });
  }
}
