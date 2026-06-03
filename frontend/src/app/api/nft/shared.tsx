import { ImageResponse } from "next/og";
import {
  ASSET_NAMES as NAMES,
  ASSET_TICKERS as TICKERS,
  ASSET_CGK_IMG_ID_TO_PLAYER as CGK_ID_TO_PLAYER,
} from "@/config/assetUniverse";
import {
  NFT_CHEST_BADGE_BG,
  NFT_CHEST_BRAND_BORDER,
  NFT_CHEST_BRAND_TEXT,
  NFT_CHEST_FOOTER_GRADIENT,
  NFT_CHEST_IMAGE_SHADOW,
  NFT_CHEST_MUTED_TEXT,
  NFT_CHEST_RENDER_STYLES,
  NFT_DARK_SURFACE,
  NFT_INK,
  NFT_RARITY_STYLES,
  nftChestAccentRule,
} from "./palette";

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

export async function buildCardImageResponse(playerId: number, tier: number, origin = "https://escape.isgood.host"): Promise<Response> {
  if (playerId < 0 || playerId > 49) return new Response("Not found", { status: 404 });

  const ticker = TICKERS[playerId];
  const name   = NAMES[playerId];

  const ts = NFT_RARITY_STYLES[Math.min(Math.max(tier, 0), 3)];

  const eggUrl  = `${origin}/egg.png`;
  const coinUrl = `${origin}/coins/${playerId}_${ticker}.png`;

  return new ImageResponse(
    (
      <div style={{ width: 400, height: 400, background: ts.fill, display: "flex", flexDirection: "column", fontFamily: "sans-serif", border: `3px solid ${NFT_INK}`, overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 0" }}>
          <div style={{ background: ts.fill, color: NFT_INK, border: `2.5px solid ${NFT_INK}`, borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 800, letterSpacing: "0.15em", display: "flex" }}>
            {ts.label}
          </div>
          <div style={{ background: ts.fill, color: NFT_INK, border: `2.5px solid ${NFT_INK}`, borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", display: "flex" }}>
            HEAVYEGGS
          </div>
        </div>

        {/* egg + coin stacked via flex */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 200, height: 200 }}>
            {/* egg */}
            <img src={eggUrl} width={200} height={200} style={{ objectFit: "contain", display: "flex" }} alt="" />
          </div>
        </div>

        {/* coin overlay row — positioned using negative margin trick */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: -130 }}>
          <img src={coinUrl} width={68} height={68} style={{ objectFit: "contain", display: "flex" }} alt="" />
        </div>
        <div style={{ flex: 1 }} />

        {/* footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 16px 14px", borderTop: `2.5px solid ${NFT_INK}`, background: ts.fill, paddingTop: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: NFT_INK, display: "flex" }}>{name}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: NFT_INK, opacity: 0.5, letterSpacing: "0.14em", textTransform: "uppercase", display: "flex" }}>{ticker} · NFT</div>
        </div>
      </div>
    ),
    {
      width: 400,
      height: 400,
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}

export async function buildChestImageResponse(type: number, assetBase?: string): Promise<Response> {
  if (type < 0 || type > 2) return new Response("Not found", { status: 404 });

  const chest = NFT_CHEST_RENDER_STYLES[type];
  const assetUrl = `${getRenderableAssetBase(assetBase)}${chest.image}`;
  const imageSrc = await loadImageDataUrl(assetUrl);
  return new ImageResponse(
    (
      <div
        style={{
          width: 400,
          height: 400,
          background: NFT_DARK_SURFACE,
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
        <div style={{ position: "absolute", top: 16, left: 16, background: NFT_CHEST_BADGE_BG, border: `1px solid ${chest.border}66`, borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: chest.color, letterSpacing: "0.18em", display: "flex" }}>
          {chest.label}
        </div>
        <div style={{ position: "absolute", top: 16, right: 16, background: NFT_CHEST_BADGE_BG, border: `1px solid ${NFT_CHEST_BRAND_BORDER}`, borderRadius: 8, padding: "4px 12px", fontSize: 10, fontWeight: 700, color: NFT_CHEST_BRAND_TEXT, letterSpacing: "0.1em", display: "flex" }}>
          HEAVYEGGS
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
                filter: `drop-shadow(0 16px 28px ${NFT_CHEST_IMAGE_SHADOW}) drop-shadow(0 0 22px ${chest.glow})`,
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
            background: NFT_CHEST_FOOTER_GRADIENT,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: chest.color, letterSpacing: "0.08em", textTransform: "uppercase", textShadow: `0 0 20px ${chest.glow}`, display: "flex" }}>
            {chest.label}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: NFT_CHEST_MUTED_TEXT, letterSpacing: "0.18em", textTransform: "uppercase", display: "flex" }}>
            HEAVYEGGS EGG
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: nftChestAccentRule(chest.accent), display: "flex" }} />
      </div>
    ),
    {
      width: 400,
      height: 400,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
