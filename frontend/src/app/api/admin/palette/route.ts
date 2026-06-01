import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { verifyAdminAction, clientIp, checkRateLimit, adminRateLimits, appendAuditLog } from "../auth";
import { PALETTE_ACTION } from "@/lib/adminAuth";

const DATA_DIR = join(process.cwd(), "data");
const PALETTE_FILE = join(DATA_DIR, "palette.json");

type ThemeVars = Record<string, string>;
type PaletteData = { light: ThemeVars; dark: ThemeVars };

async function readPalette(): Promise<PaletteData> {
  try {
    const raw = await readFile(PALETTE_FILE, "utf-8");
    return JSON.parse(raw) as PaletteData;
  } catch {
    return { light: {}, dark: {} };
  }
}

export async function GET() {
  return NextResponse.json(await readPalette());
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!await checkRateLimit(`admin-post:${ip}`, adminRateLimits.post)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const light = (body.light ?? {}) as ThemeVars;
  const dark = (body.dark ?? {}) as ThemeVars;
  const payload = { light, dark };

  const result = await verifyAdminAction(req, body, PALETTE_ACTION, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PALETTE_FILE, JSON.stringify(payload, null, 2), "utf-8");
  await appendAuditLog({ scope: "palette", action: PALETTE_ACTION, actor: result.actor });

  return NextResponse.json({ ok: true });
}
