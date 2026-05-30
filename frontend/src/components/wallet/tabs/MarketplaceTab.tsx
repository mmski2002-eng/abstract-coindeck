"use client";

import {
  HEROES, COIN_TICKERS, COIN_ICONS,
  CARD_TIER_STYLES, TIER_COLORS, TIER_NAMES, ALL_TEAMS,
} from "../constants";
import type { Listing } from "../types";

type Props = {
  lang: string;
  mpError: string;
  mpListings: Listing[];
  mpFiltered: Listing[];
  mpFilteredPage: Listing[];
  mpFilterTier: number | null;
  setMpFilterTier: (v: number | null) => void;
  mpFilterTeam: string | null;
  setMpFilterTeam: (v: string | null) => void;
  mpSearchTicker: string;
  setMpSearchTicker: (v: string) => void;
  mpRefreshing: boolean;
  mpPage: number;
  setMpPage: React.Dispatch<React.SetStateAction<number>>;
  myListingsPage: number;
  setMyListingsPage: React.Dispatch<React.SetStateAction<number>>;
  accountAddress: string | null;
  hasWalletAccount: boolean;
  busy: string | null;
  onBuyCard: (id: number) => void;
  onCancelListing: (id: number) => void;
  isDark?: boolean;
};

const MP_PAGE_SIZE = 15;
const MY_LISTINGS_PAGE_SIZE = 8;

