"use client";
import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const EGG_STARS: { top?: string; left?: string; right?: string; bottom?: string; animationDelay: string; animationDuration: string }[] = [
  { top: "-18px", left: "50%",    animationDelay: "0s",   animationDuration: "2.1s" },
  { top: "10%",   left: "-20px",  animationDelay: "0.7s", animationDuration: "1.8s" },
  { top: "10%",   right: "-20px", animationDelay: "1.3s", animationDuration: "2.4s" },
  { bottom: "5%", left: "-18px",  animationDelay: "0.4s", animationDuration: "1.6s" },
  { bottom: "5%", right: "-18px", animationDelay: "1.0s", animationDuration: "2.2s" },
  { bottom: "-16px", left: "40%", animationDelay: "1.6s", animationDuration: "1.9s" },
];

export type ChestBuyData = { type: number; label: string; emoji: string; rarity: string; desc: string; price: number; buyBg: string };

const THEME = [
  { accent: "var(--rarity-common)", panel: "var(--paper-2)" },
  { accent: "var(--rarity-rare)", panel: "var(--sky-soft)" },
  { accent: "var(--rarity-epic)", panel: "var(--mint-soft)" },
];

type Props = {
  lang: string;
  modal: ChestBuyData;
  onClose: () => void;
  chestBuyQty: number;
  setChestBuyQty: React.Dispatch<React.SetStateAction<number>>;
  busy: string | null;
  onBuyChestTyped: (type: number, qty: number) => void;
};

export function ChestBuyModal({ lang, modal, onClose, chestBuyQty, setChestBuyQty, busy, onBuyChestTyped }: Props) {
  const t = THEME[modal.type] ?? THEME[0];
  const [scaleKey, setScaleKey] = useState(0);
  const [scaleDir, setScaleDir] = useState<"grow" | "shrink">("grow");

  function handleQtyChange(delta: 1 | -1) {
    setChestBuyQty((q) => Math.min(20, Math.max(1, q + delta)));
    setScaleDir(delta > 0 ? "grow" : "shrink");
    setScaleKey((k) => k + 1);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: "var(--overlay-backdrop)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "var(--modal-bg)",
          border: "2.5px solid var(--outline)",
          boxShadow: "var(--shadow-sticker)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <style>{`
          @keyframes chestScaleGrow   { 0%{transform:scale(1)} 40%{transform:scale(1.28)} 100%{transform:scale(1)} }
          @keyframes chestScaleShrink { 0%{transform:scale(1)} 40%{transform:scale(0.76)} 100%{transform:scale(1)} }
        `}</style>
        <div className="relative flex flex-col items-center pt-8 pb-6 px-6 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: t.panel, opacity: 0.45 }}
          />
          <div className="relative mb-4" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <div className="egg-ripple"   style={{ color: t.accent, animationDelay: `${([0, -4, -8] as const)[modal.type]}s` }} />
            <div className="egg-ripple-2" style={{ color: t.accent, animationDelay: `${([0, -4, -8] as const)[modal.type]}s` }} />
            {EGG_STARS.map((pos, i) => (
              <span key={i} className="egg-star" style={{ ...pos as CSSProperties, color: t.accent }}>✦</span>
            ))}
            <div
              key={scaleKey}
              style={{ animation: scaleKey > 0 ? `${scaleDir === "grow" ? "chestScaleGrow" : "chestScaleShrink"} 350ms cubic-bezier(.17,.67,.35,1.3) both` : undefined }}
            >
              <img
                src="/egg2.webp"
                alt={modal.label}
                className="egg-shake egg-glow"
                style={{ width: ([80, 96, 120] as const)[modal.type], height: ([80, 96, 120] as const)[modal.type], objectFit: "contain", position: "relative", zIndex: 1, animationDelay: `${([0, -4, -8] as const)[modal.type]}s`, color: t.accent }}
              />
            </div>
          </div>
          <div className="relative text-center">
            <div className="font-display font-black text-xl tracking-tight" style={{ color: "var(--panel-text)" }}>{modal.label}</div>
            <div style={{
              marginTop: 8, display: "inline-flex", alignItems: "center",
              background: t.accent, color: "var(--on-rarity)",
              border: "2.5px solid var(--outline)", borderRadius: 999,
              padding: "4px 10px", fontSize: 10, letterSpacing: 1.6,
              fontWeight: 800, boxShadow: "2px 2px 0 var(--card-shadow)",
            }}>
              {modal.rarity}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-6 h-px" style={{ background: "var(--ink)", opacity: 0.14 }} />

        {/* ── Body ── */}
        <div className="p-6 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--panel-text-muted)" }}>{modal.desc}</p>

          {/* Qty stepper */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--nft-muted)" }}>
              {lang === "ru" ? "Количество" : "Quantity"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQtyChange(-1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base transition active:scale-90"
                style={{ background: t.accent, border: "2px solid var(--outline)", color: "var(--on-rarity)" }}
              >−</button>
              <span className="w-10 text-center font-bold text-base tabular-nums" style={{ color: "var(--panel-text)" }}>{chestBuyQty}</span>
              <button
                onClick={() => handleQtyChange(1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base transition active:scale-90"
                style={{ background: t.accent, border: "2px solid var(--outline)", color: "var(--on-rarity)" }}
              >+</button>
            </div>
          </div>

          {/* Total row */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "var(--sunken)", border: "1px solid var(--panel-border)" }}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--nft-muted)" }}>
              {lang === "ru" ? "Итого" : "Total"}
            </span>
            <span className="text-base font-black" style={{ color: "var(--panel-text)" }}>
              {((modal.price * chestBuyQty) / 1e18).toFixed(4)}
              <span className="ml-1.5 text-sm font-semibold" style={{ color: t.accent }}>ETH</span>
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-sticker-outline flex-1" style={{ padding: "10px 20px", borderColor: t.accent, background: t.accent, color: "var(--chest-buy-btn-text)" }}>
              {lang === "ru" ? "Отмена" : "Cancel"}
            </button>
            <button
              onClick={() => onBuyChestTyped(modal.type, chestBuyQty)}
              disabled={busy !== null}
              className="btn-sticker-primary flex-1"
              style={{ padding: "10px 20px", background: t.accent, color: "var(--chest-buy-btn-text)" }}
            >
              {lang === "ru" ? "Купить" : "Buy"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
