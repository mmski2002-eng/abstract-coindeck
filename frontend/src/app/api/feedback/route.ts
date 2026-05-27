import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { clientIp } from "../admin/auth";
import { serverErrorResponse } from "../_lib/errors";
import { appendFeedback, feedbackStorageFull } from "@/lib/storage/feedback";
import { consumeRateLimit } from "@/lib/storage/rateLimit";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const ip = clientIp(req);
  const ipHash = ip === "unknown" ? "unknown" : hashIp(ip);

  if (ip === "unknown" || !await consumeRateLimit(`feedback:${ipHash}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: { text?: string; rating?: number; name?: string; wallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.text || body.text.trim().length === 0) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  if (await feedbackStorageFull()) {
    return NextResponse.json({ error: "feedback storage full" }, { status: 503 });
  }

  const entry = {
    ts: new Date().toISOString(),
    ip: ipHash,
    rating: body.rating ?? null,
    name: body.name?.trim().slice(0, 50) || null,
    wallet: body.wallet?.trim().slice(0, 70) || null,
    text: body.text.trim().slice(0, 1000),
  };

  try {
    await appendFeedback(entry);
  } catch (error) {
    return serverErrorResponse("feedback", error);
  }

  return NextResponse.json({ ok: true });
}
