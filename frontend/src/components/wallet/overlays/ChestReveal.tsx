"use client";

import { createPortal } from "react-dom";
import { HEROES, COIN_TICKERS, COIN_ICONS } from "../constants";

const PRIMER_FILLS = ["var(--rarity-common)", "var(--rarity-rare)", "var(--rarity-epic)", "var(--rarity-legendary)"] as const;
const RARITY_LABELS = ["Small", "Medium", "Heavy", "Super Heavy"] as const;
const EGG_SIZES = [108, 132, 162, 180] as const;

function RosterCard({ card, isNew }: { card: { playerId: number; tier: number }; isNew?: boolean }) {
  const tier       = card.tier;
  const playerId   = card.playerId;
  const primerFill = PRIMER_FILLS[tier] ?? PRIMER_FILLS[0];
  const label      = RARITY_LABELS[tier] ?? RARITY_LABELS[0];
  const ticker     = COIN_TICKERS[playerId];
  const coinIcon   = COIN_ICONS[playerId];
  const eggSz      = EGG_SIZES[tier] ?? 88;
  const isLegendary = tier === 3;

  return (
    <div style={{
      background: "var(--paper-2)",
      border: "2.5px solid var(--outline)",
      borderRadius: 18,
      boxShadow: isLegendary
        ? "4px 4px 0 var(--card-shadow), 8px 8px 0 var(--rarity-legendary)"
        : "4px 4px 0 var(--card-shadow)",
      padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
      position: "relative", width: "100%",
    }}>
      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          background: primerFill, color: "var(--ink)",
          border: "2.5px solid var(--outline)", borderRadius: 999,
          padding: "3px 9px", fontSize: 9, letterSpacing: 1.6, fontWeight: 800,
          boxShadow: "2px 2px 0 var(--card-shadow)",
        }}>{label.toUpperCase()}</div>
      </div>

      {/* image plate */}
      <div style={{
        height: 210, borderRadius: 14, background: primerFill,
        border: "2.5px solid var(--outline)", display: "grid", placeItems: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div aria-hidden style={{ position: "absolute", inset: 10, border: "2px solid var(--outline)", opacity: 0.12, borderRadius: 10 }} />
        <div className="anim-float" style={{ position: "relative", width: eggSz, height: eggSz }}>
          <img src="/egg.webp" alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          {coinIcon && (
            <img src={coinIcon} alt="" aria-hidden style={{
              position: "absolute", width: "35%", height: "35%", objectFit: "contain",
              top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              mixBlendMode: "multiply", opacity: 0.9,
            }} />
          )}
        </div>
      </div>

      {/* name + role */}
      <div>
        <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 15, letterSpacing: -0.2 }}>{HEROES[playerId]}</div>
        <div style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: 1.6, marginTop: 2, fontWeight: 700 }}>{ticker}</div>
      </div>
    </div>
  );
}

export function ChestReveal({
  card,
  onClose,
  lang,
}: {
  card: { playerId: number; tier: number };
  onClose: () => void;
  lang: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "var(--overlay-backdrop)" }}
      onClick={onClose}
    >
      <style>{`
        @keyframes revealCard {
          from { opacity: 0; transform: translateY(70px) scale(0.75); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes revealGlow {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="absolute inset-0 pointer-events-none" style={{
        background: PRIMER_FILLS[card.tier] ?? PRIMER_FILLS[0],
        opacity: 0.12,
        animation: "revealGlow 500ms ease-out both",
      }} />

      <article
        className="relative select-none"
        style={{ width: 224, animation: "revealCard 550ms cubic-bezier(.17,.67,.35,1.3) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <RosterCard card={card} isNew />
        <div className="mt-3 text-center text-xs" style={{ color: "var(--nft-muted)" }}>
          ✨ {lang === "ru" ? "Новая карточка!" : "New card!"}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-2 rounded-xl py-2 text-sm font-semibold transition"
          style={{ background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)", border: "1px solid var(--panel-border)" }}
        >
          {lang === "ru" ? "Отлично!" : "Nice!"}
        </button>
      </article>
    </div>,
    document.body,
  );
}

export function ChestRevealMulti({
  cards,
  onClose,
  lang,
}: {
  cards: { playerId: number; tier: number }[];
  onClose: () => void;
  lang: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 overflow-y-auto"
      style={{ background: "var(--overlay-backdrop)" }}
      onClick={onClose}
    >
      <style>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(50px) scale(0.8); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="mb-5 text-center pointer-events-none">
        <div className="text-lg font-black" style={{ color: "var(--panel-text)" }}>
          {lang === "ru" ? `🎉 Получено ${cards.length} карточек!` : `🎉 Got ${cards.length} cards!`}
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--nft-muted)" }}>
          {lang === "ru" ? "Нажмите чтобы закрыть" : "Tap to close"}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
        {cards.map((card, i) => (
          <div
            key={i}
            style={{ width: 140, animation: `cardSlideIn 400ms cubic-bezier(.17,.67,.35,1.3) ${i * 80}ms both` }}
          >
            <RosterCard card={card} isNew />
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        className="mt-6 rounded-xl px-8 py-2.5 text-sm font-semibold transition"
        style={{ background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)", border: "1px solid var(--panel-border)" }}
      >
        {lang === "ru" ? "Отлично!" : "Nice!"}
      </button>
    </div>,
    document.body,
  );
}

export function MergeBar({ count, max = 5 }: { count: number; max?: number }) {
  const pct = Math.min(count / max, 1) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--sunken)", border: "1px solid var(--panel-border)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, background: count >= max ? "var(--mint)" : "var(--ink-3)" }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color: "var(--ink-3)" }}>{count}/{max}</span>
    </div>
  );
}
