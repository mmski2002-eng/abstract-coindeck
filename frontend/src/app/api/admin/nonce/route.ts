import { NextRequest, NextResponse } from "next/server";
import {
  adminRateLimits,
  checkRateLimit,
  clientIp,
  createNonce,
  requestDomain,
} from "../auth";
import {
  ADMIN_AUDIT_ACTION,
  BOT_CONTROL_ACTION,
  CLAIM_LIST_PREVIEW_ACTION,
  LEADERBOARD_CONFIG_ACTION,
  LEADERBOARD_REFRESH_ACTION,
  MARKET_DATA_PARSE_ACTION,
  MARKET_SNAPSHOT_SAVE_ACTION,
} from "@/lib/adminAuth";
import { cleanupExpiredNonces } from "@/lib/storage/adminAuth";
import { cleanupRateLimitCounters } from "@/lib/storage/rateLimit";

const ALLOWED_ACTIONS = new Set([
  ADMIN_AUDIT_ACTION,
  BOT_CONTROL_ACTION,
  CLAIM_LIST_PREVIEW_ACTION,
  LEADERBOARD_CONFIG_ACTION,
  LEADERBOARD_REFRESH_ACTION,
  MARKET_DATA_PARSE_ACTION,
  MARKET_SNAPSHOT_SAVE_ACTION,
]);

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }

  const ip = clientIp(req);
  if (!await checkRateLimit(`nonce:${ip}`, adminRateLimits.nonce)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const walletAddress = req.nextUrl.searchParams.get("walletAddress");
  if (walletAddress) {
    const normalizedWallet = walletAddress.toLowerCase().replace(/^0x/, "").slice(-64);
    if (!await checkRateLimit(`nonce:wallet:${normalizedWallet}`, adminRateLimits.nonce)) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }
  }

  void cleanupExpiredNonces().catch(() => {});
  void cleanupRateLimitCounters().catch(() => {});

  const domain = requestDomain(req);
  return NextResponse.json({
    action,
    domain,
    ...await createNonce(action, domain),
  });
}
