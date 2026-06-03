"use client";

import {
  HEROES, COIN_TICKERS, COIN_ICONS,
  CARD_TIER_STYLES, TIER_NAMES, ALL_TEAMS,
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
  const accentBg = isDark ? "var(--paper-2)" : "var(--paper)";
  return (
    <div className="mt-2 space-y-4">
      {mpError && <div className="rounded-xl p-3 text-sm font-semibold" style={{ border: "2px solid var(--down)", background: "var(--paper-2)", color: "var(--down)", boxShadow: "2px 2px 0 var(--down)" }}>{mpError}</div>}

      {/* My active listings */}
      {(() => {
        const myListings = mpListings
          .filter((l) => accountAddress && l.seller.toLowerCase() === accountAddress.toLowerCase())
          .sort((a, b) => Number(a.price) - Number(b.price) || a.id - b.id);
        if (myListings.length === 0) return null;
        return (
          <div className="rounded-2xl p-4" style={{ border: "2.5px solid var(--outline)", boxShadow: "4px 4px 0 var(--card-shadow)", background: accentBg }}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-2)" }}>{lang === "ru" ? "Мои лоты" : "My lots"} <span className="normal-case tracking-normal font-normal" style={{ color: "var(--ink-3)" }}>({myListings.length})</span></div>
              {myListings.length > MY_LISTINGS_PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setMyListingsPage(p => Math.max(0, p - 1))} disabled={myListingsPage === 0}
                    className="btn-sticker-ghost h-6 w-6 p-0 text-xs">‹</button>
                  <span className="px-1 text-[10px]" style={{ color: "var(--ink-3)" }}>{myListingsPage + 1}/{Math.ceil(myListings.length / MY_LISTINGS_PAGE_SIZE)}</span>
                  <button onClick={() => setMyListingsPage(p => Math.min(Math.ceil(myListings.length / MY_LISTINGS_PAGE_SIZE) - 1, p + 1))} disabled={myListingsPage >= Math.ceil(myListings.length / MY_LISTINGS_PAGE_SIZE) - 1}
                    className="btn-sticker-ghost h-6 w-6 p-0 text-xs">›</button>
                </div>
              )}
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {myListings.slice(myListingsPage * MY_LISTINGS_PAGE_SIZE, (myListingsPage + 1) * MY_LISTINGS_PAGE_SIZE).map((l) => {
                const primerFill = (["var(--rarity-common)","var(--rarity-rare)","var(--rarity-epic)","var(--rarity-legendary)"] as const)[l.tier] ?? "var(--rarity-common)";
                return (
                  <div key={l.id} className="flex flex-col gap-2 rounded-xl p-2.5" style={{ border: "2px solid var(--outline)", background: "var(--paper-3)", boxShadow: "2px 2px 0 var(--outline)" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={COIN_ICONS[l.playerId]} alt={HEROES[l.playerId]}
                        className="h-8 w-8 shrink-0 rounded-lg object-cover opacity-80" style={{ border: "2px solid var(--outline)", background: primerFill }} referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{HEROES[l.playerId]}</div>
                        <div className="truncate text-[10px]" style={{ color: "var(--ink-3)" }}>{TIER_NAMES[l.tier]} · {(Number(l.price) / 1e18).toFixed(4)} ETH</div>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-3)" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder={lang === "ru" ? "Поиск по тикеру или монете…" : "Search ticker or coin…"}
            value={mpSearchTicker}
            onChange={(e) => setMpSearchTicker(e.target.value)}
            className="input-sticker w-full py-2 pl-8 pr-8 font-mono text-xs tracking-wide"
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
            { t: 2,    label: lang === "ru" ? "Тяжелое" : "Heavy" },
            { t: 3,    label: lang === "ru" ? "Супер Тяжелое" : "Super Heavy" },
          ] as { t: number | null; label: string }[]).map(({ t, label }) => {
            const active = mpFilterTier === t;
            return (
              <button key={t ?? "all"} onClick={() => setMpFilterTier(t)}
                style={{
                  padding: "8px 14px", whiteSpace: "nowrap",
                  background: active ? "var(--header-btn-active-bg)" : "var(--header-btn-bg)",
                  color: active ? "var(--ink)" : "var(--ink-2)", border: "2.5px solid var(--outline)", borderRadius: 999,
                  fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                  boxShadow: active ? "var(--filter-btn-shadow-active)" : "var(--filter-btn-shadow)",
                  transition: "background .12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--filter-btn-hover-bg)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--header-btn-active-bg)" : "var(--header-btn-bg)"; }}>
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
                  background: active ? "var(--header-btn-active-bg)" : "var(--header-btn-bg)",
                  color: active ? "var(--ink)" : "var(--ink-2)", border: "2.5px solid var(--outline)", borderRadius: 999,
                  fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                  boxShadow: active ? "var(--filter-btn-shadow-active)" : "var(--filter-btn-shadow)",
                  transition: "background .12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--filter-btn-hover-bg)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--header-btn-active-bg)" : "var(--header-btn-bg)"; }}>
                {team ?? (lang === "ru" ? "Все" : "All")}
              </button>
            );
          })}
        </div>
      </div>

      {/* All listings grid */}
      {mpFiltered.length === 0 ? (
        <div className="card-sticker p-10 text-center text-sm" style={{ color: "var(--ink-3)" }} data-tour="market-cards">
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
              const primerFill = (["var(--rarity-common)","var(--rarity-rare)","var(--rarity-epic)","var(--rarity-legendary)"] as const)[l.tier] ?? "var(--rarity-common)";
              const eggW = ([72, 88, 108, 120] as const)[l.tier] ?? 88;
              return (
                <article key={l.id} className="anim-card-entry" style={{ animationDelay: `${cardIdx * 30}ms`, height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{
                    background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 18,
                    boxShadow: isLegendary ? "4px 4px 0 var(--card-shadow), 8px 8px 0 var(--rarity-legendary)" : "4px 4px 0 var(--card-shadow)",
                    padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative", height: "100%", justifyContent: "flex-start",
                  }}>
                    {/* rarity chip + mine badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: primerFill, color: "var(--ink)",
                        border: "2.5px solid var(--outline)", borderRadius: 999,
                        padding: "3px 9px", fontSize: 9, letterSpacing: 1.6, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--card-shadow)",
                      }}>
                        {ts.label}
                      </div>
                      {isOwn && (
                        <div style={{
                          fontSize: 9, letterSpacing: 1.5, fontWeight: 800, padding: "3px 8px",
                          borderRadius: 999, background: primerFill, color: "var(--ink)",
                          border: "2.5px solid var(--outline)", boxShadow: "2px 2px 0 var(--card-shadow)",
                        }}>{lang === "ru" ? "МОЙ" : "MINE"}</div>
                      )}
                    </div>

                    {/* image plate */}
                    <div style={{
                      height: 140, borderRadius: 14, background: primerFill,
                      border: "2.5px solid var(--outline)", display: "grid", placeItems: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      <div aria-hidden style={{
                        position: "absolute", inset: 0,
                        background: "transparent", opacity: 0.12,
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
                    <div style={{ fontFamily: "Roobert, system-ui, sans-serif", fontWeight: 600, fontSize: 12, color: "var(--ink-3)" }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink-2)", fontFamily: "inherit" }}>{(Number(l.price) / 1e18).toFixed(4)}</span>
                      <span style={{ color: "var(--ink-2)", fontWeight: 700, fontSize: 11 }}>{" ETH"}</span>
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
                className="btn-sticker-outline px-3 py-1.5 text-xs">
                ←
              </button>
              <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
                {mpPage + 1} / {Math.ceil(mpFiltered.length / MP_PAGE_SIZE)}
              </span>
              <button
                onClick={() => setMpPage((p) => Math.min(Math.ceil(mpFiltered.length / MP_PAGE_SIZE) - 1, p + 1))}
                disabled={mpPage >= Math.ceil(mpFiltered.length / MP_PAGE_SIZE) - 1}
                className="btn-sticker-outline px-3 py-1.5 text-xs">
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
