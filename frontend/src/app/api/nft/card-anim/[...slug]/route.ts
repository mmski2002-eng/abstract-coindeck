import { NextRequest } from "next/server";
import {
  ASSET_TICKERS as TICKERS,
  ASSET_NAMES as NAMES,
} from "@/config/assetUniverse";

const TIER_LABELS  = ["COMMON",  "RARE",    "EPIC",    "LEGENDARY"];
const TIER_COLORS  = ["#9CA3AF", "#60A5FA", "#C084FC", "#FBBF24"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const playerId = Number(slug?.[0]);
  const tier     = Number(slug?.[1] ?? 0);
  if (isNaN(playerId) || playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });
  if (isNaN(tier)     || tier     < 0 || tier     > 3)  return new Response("Not found", { status: 404 });

  const ticker    = TICKERS[playerId];
  const name      = NAMES[playerId];
  const tierColor = TIER_COLORS[tier] ?? "#9CA3AF";
  const tierLabel = TIER_LABELS[tier] ?? "COMMON";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  const TIER_FILLS = ["#D9D3C2", "#7AC7E8", "#26C6A8", "#FFB800"];
  const fill = TIER_FILLS[tier] ?? "#D9D3C2";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#e8e4d8;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:sans-serif}
  .card{
    width:300px;height:390px;background:${fill};
    display:flex;flex-direction:column;position:relative;
    border:3px solid #0F1115;
    box-shadow:6px 6px 0 #0F1115;
    overflow:hidden;
    animation:cardFloat 4s ease-in-out infinite;
  }
  .dots{position:absolute;inset:0;background-image:radial-gradient(#0F111522 1.2px,transparent 1.4px);background-size:14px 14px}
  .header{height:44px;padding:11px 12px 0;display:flex;align-items:flex-start;justify-content:space-between;position:relative;z-index:2}
  .badge,.tag{background:${fill};color:#0F1115;border:2.5px solid #0F1115;border-radius:999px;box-shadow:2px 2px 0 #0F1115;font-weight:800;letter-spacing:.15em}
  .badge{padding:4px 11px;font-size:10px}
  .tag{padding:4px 11px;font-size:9px}
  .art{flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
  .egg-wrap{position:relative;width:180px;height:180px;display:flex;align-items:center;justify-content:center;animation:eggFloat 3s ease-in-out infinite}
  .egg{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 18px rgba(0,0,0,0.2))}
  .coin{position:absolute;width:63px;height:63px;object-fit:contain;top:50%;left:50%;transform:translate(-50%,-50%)}
  .footer{height:74px;padding:0 14px 12px;display:flex;flex-direction:column;justify-content:flex-end;gap:3px;position:relative;z-index:2;border-top:2.5px solid #0F1115;background:${fill}}
  .fname{font-size:19px;font-weight:800;color:#0F1115;letter-spacing:-.3px}
  .fsub{font-size:10px;font-weight:700;color:#0F1115;opacity:.5;letter-spacing:.14em;text-transform:uppercase}
  @keyframes cardFloat{0%,100%{transform:translateY(0) rotate(-.3deg)}50%{transform:translateY(-10px) rotate(.3deg)}}
  @keyframes eggFloat{
    0%  {transform:translateY(0) rotate(0deg)}
    20% {transform:translateY(-8px) rotate(-.5deg)}
    40% {transform:translateY(0) rotate(0deg)}
    60% {transform:translateY(0) rotate(0deg)}
    62% {transform:translateY(0) rotate(-6deg)}
    64% {transform:translateY(-4px) rotate(7deg)}
    66% {transform:translateY(0) rotate(-5deg)}
    68% {transform:translateY(-3px) rotate(6deg)}
    70% {transform:translateY(0) rotate(-4deg)}
    72% {transform:translateY(-2px) rotate(3deg)}
    74% {transform:translateY(0) rotate(0deg)}
    87% {transform:translateY(-8px) rotate(-.5deg)}
    100%{transform:translateY(0) rotate(0deg)}
  }
</style>
</head>
<body>
<div class="card">
  <div class="dots"></div>
  <div class="header">
    <div class="badge">${tierLabel}</div>
    <div class="tag">COINDECK</div>
  </div>
  <div class="art">
    <div class="egg-wrap">
      <img class="egg" src="${origin}/egg.webp" alt=""/>
      <img class="coin" src="${origin}/coins/${playerId}_${ticker}.webp" alt=""/>
    </div>
  </div>
  <div class="footer">
    <div class="fname">${name}</div>
    <div class="fsub">${ticker} · NFT</div>
  </div>
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
