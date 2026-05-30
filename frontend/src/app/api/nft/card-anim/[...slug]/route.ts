import { NextRequest } from "next/server";
import {
  ASSET_TICKERS as TICKERS,
  ASSET_BRAND_COLORS as BRAND,
} from "@/config/assetUniverse";

const TIER_LABELS = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
const TIER_COLORS = ["#9CA3AF", "#60A5FA", "#C084FC", "#FBBF24"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const playerId = Number(slug?.[0]);
  const tier = Number(slug?.[1] ?? 0);
  if (isNaN(playerId) || playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });
  if (isNaN(tier) || tier < 0 || tier > 3) return new Response("Not found", { status: 404 });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  const ticker = TICKERS[playerId];
  const brand = BRAND[playerId] ?? "#6B7280";
  const tierColor = TIER_COLORS[tier] ?? "#9CA3AF";
  const tierLabel = TIER_LABELS[tier] ?? "COMMON";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    width:100vw;height:100vh;
    background:#0a0c18;
    display:flex;align-items:center;justify-content:center;
    overflow:hidden;font-family:sans-serif;
  }
  .wrap{position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center;}
  .glow{
    position:absolute;width:160px;height:160px;border-radius:50%;
    background:radial-gradient(circle,${brand}44 0%,transparent 70%);
    animation:pulse 2.4s ease-in-out infinite;
  }
  .egg{
    width:120px;height:120px;object-fit:contain;position:relative;z-index:1;
    animation:float 3s ease-in-out infinite;
    filter:drop-shadow(0 8px 24px ${brand}66);
  }
  .badge{
    position:absolute;bottom:-32px;left:50%;transform:translateX(-50%);
    background:${tierColor}22;border:1px solid ${tierColor}88;
    border-radius:8px;padding:4px 14px;
    font-size:11px;font-weight:700;color:${tierColor};letter-spacing:.18em;
    white-space:nowrap;
  }
  @keyframes float{
    0%,100%{transform:translateY(0)}
    50%{transform:translateY(-18px)}
  }
  @keyframes pulse{
    0%,100%{opacity:.6;transform:scale(1)}
    50%{opacity:1;transform:scale(1.12)}
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="glow"></div>
    <img class="egg" src="${origin}/egg.webp" alt="${ticker}"/>
    <div class="badge">${ticker} · ${tierLabel}</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
