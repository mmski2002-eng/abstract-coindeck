"use client";

import {
  HEROES, COIN_TICKERS, COIN_ICONS, COIN_BRAND_COLORS,
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
}: Props) {
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
          <div className="rounded-2xl p-4" style={{ border: "1px solid var(--panel-border)", background: "var(--card)" }}>
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
                return (
                  <div key={l.id} className={`flex flex-col gap-2 rounded-xl border p-2.5 ${tc.border}`} style={{ background: "var(--card)" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={COIN_ICONS[l.playerId]} alt={HEROES[l.playerId]}
                        className="h-8 w-8 rounded-lg object-cover opacity-80 shrink-0" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{HEROES[l.playerId]}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{TIER_NAMES[l.tier]} · {(Number(l.price) / 1e18).toFixed(4)} ETH</div>
                      </div>
                    </div>
                    <button onClick={() => onCancelListing(l.id)} disabled={busy !== null}
                      className="w-full rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-2 py-1 text-[10px] font-medium text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50 transition">
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
            style={{ border: "1px solid var(--panel-border)", background: "var(--card)", color: "var(--panel-text)" }}
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
            { t: 0,    label: "Common" },
            { t: 1,    label: "Rare" },
            { t: 2,    label: "Epic" },
            { t: 3,    label: "Legendary" },
          ] as { t: number | null; label: string }[]).map(({ t, label }) => {
            const active = mpFilterTier === t;
            return (
              <button key={t ?? "all"} onClick={() => setMpFilterTier(t)}
                className={`whitespace-nowrap font-display font-bold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-md border transition-all${active ? " nav-tab-active" : ""}`}
                style={active ? {
                  color: "var(--filter-chip-active-text)",
                  borderColor: "var(--filter-chip-active-border)",
                } : {
                  color: "var(--filter-chip-text)",
                  background: "var(--filter-chip-bg)",
                  borderColor: "var(--filter-chip-border)",
                }}>
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
                className={`whitespace-nowrap font-display font-bold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-md border transition-all${active ? " nav-tab-active" : ""}`}
                style={active ? {
                  color: "var(--filter-chip-active-text)",
                  borderColor: "var(--filter-chip-active-border)",
                } : {
                  color: "var(--filter-chip-text)",
                  background: "var(--filter-chip-bg)",
                  borderColor: "var(--filter-chip-border)",
                }}>
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
              const brand = COIN_BRAND_COLORS[l.playerId] ?? "#6B7280";
              const ticker = COIN_TICKERS[l.playerId];
              const coinIcon = COIN_ICONS[l.playerId];
              const tickerFontSize = ticker.length <= 3 ? "3.5rem" : ticker.length <= 4 ? "2.8rem" : "2.2rem";
              const isOwn = accountAddress && l.seller.toLowerCase() === accountAddress.toLowerCase();
              const buyKey = `mp_buy_${l.id}`;
              const isLegendary = l.tier === 3;
              const isEpic = l.tier === 2;
              const isRare = l.tier === 1;
              return (
                <article key={l.id} className="group relative anim-card-entry" style={{ animationDelay: `${cardIdx * 30}ms` }}>
                  <div aria-hidden className="absolute -inset-1 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" style={{ background: ts.glow }} />
                  {isLegendary && <div aria-hidden className="absolute -inset-[2px] rounded-[22px] foil-perpetual" />}
                  <div className="relative rounded-[20px] overflow-hidden" style={{ padding: "1.5px", background: `linear-gradient(180deg, ${ts.border}, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.01))` }}>
                    <div className="relative rounded-[18px] overflow-hidden flex flex-col transition-transform duration-500 group-hover:-translate-y-1.5" style={{ background: "var(--card)", boxShadow: `0 12px 40px -12px ${ts.glow}` }}>
                      <div className="relative aspect-[4/5] overflow-hidden grain" style={{ background: ts.gradient }}>
                        <div className="relative flex items-center justify-center w-full h-full">
                          <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${brand}22, transparent 70%)` }} />
                          <div aria-hidden className="absolute inset-6 rounded-full border border-dashed opacity-30" style={{ borderColor: brand }} />
                          <div aria-hidden className="absolute inset-10 rounded-full border opacity-20" style={{ borderColor: brand }} />
                          <img
                            src={coinIcon}
                            alt=""
                            aria-hidden
                            className="absolute w-24 h-24 object-contain select-none opacity-35 anim-float"
                            style={{ filter: `blur(1.5px) drop-shadow(0 0 10px ${brand}60)`, animationDelay: `${(cardIdx % 3) * -2}s` }}
                          />
                          <span className="relative z-10 font-black leading-none tracking-tighter select-none" style={{ fontSize: tickerFontSize, color: brand, textShadow: `0 0 30px ${brand}80, 0 4px 20px rgba(0,0,0,0.6)` }}>{ticker}</span>
                        </div>
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-1 rounded-md border backdrop-blur-md" style={{ color: ts.color, borderColor: ts.border, background: "rgba(0,0,0,0.4)" }}>{ts.label}</span>
                        </div>
                        {isOwn && (
                          <div className="absolute top-2.5 right-2.5 z-10">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-md text-emerald-600 border-emerald-500/40" style={{ background: "var(--nft-badge-bg)" }}>{lang === "ru" ? "МОЙ" : "MINE"}</span>
                          </div>
                        )}
                        {(isRare || isEpic || isLegendary) && <div aria-hidden className="absolute inset-0 holo-sheen overflow-hidden" />}
                        <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ts.color}, transparent)` }} />
                      </div>
                      <div className="relative p-3.5" style={{ background: "var(--card)" }}>
                        <div className="flex items-start justify-between gap-2 mb-[10px]">
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-sm tracking-tight truncate">{HEROES[l.playerId]}</h4>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{ticker}</span>
                          </div>
                          <div className="shrink-0 font-black text-xs" style={{ color: ts.color }}>{(Number(l.price) / 1e18).toFixed(4)} ETH</div>
                        </div>
                        {isOwn ? (
                          <button onClick={() => onCancelListing(l.id)} disabled={busy !== null}
                            className="w-full py-2 rounded-lg border border-cyan-500/30 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 transition">
                            {busy === `mp_cancel_${l.id}` ? "…" : (lang === "ru" ? "Снять" : "Cancel")}
                          </button>
                        ) : (
                          <>
                            <button onClick={() => onBuyCard(l.id)} disabled={!hasWalletAccount || busy !== null}
                              className="w-full py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 transition">
                              {busy === buyKey ? "…" : (lang === "ru" ? "Купить" : "Buy")}
                            </button>
                            <div className="mt-1 text-[10px] text-white/30 text-center">
                              {lang === "ru" ? "Комиссия платформы" : "Platform fee"}: 5% ({(Number(l.price) * 0.05 / 1e18).toFixed(4)} ETH)
                            </div>
                          </>
                        )}
                        <div className="mt-1 text-[10px] text-white/30 truncate">{l.seller.slice(0, 6)}…{l.seller.slice(-4)}</div>
                      </div>
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
