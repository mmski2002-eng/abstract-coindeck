"use client";
import { useState } from "react";
import { createPortal } from "react-dom";

export type ChestBuyData = { type: number; label: string; emoji: string; rarity: string; desc: string; price: number; buyBg: string };

const THEME = [
  { accent: "#00F0FF", glow: "rgba(0,240,255,0.22)",   b1: "rgba(0,240,255,0.45)",   b2: "rgba(109,40,217,0.45)", bg: "rgba(0,240,255,0.08)"  },
  { accent: "#60a5fa", glow: "rgba(96,165,250,0.22)",  b1: "rgba(96,165,250,0.45)",  b2: "rgba(109,40,217,0.45)", bg: "rgba(96,165,250,0.08)" },
  { accent: "#B026FF", glow: "rgba(176,38,255,0.22)",  b1: "rgba(176,38,255,0.45)",  b2: "rgba(0,240,255,0.45)",  bg: "rgba(176,38,255,0.08)" },
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
      className="fixed inset-0 z-[150] flex items-center justify-center backdrop-blur-sm p-4"
      style={{ background: "var(--overlay-backdrop)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(var(--modal-bg), var(--modal-bg)) padding-box, linear-gradient(135deg, ${t.b1}, ${t.b2}) border-box`,
          border: "1.5px solid transparent",
          boxShadow: `0 0 60px ${t.glow}, var(--modal-shadow)`,
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
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${t.bg} 0%, transparent 65%)` }}
          />
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-full blur-3xl scale-[2]"
              style={{ background: `radial-gradient(circle, ${t.glow} 0%, transparent 70%)` }}
            />
            <img
              key={scaleKey}
              src={["/chests/wooden_closed.webp", "/chests/iron_closed.webp", "/chests/silver_closed.webp"][modal.type]}
              alt={modal.label}
              className="relative w-28 h-28 object-contain"
              style={{
                filter: `drop-shadow(0 0 18px ${t.accent}99)`,
                animation: scaleKey > 0 ? `${scaleDir === "grow" ? "chestScaleGrow" : "chestScaleShrink"} 350ms cubic-bezier(.17,.67,.35,1.3) both` : undefined,
              }}
            />
          </div>
          <div className="relative text-center">
            <div className="font-display font-black text-xl tracking-tight" style={{ color: "var(--panel-text)" }}>{modal.label}</div>
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest"
              style={{ background: t.accent + "18", border: `1px solid ${t.accent}40`, color: t.accent }}
            >
              {modal.rarity}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-6 h-px" style={{ background: `linear-gradient(to right, transparent, ${t.accent}35, transparent)` }} />

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
                style={{ background: t.accent + "14", border: `1px solid ${t.accent}30`, color: "var(--panel-text)" }}
              >−</button>
              <span className="w-10 text-center font-bold text-base tabular-nums" style={{ color: "var(--panel-text)" }}>{chestBuyQty}</span>
              <button
                onClick={() => handleQtyChange(1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base transition active:scale-90"
                style={{ background: t.accent + "14", border: `1px solid ${t.accent}30`, color: "var(--panel-text)" }}
              >+</button>
            </div>
          </div>

          {/* Total row */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: t.accent + "0a", border: `1px solid ${t.accent}22` }}
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
            <button
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition"
              style={{ background: "var(--button-secondary-bg)", border: "1px solid var(--panel-border)", color: "var(--button-secondary-text)" }}
            >
              {lang === "ru" ? "Отмена" : "Cancel"}
            </button>
            <button
              onClick={() => onBuyChestTyped(modal.type, chestBuyQty)}
              disabled={busy !== null}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-110 transition"
              style={{
                background: "linear-gradient(135deg, #00F0FF, #6D28D9, #B026FF)",
                boxShadow: `0 0 18px ${t.glow}`,
              }}
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
