import { ImageResponse } from "next/og";
import {
  ASSET_NAMES as NAMES,
  ASSET_TICKERS as TICKERS,
  ASSET_BRAND_COLORS as BRAND,
  ASSET_CGK_BASE_URL as CGK,
  ASSET_CGK_SLUGS as CGK_SLUGS,
  ASSET_CGK_IMG_ID_TO_PLAYER as CGK_ID_TO_PLAYER,
} from "@/config/assetUniverse";

const CHESTS = [
  {
    name: "Wooden Chest",
    label: "WOODEN",
    bg: "linear-gradient(180deg,rgba(120,80,40,0.35),rgba(10,12,24,0.1))",
    glow: "rgba(160,100,50,0.5)",
    border: "#8B5E2F",
    color: "#D4A574",
    accent: "#C4924A",
    image: "/chests/wooden_closed.png",
  },
  {
    name: "Iron Chest",
    label: "IRON",
    bg: "linear-gradient(180deg,rgba(90,110,130,0.35),rgba(10,12,24,0.1))",
    glow: "rgba(100,130,160,0.5)",
    border: "#5A7A9A",
    color: "#8BB8D4",
    accent: "#7AAAC4",
    image: "/chests/iron_closed.png",
  },
  {
    name: "Silver Chest",
    label: "SILVER",
    bg: "linear-gradient(180deg,rgba(160,160,180,0.35),rgba(10,12,24,0.1))",
    glow: "rgba(180,180,210,0.5)",
    border: "#9090B0",
    color: "#C8C8E8",
    accent: "#B0B0D0",
    image: "/chests/silver_closed.png",
  },
];

export function getPlayerIdFromCoinGeckoId(cgkId: number): number {
  return (!Number.isNaN(cgkId) && cgkId > 0) ? (CGK_ID_TO_PLAYER[cgkId] ?? -1) : -1;
}

export function getPlayerIdFromCardPath(pathname: string): number {
  return getPlayerIdFromCoinGeckoId(Number(pathname.split("/")[4]));
}

