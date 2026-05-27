"use client";
import { createPortal } from "react-dom";

export type ChestOpenData = { type: number; label: string; emoji: string; tier: number; available: number; grad: string; ring: string; buyBg: string };

const THEME = [
  { accent: "#00F0FF", glow: "rgba(0,240,255,0.22)",   b1: "rgba(0,240,255,0.45)",   b2: "rgba(109,40,217,0.45)", bg: "rgba(0,240,255,0.08)"  },
  { accent: "#60a5fa", glow: "rgba(96,165,250,0.22)",  b1: "rgba(96,165,250,0.45)",  b2: "rgba(109,40,217,0.45)", bg: "rgba(96,165,250,0.08)" },
  { accent: "#B026FF", glow: "rgba(176,38,255,0.22)",  b1: "rgba(176,38,255,0.45)",  b2: "rgba(0,240,255,0.45)",  bg: "rgba(176,38,255,0.08)" },
];

const TIER_COLOR = ["#9ca3af", "#60a5fa", "#c084fc", "#fbbf24"];
const TIER_NAME  = ["Common",  "Rare",    "Epic",    "Legendary"];

function chestWord(n: number, ru: boolean) {
  if (!ru) return n === 1 ? "chest" : "chests";
  if (n === 1) return "сундук";
  if (n < 5)   return "сундука";
  return "сундуков";
}

type Props = {
  lang: string;
  modal: ChestOpenData;
  onClose: () => void;
  chestOpenQty: number;
  setChestOpenQty: React.Dispatch<React.SetStateAction<number>>;
  busy: string | null;
  onOpenChestTyped: (type: number, qty: number) => void;
};

export function ChestOpenModal({ lang, modal, onClose, chestOpenQty, setChestOpenQty, busy, onOpenChestTyped }: Props) {
  const t   = THEME[modal.type]     ?? THEME[0];
  const tc  = TIER_COLOR[modal.tier] ?? TIER_COLOR[0];
  const tn  = TIER_NAME[modal.tier]  ?? "Common";
  const ru  = lang === "ru";

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(#0d0f22, #08091a) padding-box, linear-gradient(135deg, ${t.b1}, ${t.b2}) border-box`,
          border: "1.5px solid transparent",
          boxShadow: `0 0 60px ${t.glow}, 0 25px 50px rgba(0,0,0,0.7)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
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
              src={["/chests/wooden_closed.webp", "/chests/iron_closed.webp", "/chests/silver_closed.webp"][modal.type]}
              alt={modal.label}
              className="relative w-28 h-28 object-contain"
              style={{ filter: `drop-shadow(0 0 18px ${t.accent}99)` }}
            />
          </div>
          <div className="relative text-center">
            <div className="font-display font-black text-xl text-white tracking-tight">{modal.label}</div>
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}
              >
                {modal.available} {ru ? "шт." : "pcs."}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                style={{ background: tc + "18", border: `1px solid ${tc}40`, color: tc }}
              >
                Tier {modal.tier + 1} · {tn}
              </span>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div
          className="mx-6 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${t.accent}35, transparent)` }}
        />

        {/* ── Body ── */}
        <div className="p-6 space-y-4">
          {/* Qty stepper */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">
              {ru ? "Открыть" : "Open"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChestOpenQty((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-base transition active:scale-90"
                style={{ background: t.accent + "14", border: `1px solid ${t.accent}30` }}
              >−</button>
              <span className="w-10 text-center text-white font-bold text-base tabular-nums">{chestOpenQty}</span>
              <button
                onClick={() => setChestOpenQty((q) => Math.min(modal.available, q + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-base transition active:scale-90"
                style={{ background: t.accent + "14", border: `1px solid ${t.accent}30` }}
              >+</button>
              <button
                onClick={() => setChestOpenQty(modal.available)}
                className="rounded-lg px-3 h-8 text-xs font-bold transition active:scale-90"
                style={{ background: t.accent + "14", border: `1px solid ${t.accent}30`, color: t.accent }}
              >MAX</button>
            </div>
          </div>

          {/* Summary */}
          <div
            className="rounded-xl px-4 py-3 text-sm leading-relaxed"
            style={{ background: t.accent + "0a", border: `1px solid ${t.accent}22` }}
          >
            <span className="text-white/50">{ru ? "Откроется " : "Opening "}</span>
            <span className="font-bold text-white">{chestOpenQty} {chestWord(chestOpenQty, ru)}</span>
            <span className="text-white/50"> → </span>
            <span className="font-bold" style={{ color: tc }}>
              {chestOpenQty} {ru ? `карточек Tier ${modal.tier + 1}` : `Tier ${modal.tier + 1} card${chestOpenQty > 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white/45 hover:text-white/70 transition"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {ru ? "Отмена" : "Cancel"}
            </button>
            <button
              onClick={() => onOpenChestTyped(modal.type, chestOpenQty)}
              disabled={busy !== null}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-110 transition"
              style={{
                background: "linear-gradient(135deg, #00F0FF, #6D28D9, #B026FF)",
                boxShadow: `0 0 18px ${t.glow}`,
              }}
            >
              {ru ? "Открыть" : "Open"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
