import { NextRequest } from "next/server";

const CHESTS = [
  { label: "Small",  fill: "#D9D3C2" },
  { label: "Medium", fill: "#7AC7E8" },
  { label: "Heavy",  fill: "#26C6A8" },
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const type = Number(slug?.[0]);
  if (isNaN(type) || type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const proto  = req.headers.get("x-forwarded-proto") ?? "https";
  const host   = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;
  const chest  = CHESTS[type];

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${chest.fill};display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:Impact,sans-serif}
.dots{position:fixed;inset:0;background-image:radial-gradient(rgba(0,0,0,.18) 1px,transparent 1px);background-size:14px 14px;pointer-events:none}
.card{width:300px;height:390px;background:${chest.fill};border:3px solid #000;box-shadow:6px 6px 0 #000;display:flex;flex-direction:column;position:relative;overflow:hidden}
.header{padding:12px 14px 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:3}
.rarity{font-size:12px;font-weight:900;letter-spacing:.08em;color:#000;text-transform:uppercase;background:rgba(255,255,255,.55);border:2px solid #000;border-radius:6px;padding:3px 10px;box-shadow:2px 2px 0 #000}
.brand{font-size:14px;font-weight:900;color:#000;letter-spacing:.04em;-webkit-text-stroke:.5px #000;text-shadow:2px 2px 0 rgba(0,0,0,.15)}
.art{flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
.egg-wrap{position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center;animation:float 3s ease-in-out infinite}
.glow{position:absolute;inset:-25px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.75) 0%,rgba(255,255,255,.2) 40%,transparent 70%);animation:pulse 3s ease-in-out infinite}
.egg{width:160px;height:160px;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(0 0 14px rgba(255,255,255,.9)) drop-shadow(0 0 28px rgba(255,255,255,.5))}
.star{position:absolute;background:#fff;border-radius:50%;animation:twinkle var(--d,2s) ease-in-out infinite var(--del,0s)}
.footer{padding:10px 14px 13px;border-top:2.5px solid #000;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:3;background:rgba(0,0,0,.07)}
.fname{font-size:17px;font-weight:900;color:#000;letter-spacing:-.2px}
.badge{font-size:11px;font-weight:900;color:#000;letter-spacing:.12em;text-transform:uppercase;border:2px solid #000;border-radius:5px;padding:2px 9px;background:rgba(255,255,255,.45);box-shadow:2px 2px 0 #000}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes pulse{0%,100%{opacity:.5;transform:scale(.95)}50%{opacity:.9;transform:scale(1.08)}}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1)}}
</style>
</head>
<body>
<div class="dots"></div>
<div class="card">
  <div class="header">
    <div class="rarity">${chest.label}</div>
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
      <img class="egg" src="${origin}/egg2.webp" alt="${chest.label}"/>
    </div>
  </div>
  <div class="footer">
    <div class="fname">${chest.label} Egg</div>
    <div class="badge">NFT</div>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=3600" },
  });
}