export function getChestTypeFromPath(pathname: string): number {
  const lower = decodeURIComponent(pathname).toLowerCase();
  if (lower.includes("wooden")) return 0;
  if (lower.includes("iron")) return 1;
  if (lower.includes("silver")) return 2;
  return -1;
}

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { cache: "force-cache" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function getRenderableAssetBase(assetBase?: string): string {
  const normalized = assetBase?.replace(/\/$/, "");
  if (normalized && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(normalized)) {
    return normalized;
  }
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}

export function buildCardImageResponse(playerId: number, tier: number): Response {
  if (playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });

  const ticker = TICKERS[playerId];
  const name = NAMES[playerId];
  const brand = BRAND[playerId];
  const coinImageUrl = CGK + CGK_SLUGS[playerId];
  const tickerSize = ticker.length <= 3 ? 72 : ticker.length <= 4 ? 58 : 46;
  const tierColors = [
    { color: "#9CA3AF", label: "COMMON", grad: "rgba(156,163,175,0.22)" },
    { color: "#60A5FA", label: "RARE", grad: "rgba(59,130,246,0.28)" },
    { color: "#C084FC", label: "EPIC", grad: "rgba(168,85,247,0.30)" },
    { color: "#FBBF24", label: "LEGENDARY", grad: "rgba(245,158,11,0.34)" },
  ];
  const tc = tierColors[Math.min(Math.max(tier, 0), 3)];

  return new ImageResponse(
    (
      <div
        style={{
          width: 400,
          height: 400,
          background: "#0a0c18",
          borderRadius: 24,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          border: `2px solid ${tc.color}88`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${tc.grad}, rgba(10,12,24,0.1))`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 50%, ${brand}22, transparent 70%)` }} />

        <div
          style={{
            height: 52,
            padding: "14px 14px 0 14px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ background: "rgba(0,0,0,0.55)", border: `1px solid ${tc.color}77`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: tc.color, letterSpacing: "0.18em", display: "flex" }}>
            {tc.label}
          </div>
          <div style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", display: "flex" }}>
            MOVEINVESTOR
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            zIndex: 1,
            paddingTop: 6,
            paddingBottom: 22,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 252,
              height: 252,
              borderRadius: "50%",
              border: `1.5px dashed ${brand}44`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -58%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 184,
              height: 184,
              borderRadius: "50%",
              border: `1px solid ${brand}28`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -58%)",
            }}
          />
          <img
            src={coinImageUrl}
            width={188}
            height={188}
            style={{
              position: "absolute",
              objectFit: "contain",
              opacity: 0.24,
              filter: "blur(5px)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -58%)",
            }}
            alt=""
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -58%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 180,
              minHeight: 110,
              padding: "0 22px",
              background: `radial-gradient(circle, ${brand}18 0%, rgba(10,12,24,0.18) 62%, transparent 100%)`,
              borderRadius: 999,
              boxShadow: `0 0 48px ${brand}22`,
            }}
          >
            <span style={{ fontSize: tickerSize, fontWeight: 900, color: brand, letterSpacing: "-2px", lineHeight: 1, textShadow: `0 0 40px ${brand}99, 0 4px 24px rgba(0,0,0,0.8)`, display: "flex" }}>
              {ticker}
            </span>
          </div>
        </div>

        <div
          style={{
            height: 88,
            padding: "0 16px 14px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 4,
            position: "relative",
            zIndex: 1,
            background: "linear-gradient(180deg, rgba(10,12,24,0) 0%, rgba(10,12,24,0.74) 24%, rgba(10,12,24,0.96) 100%)",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: tc.color, letterSpacing: "-0.5px", display: "flex" }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", letterSpacing: "0.14em", textTransform: "uppercase", display: "flex" }}>
            {ticker} · NFT Card
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${tc.color}, transparent)` }} />
      </div>
    ),
    {
      width: 400,
      height: 400,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}

export async function buildChestImageResponse(type: number, assetBase?: string): Promise<Response> {
  if (type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const chest = CHESTS[type];
  const assetUrl = `${getRenderableAssetBase(assetBase)}${chest.image}`;
  const imageSrc = await loadImageDataUrl(assetUrl);
  return new ImageResponse(
    (
      <div
        style={{
          width: 400,
          height: 400,
          background: "#0a0c18",
          borderRadius: 28,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          border: `2px solid ${chest.border}88`,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 42%, ${chest.glow}33, transparent 66%)`, display: "flex" }} />
        <div style={{ position: "absolute", inset: 0, background: chest.bg, display: "flex" }} />
        <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.6)", border: `1px solid ${chest.border}66`, borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: chest.color, letterSpacing: "0.18em", display: "flex" }}>
          {chest.label}
        </div>
        <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", display: "flex" }}>
          MOVEINVESTOR
        </div>
        <div
          style={{
            flex: 1,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            paddingTop: 34,
            paddingBottom: 24,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 210,
              height: 210,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${chest.glow}22 0%, transparent 72%)`,
              filter: "blur(14px)",
            }}
          />
          {imageSrc ? (
            <img
              src={imageSrc}
              width={200}
              height={200}
              style={{
                objectFit: "contain",
                display: "flex",
                filter: `drop-shadow(0 16px 28px rgba(0,0,0,0.45)) drop-shadow(0 0 22px ${chest.glow})`,
              }}
              alt=""
            />
          ) : null}
        </div>
        <div
          style={{
            width: "100%",
            padding: "0 16px 16px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 6,
            background: "linear-gradient(180deg, rgba(10,12,24,0) 0%, rgba(10,12,24,0.7) 24%, rgba(10,12,24,0.96) 100%)",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: chest.color, letterSpacing: "0.08em", textTransform: "uppercase", textShadow: `0 0 20px ${chest.glow}`, display: "flex" }}>
            {chest.label}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.42)", letterSpacing: "0.18em", textTransform: "uppercase", display: "flex" }}>
            MOVEINVESTOR CHEST
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${chest.accent}, transparent)`, display: "flex" }} />
      </div>
    ),
    {
      width: 400,
      height: 400,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
