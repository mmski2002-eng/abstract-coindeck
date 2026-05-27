import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { Ed25519PublicKey, Ed25519Signature } from "@aptos-labs/ts-sdk";
import {
  ADMIN_CHAIN_ID,
  ADMIN_NONCE_TTL_MS,
  buildAdminActionMessage,
  buildWalletFullMessage,
  normalizeAdminDomain,
  stableStringify,
} from "@/lib/adminAuth";
import { appendAuditEntry, consumeAdminNonce, createAdminNonce } from "@/lib/storage/adminAuth";
import { consumeRateLimit } from "@/lib/storage/rateLimit";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

const ADMIN_ADDRESS = getRuntimeProjectAddresses().adminAddress.toLowerCase();
const ADMIN_ADDRESSES: Set<string> = new Set(
  [
    ADMIN_ADDRESS,
    ...(process.env.ADMIN_ADDRESSES ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean),
  ]
);
const RATE_LIMIT_WINDOW_MS = Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS ?? "60000");
const RATE_LIMIT_MAX_POSTS = Number(process.env.ADMIN_RATE_LIMIT_MAX_POSTS ?? "10");
const RATE_LIMIT_MAX_NONCES = Number(process.env.ADMIN_RATE_LIMIT_MAX_NONCES ?? "20");
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "true";

type VerifyResult =
  | { ok: true; actor: string; authType: "wallet" | "secret" }
  | { ok: false; error: string };

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutPort = trimmed.startsWith("[")
    ? trimmed.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1")
    : trimmed.replace(/:\d+$/, "");
  if (!withoutPort || withoutPort.toLowerCase() === "unknown") return null;
  return withoutPort;
}

export function clientIp(req: NextRequest): string {
  const host = req.headers.get("host") ?? "";
  if (process.env.NODE_ENV !== "production" &&
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]"))) {
    return "local-dev";
  }

  const platformIp = normalizeIp(req.headers.get("x-vercel-forwarded-for"))
    ?? normalizeIp(req.headers.get("cf-connecting-ip"))
    ?? normalizeIp(req.headers.get("fly-client-ip"))
    ?? normalizeIp(req.headers.get("fastly-client-ip"))
    ?? normalizeIp(req.headers.get("x-real-ip"));
  if (platformIp) return platformIp;

  if (TRUST_PROXY_HEADERS) {
    const forwarded = req.headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0];
    const trustedIp = normalizeIp(first);
    if (trustedIp) return trustedIp;
  }

  return "unknown";
}

export function requestDomain(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost:3000";
  return normalizeAdminDomain(host);
}

export async function createNonce(action: string, domain: string) {
  return createAdminNonce(action, normalizeAdminDomain(domain), ADMIN_NONCE_TTL_MS, ADMIN_CHAIN_ID);
}

export async function checkRateLimit(bucket: string, limit: number): Promise<boolean> {
  return consumeRateLimit(bucket, limit, RATE_LIMIT_WINDOW_MS);
}

export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function checkSecretAuth(req: NextRequest): VerifyResult {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return { ok: false, error: "missing-admin-secret" };
  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (provided.length !== expected.length) return { ok: false, error: "invalid-secret-length" };
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return { ok: false, error: "invalid-secret" };
  }
  return { ok: true, actor: "bearer-secret", authType: "secret" };
}

export async function verifyAdminAction(
  req: NextRequest,
  body: Record<string, unknown>,
  action: string,
  expectedPayload: unknown,
): Promise<VerifyResult> {
  const auth = typeof body.auth === "object" && body.auth !== null ? body.auth as Record<string, unknown> : {};
  const signature = auth.signature;
  const publicKey = auth.publicKey;
  const fullMessage = auth.fullMessage;
  const nonce = auth.nonce;
  const timestamp = auth.timestamp;
  const domain = auth.domain;
  const chainId = auth.chainId;
  const signedAction = auth.action;
  const signedPayloadHash = auth.payloadHash;

  if (
    typeof signature !== "string" ||
    typeof publicKey !== "string" ||
    typeof fullMessage !== "string" ||
    typeof nonce !== "string" ||
    typeof timestamp !== "number" ||
    typeof domain !== "string" ||
    typeof chainId !== "number" ||
    typeof signedAction !== "string" ||
    typeof signedPayloadHash !== "string"
  ) {
    return { ok: false, error: "invalid-auth-shape" };
  }

  const normalizedDomain = requestDomain(req);
  if (normalizeAdminDomain(domain) !== normalizedDomain) {
    return { ok: false, error: "domain-mismatch" };
  }

  const origin = req.headers.get("origin");
  if (origin && normalizeAdminDomain(origin) !== normalizedDomain) {
    return { ok: false, error: "origin-mismatch" };
  }

  if (signedAction !== action) {
    return { ok: false, error: "action-mismatch" };
  }
  if (chainId !== ADMIN_CHAIN_ID) {
    return { ok: false, error: "chain-id-mismatch" };
  }
  if (Date.now() - timestamp > ADMIN_NONCE_TTL_MS || timestamp - Date.now() > 30_000) {
    return { ok: false, error: "stale-timestamp" };
  }

  const expectedHash = payloadHash(expectedPayload);
  if (signedPayloadHash !== expectedHash) {
    return { ok: false, error: "payload-hash-mismatch" };
  }

  const expectedMessage = buildAdminActionMessage({
    domain: normalizedDomain,
    chainId,
    action,
    timestamp,
    nonce,
    payloadHash: expectedHash,
  });
  const expectedFullMessage = buildWalletFullMessage(expectedMessage, nonce);
  if (fullMessage !== expectedFullMessage) {
    return { ok: false, error: "unexpected-full-message" };
  }

  try {
    const pub = new Ed25519PublicKey(publicKey);
    const sig = new Ed25519Signature(signature);
    if (!pub.verifySignature({ message: Buffer.from(fullMessage), signature: sig })) {
      return { ok: false, error: "invalid-signature" };
    }
    const actor = pub.authKey().toString().toLowerCase();
    if (!ADMIN_ADDRESSES.has(actor)) {
      return { ok: false, error: `wrong-admin-address:got=${actor}` };
    }
    if (!await consumeAdminNonce(nonce, action, normalizedDomain)) {
      return { ok: false, error: "invalid-or-used-nonce" };
    }
    return { ok: true, actor, authType: "wallet" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `signature-verify-failed:${message}` };
  }
}

export async function appendAuditLog(entry: Record<string, unknown>) {
  await appendAuditEntry(String(entry.scope ?? "admin"), { ...entry, at: new Date().toISOString() });
}

export const adminRateLimits = {
  nonce: RATE_LIMIT_MAX_NONCES,
  post: RATE_LIMIT_MAX_POSTS,
};
