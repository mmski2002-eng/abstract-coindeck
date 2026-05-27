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
} from "../auth";
import { ADMIN_AUDIT_ACTION } from "@/lib/adminAuth";
import { readAuditEntries } from "@/lib/storage/adminAuth";

function normalizePayload(body: Record<string, unknown>) {
  const limit = Math.min(100, Math.max(1, Number(body.limit ?? 25)));
  return { limit };
}

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const payload = normalizePayload(body);
  const ip = clientIp(req);
  if (!await checkRateLimit(`audit:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const secretAuth = checkSecretAuth(req);
  const walletAuth = secretAuth.ok
    ? secretAuth
    : await verifyAdminAction(req, body, ADMIN_AUDIT_ACTION, payload);
  if (!walletAuth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recent = await readAuditEntries(payload.limit);
    await appendAuditLog({
      scope: "admin-audit-read",
      actor: walletAuth.actor,
      authType: walletAuth.authType,
      ip,
      domain: requestDomain(req),
      payload,
    });
    return NextResponse.json({ entries: recent });
  } catch (error) {
    return serverErrorResponse("admin-audit-read", error);
  }
}