export function MarketplaceTab({
  lang,
  mpError,
  mpListings,
  mpFiltered,
  mpFilteredPage,
  mpFilterTier,
  setMpFilterTier,
  mpFilterTeam,
  setMpFilterTeam,
  mpSearchTicker,
  setMpSearchTicker,
  mpRefreshing,
  mpPage,
  setMpPage,
  myListingsPage,
  setMyListingsPage,
  accountAddress,
  hasWalletAccount,
  busy,
  onBuyCard,
  onCancelListing,
  isDark = false,
}: Props) {
  const accentBg = isDark ? "#141B23" : "#F4EFE2";
  return (
    <div className="mt-2 space-y-4">
      {mpError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{mpError}</div>}

      {/* My active listings */}
      {(() => {
        const myListings = mpListings
          .filter((l) => accountAddress && l.seller.toLowerCase() === accountAddress.toLowerCase())
          .sort((a, b) => Number(a.price) - Number(b.price) || a.id - b.id);
        if (myListings.length === 0) return null;
        return (
          <div className="rounded-2xl p-4" style={{ border: "2.5px solid var(--ink)", boxShadow: "4px 4px 0 var(--card-shadow)", background: accentBg }}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display font-bold uppercase tracking-widest text-xs text-white/70">{lang === "ru" ? "Мои лоты" : "My lots"} <span className="text-zinc-600 normal-case tracking-normal font-normal">({myListings.length})</span></div>
              {myListings.length > MY_LISTINGS_PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setMyListingsPage(p => Math.max(0, p - 1))} disabled={myListingsPage === 0}
                    className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 bg-white/5 transition text-xs">‹</button>
                  <span className="text-[10px] text-zinc-500 px-1">{myListingsPage + 1}/{Math.ceil(myListings.length / MY_LISTINGS_PAGE_SIZE)}</span>
                  <button onClick={() => setMyListingsPage(p => Math.min(Math.ceil(myListings.length / MY_LISTINGS_PAGE_SIZE) - 1, p + 1))} disabled={myListingsPage >= Math.ceil(myListings.length / MY_LISTINGS_PAGE_SIZE) - 1}
                    className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 bg-white/5 transition text-xs">›</button>
                </div>
              )}
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {myListings.slice(myListingsPage * MY_LISTINGS_PAGE_SIZE, (myListingsPage + 1) * MY_LISTINGS_PAGE_SIZE).map((l) => {
                const tc = TIER_COLORS[l.tier];
                const primerFill = (["#D9D3C2","#7AC7E8","#26C6A8","#88FC00"] as const)[l.tier] ?? "#D9D3C2";
                return (
                  <div key={l.id} className={`flex flex-col gap-2 rounded-xl border p-2.5 ${tc.border}`} style={{ background: isDark ? "#1B232C" : "var(--card)" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={COIN_ICONS[l.playerId]} alt={HEROES[l.playerId]}
                        className="h-8 w-8 rounded-lg object-cover opacity-80 shrink-0" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{HEROES[l.playerId]}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{TIER_NAMES[l.tier]} · {(Number(l.price) / 1e18).toFixed(4)} ETH</div>
                      </div>
                    </div>
                    <button onClick={() => onCancelListing(l.id)} disabled={busy !== null}
                      className="btn-sticker-outline"
                      style={{ width: "100%", padding: "6px 10px", justifyContent: "center", fontSize: "0.7rem", borderColor: primerFill }}>
                      {busy === `mp_cancel_${l.id}` ? "…" : (lang === "ru" ? "Снять" : "Cancel")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Filter panel */}
      <div className="space-y-2.5" data-tour="market-filters">
        {/* Ticker search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder={lang === "ru" ? "Поиск по тикеру или монете…" : "Search ticker or coin…"}
            value={mpSearchTicker}
            onChange={(e) => setMpSearchTicker(e.target.value)}
            className="w-full rounded-xl pl-8 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/40 font-mono tracking-wide"
            style={{ border: "2.5px solid var(--ink)", color: "var(--panel-text)", boxShadow: "4px 4px 0 var(--card-shadow)", background: accentBg }}
          />
          {mpSearchTicker && (
            <button
              onClick={() => setMpSearchTicker("")}
            className="absolute inset-y-0 right-2.5 flex items-center transition text-xs" style={{ color: "var(--panel-text-muted)" }}>✕</button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap pb-1">
          {([
            { t: null, label: lang === "ru" ? "Все" : "All" },
            { t: 0,    label: lang === "ru" ? "Маленькое" : "Small" },
            { t: 1,    label: lang === "ru" ? "Среднее" : "Medium" },
            { t: 2,    label: lang === "ru" ? "Большое" : "Heavy" },
            { t: 3,    label: lang === "ru" ? "Тяжёлое" : "Super Heavy" },
          ] as { t: number | null; label: string }[]).map(({ t, label }) => {
            const active = mpFilterTier === t;
            return (
              <button key={t ?? "all"} onClick={() => setMpFilterTier(t)}
                style={{
                  padding: "8px 14px", whiteSpace: "nowrap",
                  background: active ? "var(--mint)" : "var(--paper-3)",
                  color: "var(--header-btn-color)", border: "2.5px solid var(--ink)", borderRadius: 999,
                  fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                  boxShadow: active ? "4px 4px 0 var(--card-shadow)" : "2px 2px 0 var(--card-shadow)",
                  transition: "background .12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sky-soft)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--mint)" : "var(--paper-3)"; }}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-wrap">
          {([null, ...ALL_TEAMS] as (string | null)[]).map((team) => {
            const active = mpFilterTeam === team;
            return (
              <button key={team ?? "all"} onClick={() => setMpFilterTeam(team)}
                style={{
                  padding: "8px 14px", whiteSpace: "nowrap",
                  background: active ? "var(--mint)" : "var(--paper-3)",
                  color: "var(--header-btn-color)", border: "2.5px solid var(--ink)", borderRadius: 999,
                  fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                  boxShadow: active ? "4px 4px 0 var(--card-shadow)" : "2px 2px 0 var(--card-shadow)",
                  transition: "background .12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sky-soft)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--mint)" : "var(--paper-3)"; }}>
                {team ?? (lang === "ru" ? "Все" : "All")}
              </button>
            );
          })}
        </div>
      </div>

      {/* All listings grid */}
      {mpFiltered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-zinc-500" data-tour="market-cards">
          {mpRefreshing ? (lang === "ru" ? "Загрузка…" : "Loading…") : (lang === "ru" ? "Нет активных лотов" : "No active listings")}
        </div>
      ) : (
        <>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" data-tour="market-cards">
            {mpFilteredPage.map((l, cardIdx) => {
              const ts = CARD_TIER_STYLES[l.tier] ?? CARD_TIER_STYLES[0];
              const ticker = COIN_TICKERS[l.playerId];
              const coinIcon = COIN_ICONS[l.playerId];
              const isOwn = accountAddress && l.seller.toLowerCase() === accountAddress.toLowerCase();
              const buyKey = `mp_buy_${l.id}`;
              const isLegendary = l.tier === 3;
              const primerFill = (["#D9D3C2","#7AC7E8","#26C6A8","#88FC00"] as const)[l.tier] ?? "#D9D3C2";
              const eggW = ([72, 88, 108, 120] as const)[l.tier] ?? 88;
              return (
                <article key={l.id} className="anim-card-entry" style={{ animationDelay: `${cardIdx * 30}ms`, height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{
                    background: "var(--paper-2)", border: "2.5px solid var(--ink)", borderRadius: 18,
                    boxShadow: isLegendary ? "4px 4px 0 var(--card-shadow), 8px 8px 0 #88FC00" : "4px 4px 0 var(--card-shadow)",
                    padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative", height: "100%", justifyContent: "flex-start",
                  }}>
                    {/* rarity chip + mine badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: primerFill, color: "var(--ink)",
                        border: "2.5px solid var(--ink)", borderRadius: 999,
                        padding: "3px 9px", fontSize: 9, letterSpacing: 1.6, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--card-shadow)",
                      }}>
                        {ts.label}
                      </div>
                      {isOwn && (
                        <div style={{
                          fontSize: 9, letterSpacing: 1.5, fontWeight: 800, padding: "3px 8px",
                          borderRadius: 999, background: primerFill, color: "var(--ink)",
                          border: "2.5px solid var(--ink)", boxShadow: "2px 2px 0 var(--card-shadow)",
                        }}>{lang === "ru" ? "МОЙ" : "MINE"}</div>
                      )}
                    </div>

                    {/* image plate */}
                    <div style={{
                      height: 140, borderRadius: 14, background: primerFill,
                      border: "2.5px solid var(--ink)", display: "grid", placeItems: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      <div aria-hidden style={{
                        position: "absolute", inset: 0,
                        backgroundImage: "radial-gradient(var(--ink) 1.2px, transparent 1.4px)",
                        backgroundSize: "14px 14px", opacity: 0.12,
                      }} />
                      <div className="anim-float" style={{ position: "relative", width: eggW, height: eggW, animationDelay: `${(cardIdx % 3) * -2}s` }}>
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

                    {/* name + ticker */}
                    <div>
                      <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 15, letterSpacing: -0.2 }}>{HEROES[l.playerId]}</div>
                      <div style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: 1.6, marginTop: 2, fontWeight: 700 }}>{ticker}</div>
                    </div>

                    {/* price */}
                    <div style={{ fontFamily: 'ui-monospace,"JetBrains Mono",monospace', fontWeight: 600, fontSize: 12, color: "var(--ink-3)" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-2)", fontFamily: "inherit" }}>{(Number(l.price) / 1e18).toFixed(4)}</span>
                      <span style={{ color: "var(--ink-2)", fontWeight: 800 }}>{" ETH"}</span>
                    </div>

                    {/* action */}
                    <div style={{ marginTop: "auto" }}>
                      {isOwn ? (
                        <button onClick={() => onCancelListing(l.id)} disabled={busy !== null}
                          className="btn-sticker-outline"
                          style={{ width: "100%", padding: "10px 16px", justifyContent: "center", borderColor: primerFill }}>
                          {busy === `mp_cancel_${l.id}` ? "…" : (lang === "ru" ? "Снять" : "Cancel")}
                        </button>
                      ) : (
                        <button onClick={() => onBuyCard(l.id)} disabled={!hasWalletAccount || busy !== null}
                          className="btn-sticker-primary"
                          style={{ width: "100%", padding: "10px 16px", justifyContent: "center", background: primerFill, color: "var(--chest-buy-btn-text)" }}>
                          {busy === buyKey ? "…" : (lang === "ru" ? "Купить" : "Buy")}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {mpFiltered.length > MP_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setMpPage((p) => Math.max(0, p - 1))}
                disabled={mpPage === 0}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-30 transition">
                ←
              </button>
              <span className="text-xs text-zinc-400">
                {mpPage + 1} / {Math.ceil(mpFiltered.length / MP_PAGE_SIZE)}
              </span>
              <button
                onClick={() => setMpPage((p) => Math.min(Math.ceil(mpFiltered.length / MP_PAGE_SIZE) - 1, p + 1))}
                disabled={mpPage >= Math.ceil(mpFiltered.length / MP_PAGE_SIZE) - 1}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-30 transition">
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
