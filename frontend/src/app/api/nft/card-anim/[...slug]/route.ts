import { NextRequest } from "next/server";
import { ASSET_TICKERS as TICKERS, ASSET_NAMES as NAMES } from "@/config/assetUniverse";
import {
  NFT_DOT_PATTERN,
  NFT_EGG_DROP_SOFT,
  NFT_EGG_DROP_STRONG,
  NFT_EGG_GLOW,
  NFT_EGG_GLOW_MID,
  NFT_FOOTER_SHADE,
  NFT_INK,
  NFT_LIGHT_GLASS,
  NFT_LIGHT_GLASS_SOFT,
  NFT_RARITY_STYLES,
  NFT_SHADOW_SOFT,
} from "../../palette";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const playerId = Number(slug?.[0]);
  const tier     = Number(slug?.[1] ?? 0);
  if (isNaN(playerId) || playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });
  if (isNaN(tier)     || tier     < 0 || tier     > 3)  return new Response("Not found", { status: 404 });

  const ticker = TICKERS[playerId];
  const name   = NAMES[playerId];
  const style  = NFT_RARITY_STYLES[tier];
  const fill   = style.fill;
  const label  = style.display;
  const proto  = req.headers.get("x-forwarded-proto") ?? "https";
  const host   = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${fill};display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:Impact,sans-serif}
.dots{position:fixed;inset:0;background-image:radial-gradient(${NFT_DOT_PATTERN} 1px,transparent 1px);background-size:14px 14px;pointer-events:none}
.card{width:300px;height:390px;background:${fill};border:3px solid ${NFT_INK};box-shadow:6px 6px 0 ${NFT_INK};display:flex;flex-direction:column;position:relative;overflow:hidden}
.header{padding:12px 14px 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:3}
.rarity{font-size:12px;font-weight:900;letter-spacing:.08em;color:${NFT_INK};text-transform:uppercase;background:${NFT_LIGHT_GLASS};border:2px solid ${NFT_INK};border-radius:6px;padding:3px 10px;box-shadow:2px 2px 0 ${NFT_INK}}
.brand{font-size:14px;font-weight:900;color:${NFT_INK};letter-spacing:.04em;-webkit-text-stroke:.5px ${NFT_INK};text-shadow:2px 2px 0 ${NFT_SHADOW_SOFT}}
.art{flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
.egg-wrap{position:relative;width:190px;height:190px;display:flex;align-items:center;justify-content:center;animation:float 3s ease-in-out infinite}
.glow{position:absolute;inset:-25px;border-radius:50%;background:radial-gradient(circle,${NFT_EGG_GLOW} 0%,${NFT_EGG_GLOW_MID} 40%,transparent 70%);animation:pulse 3s ease-in-out infinite}
.egg{width:145px;height:145px;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(0 0 14px ${NFT_EGG_DROP_STRONG}) drop-shadow(0 0 28px ${NFT_EGG_DROP_SOFT})}
.coin{position:absolute;width:62px;height:62px;object-fit:contain;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3}
.star{position:absolute;background:#fff;border-radius:50%;animation:twinkle var(--d,2s) ease-in-out infinite var(--del,0s)}
.footer{padding:10px 14px 13px;border-top:2.5px solid ${NFT_INK};display:flex;justify-content:space-between;align-items:center;position:relative;z-index:3;background:${NFT_FOOTER_SHADE}}
.fname{font-size:17px;font-weight:900;color:${NFT_INK};letter-spacing:-.2px}
.ticker-badge{font-size:11px;font-weight:900;color:${NFT_INK};letter-spacing:.12em;text-transform:uppercase;border:2px solid ${NFT_INK};border-radius:5px;padding:2px 9px;background:${NFT_LIGHT_GLASS_SOFT};box-shadow:2px 2px 0 ${NFT_INK}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes pulse{0%,100%{opacity:.5;transform:scale(.95)}50%{opacity:.9;transform:scale(1.08)}}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1)}}
</style>
</head>
<body>
<div class="dots"></div>
<div class="card">
  <div class="header">
    <div class="rarity">${label}</div>
    <div class="brand">HeavyEggs</div>
  </div>
  <div class="art">
    <div class="star" style="width:3px;height:3px;top:10%;left:10%;--d:2.1s;--del:-0.3s"></div>
    <div class="star" style="width:2px;height:2px;top:18%;right:12%;--d:1.7s;--del:-1.1s"></div>
    <div class="star" style="width:4px;height:4px;top:25%;left:20%;--d:2.5s;--del:-0.7s"></div>
    <div class="star" style="width:2px;height:2px;top:30%;right:18%;--d:1.9s;--del:-1.6s"></div>
    <div class="star" style="width:3px;height:3px;top:60%;left:8%;--d:2.3s;--del:-0.4s"></div>
    <div class="star" style="width:2px;height:2px;top:65%;right:10%;--d:2.0s;--del:-1.3s"></div>
    <div class="star" style="width:4px;height:4px;top:75%;left:22%;--d:1.8s;--del:-0.9s"></div>
    <div class="star" style="width:3px;height:3px;top:72%;right:20%;--d:2.4s;--del:-0.2s"></div>
    <div class="egg-wrap">
      <div class="glow"></div>
      <img class="egg" src="${origin}/egg.webp" alt=""/>
      <img class="coin" src="${origin}/coins/${playerId}_${ticker}.webp" alt=""/>
    </div>
  </div>
  <div class="footer">
    <div class="fname">${name}</div>
    <div class="ticker-badge">${ticker}</div>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=3600" },
  });
}
