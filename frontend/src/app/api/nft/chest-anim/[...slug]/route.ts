import { NextRequest } from "next/server";

const CHESTS = [
  { name: "Small Egg",  fill: "#D9D3C2", glow: "#C8AA80" },
  { name: "Medium Egg", fill: "#7AC7E8", glow: "#5BAFD0" },
  { name: "Large Egg",  fill: "#26C6A8", glow: "#1AAA8E" },
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const type = Number(slug?.[0]);
  if (isNaN(type) || type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "escape.isgood.host";
  const origin = `${proto}://${host}`;

  const chest = CHESTS[type];

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
    background:radial-gradient(circle,${chest.glow}44 0%,transparent 70%);
    animation:pulse 2.4s ease-in-out infinite;
  }
  .egg{
    width:130px;height:130px;object-fit:contain;position:relative;z-index:1;
    animation:float 3s ease-in-out infinite;
    filter:drop-shadow(0 8px 24px ${chest.glow}88);
  }
  .badge{
    position:absolute;bottom:-32px;left:50%;transform:translateX(-50%);
    background:${chest.fill}22;border:1px solid ${chest.fill}99;
    border-radius:8px;padding:4px 14px;
    font-size:11px;font-weight:700;color:${chest.fill};letter-spacing:.18em;
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
    <img class="egg" src="${origin}/egg2.webp" alt="${chest.name}"/>
    <div class="badge">${chest.name.toUpperCase()}</div>
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
