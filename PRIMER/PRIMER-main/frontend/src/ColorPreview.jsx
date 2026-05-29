import { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  TrendingUp,
  TrendingDown,
  Send,
  Zap,
  ArrowRight,
  Box,
  Shield,
  Sparkles,
  Crown,
  Wallet,
  Plus,
  Search,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Design tokens (sticker-style, blue-green Abstract)                        */
/* -------------------------------------------------------------------------- */
const THEMES = {
  light: {
    "--paper": "#F4EFE2",
    "--paper-2": "#FBF7EC",
    "--paper-3": "#FFFFFF",
    "--sunken": "#E9E2D1",
    "--ink-2": "#3A4049",
    "--ink-3": "#7A828D",
  },
  dark: {
    "--paper": "#0E141A",
    "--paper-2": "#141B23",
    "--paper-3": "#1B232C",
    "--sunken": "#0A0F14",
    "--ink-2": "#E8EEF5",
    "--ink-3": "#9AA3AE",
  },
};

const SHARED = {
  "--mint": "#26C6A8",
  "--mint-deep": "#1DA88E",
  "--mint-soft": "#BFEDE2",
  "--sky": "#7AC7E8",
  "--sky-deep": "#4DAFD5",
  "--sky-soft": "#DCEEF7",
  "--lime-pop": "#88FC00",
  "--ink": "#0F1115",
  "--up": "#23A86A",
  "--down": "#E25C5C",
  "--warn": "#F2B73A",
  "--info": "#4DAFD5",
  "--rarity-common": "#D9D3C2",
  "--rarity-rare": "#7AC7E8",
  "--rarity-epic": "#26C6A8",
  "--rarity-legendary": "#88FC00",
  "--ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",
};

/* -------------------------------------------------------------------------- */
/*  Mock data                                                                 */
/* -------------------------------------------------------------------------- */
const TICKER = [
  { sym: "BTC", price: "104,238.50", chg: 2.41 },
  { sym: "ETH", price: "3,612.18", chg: -1.12 },
  { sym: "SOL", price: "228.04", chg: 4.85 },
  { sym: "ABS", price: "0.82", chg: 6.10 },
];

const CHESTS = [
  { name: "Сундук Хомяка", tier: "COMMON", price: "0.012 ETH", icon: Box },
  { name: "Сундук Медведя", tier: "RARE", price: "0.048 ETH", icon: Shield },
  { name: "Сундук Быка", tier: "EPIC", price: "0.120 ETH", icon: Sparkles },
  { name: "Сундук Дракона", tier: "LEGENDARY", price: "0.480 ETH", icon: Crown },
];

const FILTERS = ["BOX", "LAYER 1", "EXCHANGE", "MEME", "INFRA", "DEFI", "LAYER 2"];

const NFTS = [
  { name: "XRP",      chain: "XRPL",    tier: "COMMON",    progress: [2, 5], isNew: false, symbol: "X" },
  { name: "Ethereum", chain: "POS",     tier: "RARE",      progress: [3, 5], isNew: true,  symbol: "Ξ" },
  { name: "Arbitrum", chain: "ROLLUP",  tier: "EPIC",      progress: [4, 5], isNew: false, symbol: "A" },
  { name: "Dogecoin", chain: "MEME",    tier: "LEGENDARY", progress: [5, 5], isNew: true,  symbol: "Ð" },
];

const RARITY = {
  COMMON:    { fill: "var(--rarity-common)",    label: "COMMON",    icon: Box },
  RARE:      { fill: "var(--rarity-rare)",      label: "RARE",      icon: Shield },
  EPIC:      { fill: "var(--rarity-epic)",      label: "EPIC",      icon: Sparkles },
  LEGENDARY: { fill: "var(--rarity-legendary)", label: "LEGENDARY", icon: Crown },
};

/* -------------------------------------------------------------------------- */
/*  Reusable building blocks                                                  */
/* -------------------------------------------------------------------------- */
const INK_BORDER = "2.5px solid var(--ink)";
const STICKER_SHADOW = "4px 4px 0 var(--ink)";
const STICKER_SHADOW_SM = "2px 2px 0 var(--ink)";

// Generic "sticker card" wrapper
const Sticker = ({ children, style, testid, color = "var(--paper-2)", shadow = STICKER_SHADOW }) => (
  <div
    data-testid={testid}
    style={{
      background: color,
      border: INK_BORDER,
      borderRadius: 18,
      boxShadow: shadow,
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ kicker, title, sub }) => (
  <div style={{ marginBottom: 22 }}>
    <div
      style={{
        display: "inline-block",
        background: "var(--ink)",
        color: "var(--lime-pop)",
        padding: "4px 10px",
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        fontWeight: 700,
        borderRadius: 6,
        transform: "rotate(-1deg)",
        marginBottom: 10,
      }}
    >
      {kicker}
    </div>
    <h2
      style={{
        margin: 0,
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: -0.5,
        color: "var(--ink-2)",
        lineHeight: 1.1,
      }}
    >
      {title}
    </h2>
    {sub && (
      <p style={{ color: "var(--ink-3)", marginTop: 8, fontSize: 14, maxWidth: 620 }}>{sub}</p>
    )}
  </div>
);

/* Penguin-style logo mark (SVG, sticker outline) ------------------------- */
const PenguinMark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* shadow */}
    <rect x="6" y="8" width="52" height="52" rx="14" fill="var(--ink)" />
    {/* body */}
    <rect x="3" y="5" width="52" height="52" rx="14" fill="var(--mint)" stroke="var(--ink)" strokeWidth="3" />
    {/* belly */}
    <ellipse cx="29" cy="36" rx="13" ry="15" fill="var(--paper-3)" stroke="var(--ink)" strokeWidth="2.5" />
    {/* eyes */}
    <circle cx="24" cy="26" r="2.6" fill="var(--ink)" />
    <circle cx="34" cy="26" r="2.6" fill="var(--ink)" />
    {/* beak */}
    <path d="M27 32 L31 32 L29 35 Z" fill="var(--lime-pop)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  Buttons                                                                   */
/* -------------------------------------------------------------------------- */
const StickerButton = ({
  children,
  variant = "primary",
  size = "md",
  testid,
  iconOnly = false,
  style,
}) => {
  const palette = {
    primary:   { bg: "var(--mint)",    fg: "var(--ink)", border: "var(--ink)",  shadow: STICKER_SHADOW },
    secondary: { bg: "var(--sky)",     fg: "var(--ink)", border: "var(--ink)",  shadow: STICKER_SHADOW },
    outline:   { bg: "var(--paper-3)", fg: "var(--ink-2)", border: "var(--ink)",  shadow: STICKER_SHADOW },
    ghost:     { bg: "transparent",    fg: "var(--ink-2)", border: "transparent", shadow: "none" },
    destructive: { bg: "var(--paper-3)", fg: "var(--down)", border: "var(--down)", shadow: "4px 4px 0 var(--down)" },
    lime:      { bg: "var(--lime-pop)", fg: "var(--ink)", border: "var(--ink)",  shadow: STICKER_SHADOW },
  }[variant];

  const pad = iconOnly
    ? { padding: size === "sm" ? "8px" : "10px" }
    : { padding: size === "sm" ? "8px 14px" : "12px 20px" };

  return (
    <button
      data-testid={testid}
      style={{
        ...pad,
        background: palette.bg,
        color: palette.fg,
        border: variant === "ghost" ? "none" : `2.5px solid ${palette.border}`,
        borderRadius: variant === "ghost" ? 8 : 12,
        fontWeight: 700,
        fontSize: size === "sm" ? 12 : 14,
        letterSpacing: 0.2,
        cursor: "pointer",
        boxShadow: palette.shadow,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "transform .12s var(--ease-out), box-shadow .12s var(--ease-out)",
        ...style,
      }}
      onMouseDown={(e) => {
        if (variant === "ghost") return;
        e.currentTarget.style.transform = "translate(4px, 4px)";
        e.currentTarget.style.boxShadow = "none";
      }}
      onMouseUp={(e) => {
        if (variant === "ghost") return;
        e.currentTarget.style.transform = "translate(2px, 2px)";
        e.currentTarget.style.boxShadow = STICKER_SHADOW_SM;
      }}
      onMouseEnter={(e) => {
        if (variant === "ghost") return;
        e.currentTarget.style.transform = "translate(2px, 2px)";
        e.currentTarget.style.boxShadow = STICKER_SHADOW_SM;
      }}
      onMouseLeave={(e) => {
        if (variant === "ghost") return;
        e.currentTarget.style.transform = "translate(0, 0)";
        e.currentTarget.style.boxShadow = palette.shadow;
      }}
    >
      {children}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/*  Header                                                                    */
/* -------------------------------------------------------------------------- */
const Header = ({ theme, setTheme }) => (
  <header
    data-testid="preview-header"
    style={{
      background: "var(--paper-2)",
      borderBottom: INK_BORDER,
      padding: "14px 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
      flexWrap: "wrap",
      position: "relative",
      zIndex: 2,
    }}
  >
    {/* Logo */}
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <PenguinMark size={40} />
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 18, letterSpacing: -0.4 }}>
          Coin Deck
        </div>
        <div style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: 2, fontWeight: 600 }}>
          NFT · ABSTRACT
        </div>
      </div>
    </div>

    {/* Ticker */}
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {TICKER.map((t) => {
        const up = t.chg >= 0;
        return (
          <div
            key={t.sym}
            data-testid={`ticker-${t.sym}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--paper-3)",
              border: INK_BORDER,
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
              boxShadow: STICKER_SHADOW_SM,
            }}
          >
            <span style={{ color: "var(--ink-3)", fontWeight: 700 }}>{t.sym}</span>
            <span style={{ color: "var(--ink-2)", fontWeight: 700 }}>{t.price}</span>
            <span
              style={{
                color: up ? "var(--up)" : "var(--down)",
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                fontWeight: 800,
              }}
            >
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? "+" : ""}
              {t.chg}%
            </span>
          </div>
        );
      })}
    </div>

    {/* Actions */}
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StickerButton variant="outline" size="sm" testid="btn-search" iconOnly>
        <Search size={14} />
      </StickerButton>
      <StickerButton
        variant="outline"
        size="sm"
        testid="theme-toggle"
        style={{ minWidth: 80 }}
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
        <span
          role="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{ position: "absolute", inset: 0, cursor: "pointer" }}
          aria-label="toggle"
        />
      </StickerButton>
      <StickerButton variant="primary" size="sm" testid="btn-wallet">
        <Wallet size={14} />
        Кошелёк
      </StickerButton>
    </div>
  </header>
);

/* -------------------------------------------------------------------------- */
/*  Chest card                                                                */
/* -------------------------------------------------------------------------- */
const ChestCard = ({ chest, tilt }) => {
  const r = RARITY[chest.tier];
  const Icon = chest.icon;
  const isLegend = chest.tier === "LEGENDARY";
  return (
    <Sticker
      testid={`chest-${chest.tier}`}
      style={{
        flex: "1 1 220px",
        minWidth: 220,
        padding: 20,
        position: "relative",
        transform: `rotate(${tilt}deg)`,
      }}
      shadow={
        isLegend
          ? "4px 4px 0 var(--ink), 10px 10px 0 var(--lime-pop)"
          : STICKER_SHADOW
      }
    >
      {/* rarity chip */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: r.fill,
          color: "var(--ink)",
          border: INK_BORDER,
          borderRadius: 999,
          padding: "4px 10px",
          fontSize: 10,
          letterSpacing: 1.6,
          fontWeight: 800,
          boxShadow: STICKER_SHADOW_SM,
        }}
      >
        <r.icon size={12} />
        {r.label}
      </div>

      {/* icon plate */}
      <div
        style={{
          marginTop: 18,
          width: 72,
          height: 72,
          borderRadius: 18,
          background: r.fill,
          border: INK_BORDER,
          display: "grid",
          placeItems: "center",
          color: "var(--ink)",
          boxShadow: STICKER_SHADOW_SM,
        }}
      >
        <Icon size={34} strokeWidth={2.4} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>
          {chest.name}
        </div>
        <div
          style={{
            color: "var(--ink-3)",
            fontSize: 13,
            marginTop: 4,
            fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
            fontWeight: 600,
          }}
        >
          {chest.price}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <StickerButton
          variant={isLegend ? "lime" : "primary"}
          testid={`chest-buy-${chest.tier}`}
          style={{ width: "100%" }}
        >
          <Plus size={14} />
          Купить
        </StickerButton>
      </div>
    </Sticker>
  );
};

/* -------------------------------------------------------------------------- */
/*  NFT card                                                                  */
/* -------------------------------------------------------------------------- */
const NFTCard = ({ nft }) => {
  const r = RARITY[nft.tier];
  const [pos, total] = nft.progress;
  const isLegend = nft.tier === "LEGENDARY";

  return (
    <Sticker
      testid={`nft-${nft.tier}`}
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}
      shadow={
        isLegend
          ? "4px 4px 0 var(--ink), 8px 8px 0 var(--lime-pop)"
          : STICKER_SHADOW
      }
    >
      {/* top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: r.fill,
            color: "var(--ink)",
            border: INK_BORDER,
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 9,
            letterSpacing: 1.6,
            fontWeight: 800,
          }}
        >
          <r.icon size={10} />
          {r.label}
        </span>
        {nft.isNew && (
          <span
            data-testid="badge-new"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--lime-pop)",
              color: "var(--ink)",
              border: INK_BORDER,
              boxShadow: STICKER_SHADOW_SM,
            }}
          >
            NEW
          </span>
        )}
      </div>

      {/* symbol plate */}
      <div
        style={{
          height: 130,
          borderRadius: 14,
          background: r.fill,
          border: INK_BORDER,
          display: "grid",
          placeItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* deco dots */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(var(--ink) 1.2px, transparent 1.4px)",
            backgroundSize: "14px 14px",
            opacity: 0.18,
          }}
        />
        <div
          style={{
            position: "relative",
            width: 78,
            height: 78,
            borderRadius: "50%",
            background: "var(--paper-3)",
            border: INK_BORDER,
            display: "grid",
            placeItems: "center",
            color: "var(--ink)",
            fontWeight: 800,
            fontSize: 38,
            letterSpacing: -2,
            boxShadow: STICKER_SHADOW_SM,
          }}
        >
          {nft.symbol}
        </div>
      </div>

      {/* name */}
      <div>
        <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 16, letterSpacing: -0.2 }}>
          {nft.name}
        </div>
        <div
          style={{
            color: "var(--ink-3)",
            fontSize: 10,
            letterSpacing: 1.6,
            marginTop: 2,
            fontWeight: 700,
          }}
        >
          {nft.chain}
        </div>
      </div>

      {/* progress dots */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--ink-3)",
            fontSize: 10,
            letterSpacing: 1.4,
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          <span>ДО АПГРЕЙДА</span>
          <span>
            {pos}/{total}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 10,
                borderRadius: 4,
                background: i < pos ? r.fill : "var(--sunken)",
                border: "2px solid var(--ink)",
              }}
            />
          ))}
        </div>
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <StickerButton
          variant="primary"
          size="sm"
          testid={`btn-buy-${nft.tier}`}
          style={{ flex: 1 }}
        >
          <Zap size={12} />
          Купить
        </StickerButton>
        <StickerButton variant="outline" size="sm" testid={`btn-send-${nft.tier}`} iconOnly>
          <Send size={14} />
        </StickerButton>
      </div>
    </Sticker>
  );
};

/* -------------------------------------------------------------------------- */
/*  Filters                                                                   */
/* -------------------------------------------------------------------------- */
const Filters = () => {
  const [active, setActive] = useState("BOX");
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {FILTERS.map((f) => {
        const isActive = active === f;
        return (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setActive(f)}
            style={{
              padding: "8px 14px",
              background: isActive ? "var(--mint)" : "var(--paper-3)",
              color: "var(--ink)",
              border: INK_BORDER,
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.4,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: isActive ? STICKER_SHADOW : STICKER_SHADOW_SM,
              transition: "transform .12s, box-shadow .12s",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--sky-soft)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--paper-3)";
            }}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Swatch                                                                    */
/* -------------------------------------------------------------------------- */
const Swatch = ({ name, value, token }) => (
  <Sticker
    testid={`swatch-${token}`}
    style={{ overflow: "hidden", padding: 0 }}
    shadow={STICKER_SHADOW_SM}
  >
    <div
      style={{
        background: value,
        height: 72,
        borderBottom: INK_BORDER,
        display: "flex",
        alignItems: "flex-end",
        padding: 10,
        fontSize: 10,
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
        color: "var(--ink)",
        fontWeight: 700,
      }}
    >
      {value}
    </div>
    <div style={{ padding: "10px 12px", background: "var(--paper-2)" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>{name}</div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
          marginTop: 2,
          fontWeight: 600,
        }}
      >
        {token}
      </div>
    </div>
  </Sticker>
);

const SwatchRow = ({ title, items }) => (
  <>
    <div
      style={{
        fontSize: 11,
        letterSpacing: 2,
        color: "var(--ink-3)",
        margin: "8px 0 12px",
        textTransform: "uppercase",
        fontWeight: 800,
      }}
    >
      {title}
    </div>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 28,
      }}
    >
      {items.map((s) => (
        <Swatch key={s.token} {...s} />
      ))}
    </div>
  </>
);

/* -------------------------------------------------------------------------- */
/*  Hero deco blobs                                                           */
/* -------------------------------------------------------------------------- */
const HeroBlobs = () => (
  <>
    {/* mint blob top-right */}
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: -120,
        right: -80,
        width: 320,
        height: 320,
        borderRadius: "50%",
        background: "var(--mint-soft)",
        border: INK_BORDER,
        opacity: 0.9,
        zIndex: 0,
      }}
    />
    {/* sky blob bottom-left */}
    <div
      aria-hidden
      style={{
        position: "absolute",
        bottom: -100,
        left: -60,
        width: 240,
        height: 240,
        borderRadius: "50%",
        background: "var(--sky-soft)",
        border: INK_BORDER,
        opacity: 0.85,
        zIndex: 0,
      }}
    />
    {/* lime dot */}
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 40,
        right: 280,
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--lime-pop)",
        border: INK_BORDER,
        boxShadow: STICKER_SHADOW_SM,
        zIndex: 1,
      }}
    />
  </>
);

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */
export default function ColorPreview() {
  const [theme, setTheme] = useState("light");

  const styleVars = { ...SHARED, ...THEMES[theme] };

  useEffect(() => {
    document.body.style.background = THEMES[theme]["--paper"];
    document.body.style.color = THEMES[theme]["--ink-2"];
    return () => {
      document.body.style.background = "";
      document.body.style.color = "";
    };
  }, [theme]);

  return (
    <div
      data-testid="color-preview-root"
      data-theme={theme}
      style={{
        ...styleVars,
        background: "var(--paper)",
        color: "var(--ink-2)",
        minHeight: "100vh",
        fontFamily:
          '"Sora", "DM Sans", "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <Header theme={theme} setTheme={setTheme} />

      {/* HERO ============================================================= */}
      <section
        style={{
          padding: "64px 28px 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <HeroBlobs />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <SectionTitle
            kicker="Coin Deck · Color System v2"
            title="Sticker UI для игровых NFT на Abstract."
            sub="Минимализм с сине-зелёной осью Abstract (mint + sky) и 2D-мультяшной подачей: толстые ink-обводки, плоские заливки, резкая sticker-тень. Переключай темы кнопкой в шапке — паттерн остаётся узнаваемым в обеих."
          />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <StickerButton variant="primary" testid="btn-cta-primary">
              <Plus size={14} />
              Открыть сундук
            </StickerButton>
            <StickerButton variant="secondary" testid="btn-cta-secondary">
              <Sparkles size={14} />
              Смотреть NFT
            </StickerButton>
            <StickerButton variant="outline" testid="btn-cta-outline">
              Документация <ArrowRight size={14} />
            </StickerButton>
            <StickerButton variant="ghost" testid="btn-cta-ghost">
              Подробнее →
            </StickerButton>
            <StickerButton variant="destructive" testid="btn-cta-destructive">
              Отменить ордер
            </StickerButton>
          </div>
        </div>
      </section>

      {/* CHEST SHOP ======================================================= */}
      <section style={{ padding: "32px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTitle kicker="Магазин" title="Сундуки" />
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {CHESTS.map((c, i) => (
              <ChestCard key={c.tier} chest={c} tilt={[-1.2, 0.6, -0.4, 1][i] || 0} />
            ))}
          </div>
        </div>
      </section>

      {/* MARKETPLACE ====================================================== */}
      <section style={{ padding: "40px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTitle kicker="Marketplace" title="NFT-коллекции" />
          <Filters />
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 22,
            }}
          >
            {NFTS.map((n) => (
              <NFTCard key={n.tier} nft={n} />
            ))}
          </div>
        </div>
      </section>

      {/* TOKENS =========================================================== */}
      <section style={{ padding: "40px 28px 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTitle
            kicker="Tokens"
            title={`Палитра · ${theme.toUpperCase()} theme`}
            sub="Каждая плашка — готовый CSS-токен, который можно сразу копировать в проект."
          />

          <SwatchRow
            title="Brand · Mint + Sky + Lime"
            items={[
              { name: "Mint",       value: "#26C6A8", token: "--mint" },
              { name: "Mint Deep",  value: "#1DA88E", token: "--mint-deep" },
              { name: "Mint Soft",  value: "#BFEDE2", token: "--mint-soft" },
              { name: "Sky",        value: "#7AC7E8", token: "--sky" },
              { name: "Sky Deep",   value: "#4DAFD5", token: "--sky-deep" },
              { name: "Sky Soft",   value: "#DCEEF7", token: "--sky-soft" },
              { name: "Lime Pop",   value: "#88FC00", token: "--lime-pop" },
            ]}
          />

          <SwatchRow
            title="Paper & Ink"
            items={[
              { name: "Paper",   value: THEMES[theme]["--paper"],   token: "--paper" },
              { name: "Paper 2", value: THEMES[theme]["--paper-2"], token: "--paper-2" },
              { name: "Paper 3", value: THEMES[theme]["--paper-3"], token: "--paper-3" },
              { name: "Sunken",  value: THEMES[theme]["--sunken"],  token: "--sunken" },
              { name: "Ink",     value: "#0F1115",                  token: "--ink" },
              { name: "Ink 2",   value: THEMES[theme]["--ink-2"],   token: "--ink-2" },
              { name: "Ink 3",   value: THEMES[theme]["--ink-3"],   token: "--ink-3" },
            ]}
          />

          <SwatchRow
            title="Rarities · sea → mint → lime"
            items={[
              { name: "Common",    value: "#D9D3C2", token: "--rarity-common" },
              { name: "Rare",      value: "#7AC7E8", token: "--rarity-rare" },
              { name: "Epic",      value: "#26C6A8", token: "--rarity-epic" },
              { name: "Legendary", value: "#88FC00", token: "--rarity-legendary" },
            ]}
          />

          <SwatchRow
            title="Status"
            items={[
              { name: "Up",    value: "#23A86A", token: "--up" },
              { name: "Down",  value: "#E25C5C", token: "--down" },
              { name: "Warn",  value: "#F2B73A", token: "--warn" },
              { name: "Info",  value: "#4DAFD5", token: "--info" },
            ]}
          />

          <Sticker style={{ padding: 22, marginTop: 16 }} shadow={STICKER_SHADOW}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--ink-2)",
                fontWeight: 800,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "var(--mint)",
                  border: INK_BORDER,
                  boxShadow: STICKER_SHADOW_SM,
                }}
              >
                <Sparkles size={14} color="var(--ink)" />
              </span>
              Полный гайдлайн
            </div>
            <div style={{ color: "var(--ink-3)", fontSize: 13, lineHeight: 1.6 }}>
              Файл{" "}
              <code
                style={{
                  background: "var(--sunken)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
                  fontSize: 12,
                  color: "var(--ink-2)",
                  border: "1.5px solid var(--ink)",
                }}
              >
                /app/design/COLOR_GUIDELINES.md
              </code>{" "}
              содержит правила применения, контрастность по WCAG, готовые CSS-переменные
              и фрагмент <code>tailwind.config.js</code> для прямой интеграции.
            </div>
          </Sticker>
        </div>
      </section>
    </div>
  );
}
