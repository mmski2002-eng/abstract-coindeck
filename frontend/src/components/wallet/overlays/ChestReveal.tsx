"use client";

import { createPortal } from "react-dom";
import { HEROES, COIN_TICKERS, COIN_ICONS, COIN_BRAND_COLORS, CARD_TIER_STYLES } from "../constants";

export function ChestReveal({
  card,
  onClose,
  lang,
}: {
  card: { playerId: number; tier: number };
  onClose: () => void;
  lang: string;
}) {
  const ts = CARD_TIER_STYLES[card.tier] ?? CARD_TIER_STYLES[0];
  const brand = COIN_BRAND_COLORS[card.playerId] ?? "#6B7280";
  const ticker = COIN_TICKERS[card.playerId];
  const coinIcon = COIN_ICONS[card.playerId];
  const eggW = (["50%","65%","79%","94%"] as const)[card.tier] ?? "72%";
  const eggH = (["57%","74%","90%","107%"] as const)[card.tier] ?? "82%";
  const isLegendary = card.tier === 3;
  const isEpic = card.tier === 2;
  const isRare = card.tier === 1;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-md"
      style={{ background: "var(--overlay-backdrop)" }}
      onClick={onClose}
    >
      <style>{`
        @keyframes revealCard {
          from { opacity: 0; transform: translateY(70px) scale(0.75); filter: brightness(2.5); }
          50%  { filter: brightness(1.3); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: brightness(1); }
        }
        @keyframes revealGlow {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${
            card.tier === 0 ? "rgba(161,161,170,0.15)" :
            card.tier === 1 ? "rgba(59,130,246,0.2)" :
            card.tier === 2 ? "rgba(168,85,247,0.25)" :
            "rgba(234,179,8,0.3)"
          } 0%, transparent 65%)`,
          animation: "revealGlow 500ms ease-out both",
        }}
      />

      <article
        className="relative w-56 select-none"
        style={{ animation: "revealCard 550ms cubic-bezier(.17,.67,.35,1.3) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLegendary && <div aria-hidden className="absolute -inset-[2px] rounded-[22px] foil-perpetual" />}
        <div className="relative rounded-[20px] overflow-hidden" style={{ padding: "1.5px", background: `linear-gradient(180deg, ${ts.border}, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.01))` }}>
          <div className="relative rounded-[18px] overflow-hidden flex flex-col" style={{ background: "var(--card)", boxShadow: `0 12px 40px -12px ${ts.glow}` }}>
            <div className="relative aspect-[4/5] overflow-hidden grain" style={{ background: ts.gradient }}>
              <div className="relative flex items-center justify-center w-full h-full">
                <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${brand}22, transparent 70%)` }} />
                <div className="absolute anim-float" style={{ width: eggW, height: eggH }}>
                  <img src="/egg.webp" alt="" aria-hidden
                    className="w-full h-full select-none"
                    style={{ objectFit: "contain", filter: `drop-shadow(0 4px 24px ${brand}50)` }} />
                  {coinIcon && (
                    <img src={coinIcon} alt="" aria-hidden
                      className="absolute select-none"
                      style={{ width: "35%", height: "35%", objectFit: "contain", top: "50%", left: "50%", transform: "translate(-50%, -50%)", mixBlendMode: "multiply", opacity: 0.9 }} />
                  )}
                </div>
              </div>
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-1 rounded-md border backdrop-blur-md" style={{ color: ts.color, borderColor: ts.border, background: "rgba(0,0,0,0.4)" }}>{ts.label}</span>
              </div>
              <div className="absolute top-2.5 right-2.5 z-10">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-1 rounded-md border backdrop-blur-md" style={{ color: ts.color, borderColor: `${ts.color}60`, background: "rgba(0,0,0,0.6)" }}>NEW</span>
              </div>
              {(isRare || isEpic || isLegendary) && <div aria-hidden className="absolute inset-0 holo-sheen overflow-hidden" />}
              <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ts.color}, transparent)` }} />
            </div>
            <div className="relative p-3.5" style={{ background: "var(--card)" }}>
              <h4 className="font-bold text-sm tracking-tight truncate" style={{ color: ts.color }}>{HEROES[card.playerId]}</h4>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{ticker}</span>
              <div className="mt-3 text-center text-xs mb-2" style={{ color: "var(--nft-muted)" }}>✨ {lang === "ru" ? "Новая карточка!" : "New card!"}</div>
              <button
                onClick={onClose}
                className="w-full rounded-xl py-2 text-sm font-semibold transition"
                style={{ background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)", border: "1px solid var(--panel-border)" }}
              >
                {lang === "ru" ? "Отлично!" : "Nice!"}
              </button>
            </div>
          </div>
        </div>
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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center backdrop-blur-md p-4 overflow-y-auto"
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
        <div className="text-xs mt-1" style={{ color: "var(--nft-muted)" }}>{lang === "ru" ? "Нажмите чтобы закрыть" : "Tap to close"}</div>
      </div>
      <div className="flex gap-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {cards.map((card, i) => {
          const ts = CARD_TIER_STYLES[card.tier] ?? CARD_TIER_STYLES[0];
          const brand = COIN_BRAND_COLORS[card.playerId] ?? "#6B7280";
          const ticker = COIN_TICKERS[card.playerId];
          const coinIcon = COIN_ICONS[card.playerId];
          const eggW = (["50%","65%","79%","94%"] as const)[card.tier] ?? "72%";
          const eggH = (["57%","74%","90%","107%"] as const)[card.tier] ?? "82%";
          const isLegendary = card.tier === 3;
          const isEpic = card.tier === 2;
          const isRare = card.tier === 1;
          return (
            <article
              key={i}
              className="relative flex-none select-none"
              style={{ width: 110, animation: `cardSlideIn 400ms cubic-bezier(.17,.67,.35,1.3) ${i * 80}ms both` }}
            >
              {isLegendary && <div aria-hidden className="absolute -inset-[2px] rounded-[16px] foil-perpetual" />}
              <div className="relative rounded-[15px] overflow-hidden" style={{ padding: "1.5px", background: `linear-gradient(180deg, ${ts.border}, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.01))` }}>
                <div className="relative rounded-[13px] overflow-hidden flex flex-col" style={{ background: "var(--card)", boxShadow: `0 8px 24px -8px ${ts.glow}` }}>
                  <div className="relative aspect-[4/5] overflow-hidden grain" style={{ background: ts.gradient }}>
                    <div className="relative flex items-center justify-center w-full h-full">
                      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${brand}22, transparent 70%)` }} />
                      <div className="absolute anim-float" style={{ width: eggW, height: eggH }}>
                        <img src="/egg.webp" alt="" aria-hidden
                          className="w-full h-full select-none"
                          style={{ objectFit: "contain", filter: `drop-shadow(0 4px 20px ${brand}50)` }} />
                        {coinIcon && (
                          <img src={coinIcon} alt="" aria-hidden
                            className="absolute select-none"
                            style={{ width: "35%", height: "35%", objectFit: "contain", top: "50%", left: "50%", transform: "translate(-50%, -50%)", mixBlendMode: "multiply", opacity: 0.9 }} />
                        )}
                      </div>
                    </div>
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border backdrop-blur-md" style={{ color: ts.color, borderColor: ts.border, background: "rgba(0,0,0,0.4)" }}>{ts.label}</span>
                    </div>
                    {(isRare || isEpic || isLegendary) && <div aria-hidden className="absolute inset-0 holo-sheen overflow-hidden" />}
                  </div>
                  <div className="p-2" style={{ background: "var(--card)" }}>
                    <div className="text-[9px] font-black truncate leading-tight" style={{ color: ts.color }}>{HEROES[card.playerId]}</div>
                    <div className="text-[8px] text-white/40 uppercase tracking-wider truncate">{ticker}</div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
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
  const color = count >= max ? "bg-gradient-to-r from-purple-500 to-blue-500" : "bg-white/40";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-400">{count}/{max}</span>
    </div>
  );
}
