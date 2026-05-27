"use client";

import {
  HEROES, COIN_TICKERS, COIN_ICONS, COIN_BRAND_COLORS,
  CARD_TIER_STYLES, PLAYER_ROLES, ALL_TEAMS,
} from "../constants";
import type { QuickBuyMergeData, Tab } from "../types";

type CardData = { playerId: number; tier: number; cardAddr: string };
type CardGroup = { playerId: number; tier: number; count: number };
type ChestCounts = { wooden: number; iron: number; silver: number };
type ChestPrices = { wooden: number; iron: number; silver: number };
type ClaimState = { active: boolean; startTs: number; deadline: number; vaultBalance: number; claimDays: number } | null;
type ChestBuyModal = { type: number; label: string; emoji: string; rarity: string; desc: string; price: number; buyBg: string } | null;
type ChestOpenModal = { type: number; label: string; emoji: string; tier: number; available: number; grad: string; ring: string; buyBg: string } | null;

const ROSTER_PAGE_SIZE = 15;

type Props = {
  lang: string;
  walletConnected: boolean;
  hasWalletAccount: boolean;
  flCards: CardData[];
  flGroups: CardGroup[];
  flGroupsPage: CardGroup[];
  chestCounts: ChestCounts;
  chestPrices: ChestPrices;
  mergeReadyCount: number;
  flError: string;
  busy: string | null;
  newCardKeys: Set<string>;
  filterTeam: string | null;
  filterTier: number | null;
  sortBy: "progress" | "rarity";
  rosterPage: number;
  claimState: ClaimState;
  userClaimable: number;
  chestBuySuccess: number | null;
  setFilterTeam: (v: string | null) => void;
  setFilterTier: (v: number | null) => void;
  setSortBy: (v: "progress" | "rarity") => void;
  setRosterPage: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: (tab: Tab) => void;
  setChestBuyModal: (v: ChestBuyModal) => void;
  setChestBuyQty: (v: number) => void;
  setChestOpenModal: (v: ChestOpenModal) => void;
  setChestOpenQty: (v: number) => void;
  setSellModal: (v: { playerId: number; tier: number } | null) => void;
  setSellPrice: (v: string) => void;
  setTransferModal: (v: { playerId: number; tier: number; cardAddr: string } | null) => void;
  setTransferRecipient: (v: string) => void;
  setQuickBuyMergeModal: (v: QuickBuyMergeData | null) => void;
  onMerge: (playerId: number, tier: number, cardAddrsToBurn: string[]) => void;
  lockedCardAddrs: string[];
};

export function RosterTab({
  lang, walletConnected, hasWalletAccount, flCards, flGroups, flGroupsPage,
  chestCounts, chestPrices, mergeReadyCount, flError, busy, newCardKeys,
  filterTeam, filterTier, sortBy, rosterPage, claimState, userClaimable,
  chestBuySuccess, setFilterTeam, setFilterTier, setSortBy, setRosterPage,
  setActiveTab, setChestBuyModal, setChestBuyQty, setChestOpenModal, setChestOpenQty,
  setSellModal, setSellPrice, setTransferModal, setTransferRecipient, setQuickBuyMergeModal, onMerge,
  lockedCardAddrs,
}: Props) {
  return (
    <>
      {/* Stats bar */}
      {walletConnected && (
        <section className="relative mb-6" data-tour="roster-info">
          <div className="relative grid grid-cols-2 gap-3 rounded-3xl p-3 backdrop-blur-xl lg:grid-cols-4" style={{ border: "1px solid var(--info-block-shell-border)", background: "var(--info-block-shell)", boxShadow: "var(--info-block-shell-shadow)" }}>
            {([
              { label: lang === "ru" ? "НФТ" : "NFTs", value: String(flCards.length + chestCounts.wooden + chestCounts.iron + chestCounts.silver), unit: lang === "ru" ? "шт" : "pcs", accent: "from-violet-400/40 to-violet-600/10", delta: `${new Set(flCards.map((c) => c.playerId)).size} ${lang === "ru" ? "монет" : "coins"}` },
              { label: lang === "ru" ? "Сундуков" : "Chests", value: String(chestCounts.wooden + chestCounts.iron + chestCounts.silver), unit: lang === "ru" ? "шт" : "pcs", accent: "from-amber-400/40 to-amber-600/10", delta: `🪵×${chestCounts.wooden} 🪨×${chestCounts.iron} 🪙×${chestCounts.silver}` },
              { label: lang === "ru" ? "Готово к слиянию" : "Merge ready", value: String(mergeReadyCount), unit: lang === "ru" ? "стаков" : "stacks", accent: "from-fuchsia-400/40 to-fuchsia-600/10", delta: lang === "ru" ? "×5 → уровень выше" : "×5 → tier up" },
              { label: lang === "ru" ? "Эпик / Легенда" : "Epic / Legend", value: String(flCards.filter((c) => c.tier >= 2).length), unit: lang === "ru" ? "карт" : "cards", accent: "from-blue-400/40 to-blue-600/10", delta: lang === "ru" ? "редкие карточки" : "rare cards" },
            ] as const).map((s, i) => (
              <div key={i} className="relative group overflow-hidden rounded-2xl p-5 anim-card-entry" style={{ animationDelay: `${i * 80}ms`, border: "1px solid var(--info-block-card-border)", background: "var(--info-block-card)", boxShadow: "var(--info-block-card-shadow)" }}>
                <div className="relative flex items-start justify-between mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--info-block-label)" }}>{s.label}</span>
                </div>
                <div className="relative flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--info-block-value)" }}>{s.value}</span>
                  <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--info-block-meta)" }}>{s.unit}</span>
                </div>
                <div className="relative mt-2">
                  <span className="font-mono text-[11px]" style={{ color: "var(--info-block-delta)" }}>{s.delta}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main roster content */}
      <div className="space-y-4">
        {/* Chest shop */}
        <style>{`
          @keyframes chestBuyPop {
            0%   { opacity: 0; transform: scale(0.8); }
            30%  { opacity: 1; transform: scale(1.05); }
            70%  { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(1); }
          }
          @keyframes floatUp {
            0%   { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-40px); }
          }
          .chest-buy-flash { animation: chestBuyPop 2s ease-out forwards; }
          .chest-float-up  { animation: floatUp 1.8s ease-out forwards; }
        `}</style>
        <div className="space-y-6" data-tour="roster-chests">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r to-transparent" style={{ ["--tw-gradient-from" as string]: "var(--section-rule)", ["--tw-gradient-to" as string]: "rgba(255,255,255,0)" }} />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--section-label)" }}>{lang === "ru" ? "Магазин сундуков" : "Chest Shop"}</span>
            </div>
            <div className="hidden items-center gap-2 font-mono text-xs uppercase tracking-widest md:flex" style={{ color: "var(--section-label)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Drop rate · Live
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-7">
            {([
              {
                type: 0 as const,
                label:     lang === "ru" ? "Сундук хомяка" : "Hamster Chest",
                tierLabel: "Common",
                rarity:    "Common",
                dropLabel: lang === "ru" ? "Карточки Common" : "Common cards",
                buyBg:     "bg-sky-600 hover:bg-sky-500",
                accent:    "#38BDF8",
                accentSoft:"rgba(56,189,248,0.10)",
                glow:      "rgba(56,189,248,0.45)",
                floatCls:  "anim-float",
                count: chestCounts.wooden,
                price: chestPrices.wooden,
              },
              {
                type: 1 as const,
                label:     lang === "ru" ? "Сундук медведя" : "Bear Chest",
                tierLabel: "Rare",
                rarity:    "Rare",
                dropLabel: lang === "ru" ? "Карточки Rare+" : "Rare+ cards",
                buyBg:     "bg-blue-600 hover:bg-blue-500",
                accent:    "#3B82F6",
                accentSoft:"rgba(59,130,246,0.10)",
                glow:      "rgba(59,130,246,0.45)",
                floatCls:  "anim-float-delay",
                count: chestCounts.iron,
                price: chestPrices.iron,
              },
              {
                type: 2 as const,
                label:     lang === "ru" ? "Сундук быка" : "Bull Chest",
                tierLabel: "Epic",
                rarity:    "Epic",
                dropLabel: lang === "ru" ? "Карточки Epic+" : "Epic+ cards",
                buyBg:     "bg-purple-600 hover:bg-purple-500",
                accent:    "#A855F7",
                accentSoft:"rgba(168,85,247,0.10)",
                glow:      "rgba(168,85,247,0.45)",
                floatCls:  "anim-float-delay-2",
                count: chestCounts.silver,
                price: chestPrices.silver,
              },
            ]).map(({ type, label, tierLabel, rarity, dropLabel, buyBg, accent, accentSoft, glow, floatCls, count, price }) => {
              const has = count > 0;
              const isBuying = busy === `fl_buy_${type}`;
              const isOpening = busy === `fl_open_${type}`;
              const justBought = chestBuySuccess === type;
              const chestImg = ["/chests/wooden_closed.webp", "/chests/iron_closed.webp", "/chests/silver_closed.webp"][type];
              const descMap: Record<number, { ru: string; en: string; emoji: string }> = {
                0: { emoji: "🐹", ru: "Гарантированная карточка Tier 1. Хороший старт для новичков.", en: "Guaranteed Tier 1 card. A great start for newcomers." },
                1: { emoji: "🐻", ru: "Гарантированная карточка Tier 2. Сильнее обычной — больше очков в турнире.", en: "Guaranteed Tier 2 card. Stronger than common — more points in tournaments." },
                2: { emoji: "🐂", ru: "Гарантированная карточка Tier 3. Максимальная сила — лучший выбор для топ-составов.", en: "Guaranteed Tier 3 card. Maximum power — best choice for top lineups." },
              };
              return (
                <article key={type} className="group relative aspect-square rounded-[28px] p-px overflow-hidden select-none"
                  style={{ background: "var(--chest-card-border)" }}>
                  <div
                    className="relative h-full rounded-[27px] overflow-hidden"
                    style={{ background: "var(--chest-card-bg)", border: "1px solid transparent", boxShadow: "var(--chest-card-shadow)" }}
                  >
                    <div className="relative z-10 grid h-full grid-rows-[5rem_1fr_auto] p-4 sm:grid-rows-[5.5rem_1fr_auto] sm:p-5">
                      <div className="min-h-[4.5rem] sm:min-h-[5rem]">
                        <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.25em]"
                            style={{ color: accent, borderColor: `${accent}60`, background: accentSoft }}
                          >
                            {tierLabel}
                          </span>
                          <h3 className="min-w-0 pt-0.5 font-display text-sm font-semibold uppercase tracking-tight sm:text-base" style={{ color: accent }}>
                            {label}
                          </h3>
                        </div>
                        {has && (
                          <div
                            className="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-md"
                            style={{ background: "var(--chest-card-pill-bg)", borderColor: "var(--chest-card-pill-border)" }}
                          >
                            <span className="font-mono text-[11px] font-semibold tracking-widest" style={{ color: accent }}>×{count}</span>
                          </div>
                        )}
                        </div>
                      </div>

                      <div className="relative flex min-h-0 items-center justify-center px-5 py-2">
                        <div className="relative -top-[10px]">
                          <div className={`relative ${floatCls} aspect-square w-full max-w-[128px] sm:max-w-[148px]`}>
                            <img
                              src={chestImg}
                              alt={label}
                              loading="lazy"
                              className="relative z-10 h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.26)] transition-transform duration-700 group-hover:scale-[1.05]"
                            />
                            {[{ cls:"top-[8%] left-[12%]", d:0 }, { cls:"top-[18%] right-[10%]", d:0.6 }, { cls:"bottom-[18%] left-[18%]", d:1.2 }, { cls:"top-[10%] right-[18%]", d:0.9 }].map((sp, si) => (
                              <span key={si} aria-hidden className={`absolute pointer-events-none anim-sparkle ${sp.cls}`} style={{ animationDelay: `${sp.d}s`, color: accent }}>
                                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z"/></svg>
                              </span>
                            ))}
                          </div>
                        </div>

                        {justBought && (
                          <div className="chest-buy-flash absolute inset-0 z-20 flex items-center justify-center rounded-[22px] bg-zinc-300/20 backdrop-blur-sm">
                            <span className="chest-float-up text-3xl font-black text-white">?</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3">
                        <div className="mb-2 flex items-center gap-2">
                          <svg width="12" height="12" viewBox="0 0 14 14" fill={accent}><path d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z"/></svg>
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] sm:text-[11px]" style={{ color: accent }}>{dropLabel}</span>
                        </div>

                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0 self-end translate-y-[6px] sm:translate-y-[7px]">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-display text-[1.7rem] font-bold tabular-nums tracking-tight sm:text-[2rem]" style={{ color: accent }}>{(price / 1e8).toFixed(2)}</span>
                              <span className="font-mono text-[10px] uppercase tracking-widest sm:text-xs" style={{ color: "var(--chest-card-text-muted)" }}>MOVE</span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              const d = descMap[type];
                              setChestBuyQty(1);
                              setChestBuyModal({ type, label, emoji: d.emoji, rarity, desc: lang === "ru" ? d.ru : d.en, price, buyBg });
                            }}
                            disabled={!hasWalletAccount || busy !== null}
                            className="rounded-full px-4 py-2 font-display text-sm font-semibold tracking-tight text-black transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-40 sm:px-5 sm:py-2.5"
                            style={{ background: `linear-gradient(135deg, ${accent}, #ffffff)`, boxShadow: `0 10px 30px -8px ${glow}` }}
                          >
                            {isBuying ? "…" : (lang === "ru" ? "Купить" : "Buy")}
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            if (!busy && has) {
                              setChestOpenQty(1);
                              setChestOpenModal({ type, label, emoji: descMap[type].emoji, tier: type, available: count, grad: "", ring: "", buyBg });
                            }
                          }}
                          disabled={!has || busy !== null}
                          className="group/open relative mt-3 w-full overflow-hidden rounded-full border px-4 py-2.5 font-display text-sm font-semibold tracking-tight transition-all hover:bg-white/5 sm:px-5 sm:py-3"
                          style={{
                            borderColor: has ? `${accent}70` : "var(--chest-open-disabled-border)",
                            color: has ? accent : "var(--chest-open-disabled-text)",
                          }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z"/></svg>
                            {isOpening ? "…" : has ? (lang === "ru" ? `Открыть ×${count}` : `Open ×${count}`) : (lang === "ru" ? "Нет сундуков" : "None owned")}
                          </span>
                          <span
                            aria-hidden
                            className="absolute inset-0 -translate-x-full transition-transform duration-700 group-hover/open:translate-x-full"
                            style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)` }}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {flError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{flError}</div>
        )}

        {/* Claim banner */}
        {claimState?.active && userClaimable > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-amber-900/20 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-amber-300">🎉 {lang === "ru" ? "Доступен приз!" : "Prize available!"}</div>
              <div className="text-xs text-amber-400/80 mt-0.5">
                {(userClaimable / 1e8).toFixed(4)} MOVE
                {claimState.deadline > 0 && (
                  <> · {lang === "ru" ? "до" : "until"} {new Date(claimState.deadline * 1000).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" })}</>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveTab("tournament")}
              className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-black transition">
              {lang === "ru" ? "Забрать →" : "Claim →"}
            </button>
          </div>
        )}

        {/* Filter & sort bar */}
        <style>{`
          @keyframes legendaryBorder {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .card-legendary-border::before {
            content:''; position:absolute; inset:-1px; border-radius:inherit; z-index:0;
            background: linear-gradient(90deg,#f59e0b,#fbbf24,#f97316,#ef4444,#f59e0b);
            background-size: 300% 300%;
            animation: legendaryBorder 3s ease infinite;
          }
          .card-legendary-border > * { position:relative; z-index:1; }
        `}</style>
        {flCards.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                {[null, ...ALL_TEAMS].map((team) => {
                  const active = filterTeam === team;
                  return (
                    <button key={team ?? "all"} onClick={() => setFilterTeam(team)}
                      className={`whitespace-nowrap font-display font-bold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-md transition-all ${
                        active
                          ? "text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/50"
                          : "text-gray-400 bg-white/[0.02] border border-white/10 hover:text-white hover:border-white/30"
                      }`}
                      style={active ? { boxShadow: "inset 0 -2px 0 #00FF66, 0 0 12px rgba(0,255,102,0.22)" } : {}}>
                      {team ?? (lang === "ru" ? "Все" : "All")}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 bg-white/[0.04] border border-white/5 rounded-full p-1 text-xs font-medium shrink-0 pb-1">
                {([
                  { value: "progress" as const, labelRu: "ПРОГРЕСС", labelEn: "PROGRESS" },
                  { value: "rarity" as const,   labelRu: "РЕДКОСТЬ", labelEn: "RARITY" },
                ]).map(({ value, labelRu, labelEn }) => {
                  const active = sortBy === value;
                  return (
                    <button key={value} type="button" onClick={() => setSortBy(value)}
                      className={`whitespace-nowrap font-display font-bold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-md transition-all ${
                        active
                          ? "text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/50"
                          : "text-gray-400 bg-white/[0.02] border border-white/10 hover:text-white hover:border-white/30"
                      }`}
                      style={active ? { boxShadow: "inset 0 -2px 0 #00FF66, 0 0 12px rgba(0,255,102,0.22)" } : {}}
                      aria-pressed={active}>
                      {lang === "ru" ? labelRu : labelEn}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap pb-1">
              {([
                { id: null, label: lang === "ru" ? "Все" : "All" },
                { id: 0,    label: "Common" },
                { id: 1,    label: "Rare" },
                { id: 2,    label: "Epic" },
                { id: 3,    label: "Legendary" },
              ] as { id: number | null; label: string }[]).map(({ id, label }) => {
                const active = filterTier === id;
                return (
                  <button key={id ?? "all"} onClick={() => setFilterTier(id)}
                    className={`whitespace-nowrap font-display font-bold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-md transition-all ${
                      active
                        ? "text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/50"
                        : "text-gray-400 bg-white/[0.02] border border-white/10 hover:text-white hover:border-white/30"
                    }`}
                    style={active ? { boxShadow: "inset 0 -2px 0 #00FF66, 0 0 12px rgba(0,255,102,0.22)" } : {}}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Card grid */}
        {flCards.length === 0 && chestCounts.wooden + chestCounts.iron + chestCounts.silver === 0 ? (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" data-tour="roster-cards">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/5 bg-black/20 opacity-40">
                <div className="aspect-[3/4] w-full bg-white/5 flex items-center justify-center">
                  <span className="text-3xl">🔒</span>
                </div>
                <div className="p-3">
                  <div className="h-2 w-12 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-16 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-5 text-center text-sm text-zinc-500 pt-2">
              {lang === "ru" ? "Открой сундук чтобы получить первую карточку" : "Open a chest to get your first card"}
            </div>
          </div>
        ) : flGroups.length === 0 && (filterTeam !== null || filterTier !== null) ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-sm text-zinc-400">
              {lang === "ru" ? "Нет карточек по выбранному фильтру" : "No cards match the selected filter"}
            </div>
            <button onClick={() => { setFilterTeam(null); setFilterTier(null); }}
              className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15 transition">
              {lang === "ru" ? "Сбросить фильтры" : "Clear filters"}
            </button>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" data-tour="roster-cards">
            {/* Chest items in the grid */}
            {!filterTeam && !filterTier && ([
              { type: 0 as const, label: lang === "ru" ? "Сундук хомяка" : "Hamster Chest", grad: "from-sky-900/50 to-cyan-900/30",    ring: "ring-sky-500/60",    buyBg: "bg-sky-700/70 hover:bg-sky-700",       count: chestCounts.wooden, tier: 0, emoji: "🐹" },
              { type: 1 as const, label: lang === "ru" ? "Сундук медведя" : "Bear Chest",   grad: "from-slate-700/50 to-blue-900/30",  ring: "ring-blue-500/60",   buyBg: "bg-blue-700/70 hover:bg-blue-700",     count: chestCounts.iron,   tier: 1, emoji: "🐻" },
              { type: 2 as const, label: lang === "ru" ? "Сундук быка" : "Bull Chest",      grad: "from-purple-900/50 to-violet-900/30", ring: "ring-purple-500/60", buyBg: "bg-purple-700/70 hover:bg-purple-700", count: chestCounts.silver, tier: 2, emoji: "🐂" },
            ]).filter(c => c.count > 0).map(({ type, label, grad, ring, buyBg, count, tier, emoji }) => {
              const isOpening = busy === `fl_open_${type}`;
              const chestImg = ["/chests/wooden_closed.webp", "/chests/iron_closed.webp", "/chests/silver_closed.webp"][type];
              const chestAccent = type === 0 ? "#38BDF8" : type === 1 ? "#60A5FA" : "#C084FC";
              const chestBorder = type === 0 ? "rgba(56,189,248,0.5)" : type === 1 ? "rgba(59,130,246,0.55)" : "rgba(168,85,247,0.6)";
              const chestGlow   = type === 0 ? "rgba(56,189,248,0.35)" : type === 1 ? "rgba(59,130,246,0.4)" : "rgba(168,85,247,0.45)";
              return (
                <article key={`chest_${type}`} className="group relative anim-card-entry select-none flex flex-col">
                  <div aria-hidden className="absolute -inset-1 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" style={{ background: chestGlow }} />
                  <div className="relative rounded-[20px] overflow-hidden h-full" style={{ padding: "1.5px", background: `linear-gradient(180deg, ${chestBorder}, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.01))` }}>
                    <div className="relative rounded-[18px] overflow-hidden flex flex-col h-full transition-transform duration-500 group-hover:-translate-y-1.5" style={{ background: "rgba(0,0,0,0.18)", boxShadow: `0 12px 40px -12px ${chestGlow}` }}>
                      <div className="relative aspect-[4/5] overflow-hidden grain" style={{ background: `linear-gradient(180deg, ${chestAccent}14 0%, rgba(0,0,0,0.04) 60%)` }}>
                        <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] aspect-square rounded-full" style={{ background: `radial-gradient(closest-side, ${chestGlow}, transparent 70%)`, filter: "blur(24px)" }} />
                        <div className="relative flex items-center justify-center w-full h-full">
                          <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${chestAccent}15, transparent 65%)` }} />
                          <img src={chestImg} alt={label} loading="lazy"
                            className={`relative z-10 w-20 h-20 object-contain drop-shadow-xl ${isOpening ? "animate-bounce" : "anim-float"}`}
                            style={{ filter: `drop-shadow(0 0 14px ${chestGlow})` }} />
                        </div>
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-1 rounded-md border backdrop-blur-md" style={{ color: chestAccent, borderColor: chestBorder, background: "rgba(0,0,0,0.4)" }}>
                            {type === 0 ? "Common" : type === 1 ? "Rare" : "Epic"}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border backdrop-blur-md" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.6)" }}>×{count}</span>
                        </div>
                      </div>
                      <div className="relative p-3.5 flex flex-col flex-1 border-t" style={{ background: "rgba(0,0,0,0.12)", borderColor: `${chestAccent}18` }}>
                        <div className="mb-3">
                          <h4 className="font-bold text-sm tracking-tight truncate uppercase" style={{ color: chestAccent }}>{label}</h4>
                          <span className="text-[10px] text-zinc-500 leading-tight">
                            {type === 0
                              ? (lang === "ru" ? "Common карточки" : "Common cards")
                              : type === 1
                              ? (lang === "ru" ? "Rare и выше" : "Rare and above")
                              : (lang === "ru" ? "Epic и выше" : "Epic and above")}
                          </span>
                        </div>
                        <div className="flex-1 min-h-0" />
                        <button
                          disabled={busy !== null}
                          onClick={() => {
                            if (busy) return;
                            setChestOpenQty(1);
                            setChestOpenModal({ type, label, emoji, tier, available: count, grad, ring, buyBg });
                          }}
                          className="w-full py-2 rounded-lg border text-xs font-semibold tracking-tight transition-colors disabled:opacity-40"
                          style={{ borderColor: chestBorder, color: chestAccent, background: "rgba(255,255,255,0.02)" }}>
                          {isOpening ? "…" : (lang === "ru" ? "Открыть" : "Open")}
                        </button>
                        <button
                          onClick={() => {
                            const d = { 0: { emoji: "🐹", ru: "Гарантированная карточка Tier 1.", en: "Guaranteed Tier 1 card." }, 1: { emoji: "🐻", ru: "Гарантированная карточка Tier 2.", en: "Guaranteed Tier 2 card." }, 2: { emoji: "🐂", ru: "Гарантированная карточка Tier 3.", en: "Guaranteed Tier 3 card." } }[type]!;
                            setChestBuyQty(1);
                            setChestBuyModal({ type, label, emoji: d.emoji, rarity: type === 0 ? "Common" : type === 1 ? "Rare" : "Epic", desc: lang === "ru" ? d.ru : d.en, price: type === 0 ? chestPrices.wooden : type === 1 ? chestPrices.iron : chestPrices.silver, buyBg });
                          }}
                          disabled={!hasWalletAccount || busy !== null}
                          className="w-full mt-1 py-2 rounded-lg border border-white/10 bg-white/[0.02] text-xs font-medium text-white/50 hover:bg-white/[0.05] disabled:opacity-40 transition">
                          {lang === "ru" ? "Купить ещё" : "Buy more"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {flGroupsPage.map(({ playerId, tier, count }, cardIdx) => {
              const lockedCount = lockedCardAddrs.filter(addr => {
                const fc = flCards.find(c => c.cardAddr === addr);
                return fc?.playerId === playerId && fc?.tier === tier;
              }).length;
              const availableCount = count - lockedCount;
              const isAllLocked = lockedCount > 0 && lockedCount >= count;
              const isPartialLocked = lockedCount > 0 && lockedCount < count;
              const canMerge = availableCount >= 5 && tier < 3;
              const canQuickBuy = tier < 3 && availableCount < 5;
              const neededCount = Math.max(0, 5 - availableCount);
              const mergeKey = `fl_merge_${playerId}_${tier}`;
              const mergeCardAddrs = flCards
                .filter((c) =>
                  c.playerId === playerId &&
                  c.tier === tier &&
                  !lockedCardAddrs.includes(c.cardAddr)
                )
                .slice(0, 5)
                .map((c) => c.cardAddr);
              const cardAddr = flCards.find(c => c.playerId === playerId && c.tier === tier)?.cardAddr ?? "";
              const unlockedCardAddr = lockedCount > 0
                ? (flCards.find(c => c.playerId === playerId && c.tier === tier && !lockedCardAddrs.includes(c.cardAddr))?.cardAddr ?? "")
                : cardAddr;
              const isNew = newCardKeys.has(`${playerId}_${tier}`);
              const ts = CARD_TIER_STYLES[tier] ?? CARD_TIER_STYLES[0];
              const brand = COIN_BRAND_COLORS[playerId] ?? "#6B7280";
              const ticker = COIN_TICKERS[playerId];
              const coinIcon = COIN_ICONS[playerId];
              const tickerFontSize = ticker.length <= 3 ? "3.5rem" : ticker.length <= 4 ? "2.8rem" : "2.2rem";
              const isLegendary = tier === 3;
              const isEpic = tier === 2;
              const isRare = tier === 1;
              const showLightning = tier >= 1;
              const tierHex = ts.color;
              const glowAnimation = tier === 1 ? "glow-pulse-rare 3s ease-in-out infinite" : tier === 2 ? "glow-pulse-epic 2.8s ease-in-out infinite" : tier === 3 ? "glow-pulse-legendary 2.5s ease-in-out infinite" : "";
              return (
                <article key={`${playerId}_${tier}`} className="group relative anim-card-entry transition-transform duration-150 active:scale-[0.97]" style={{ animationDelay: `${cardIdx * 40}ms` }}>
                  {glowAnimation && <div aria-hidden className="absolute inset-0 rounded-[22px] pointer-events-none" style={{ animation: glowAnimation }} />}
                  {showLightning && (
                    <div aria-hidden className="absolute inset-0 rounded-[22px] pointer-events-none opacity-50" style={{
                      background: `linear-gradient(115deg, transparent 30%, ${tierHex}55 50%, transparent 70%)`,
                      backgroundSize: "200% 100%",
                      animation: "lightning-sweep 3.5s linear infinite",
                      mixBlendMode: "screen",
                      zIndex: 1,
                    }} />
                  )}
                  {showLightning && (
                    <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
                      background: `radial-gradient(circle at 50% 0%, ${tierHex}22 0%, transparent 60%)`,
                      zIndex: 1,
                    }} />
                  )}
                  <div aria-hidden className="absolute -inset-1 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" style={{ background: ts.glow }} />
                  {isLegendary && <div aria-hidden className="absolute -inset-[2px] rounded-[22px] foil-perpetual" />}
                  <div className="relative rounded-[20px] overflow-hidden" style={{ padding: "1.5px", background: `linear-gradient(180deg, ${ts.border}, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.01))` }}>
                    <div className="relative rounded-[18px] overflow-hidden bg-[#0a0c18] flex flex-col transition-transform duration-500 group-hover:-translate-y-1.5" style={{ boxShadow: `0 12px 40px -12px ${ts.glow}` }}>
                      <div className="relative aspect-[4/5] overflow-hidden grain" style={{ background: ts.gradient }}>
                        <div className="relative flex items-center justify-center w-full h-full">
                          <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${brand}22, transparent 70%)` }} />
                          <div aria-hidden className="absolute inset-6 rounded-full border border-dashed opacity-30" style={{ borderColor: brand }} />
                          <div aria-hidden className="absolute inset-10 rounded-full border opacity-20" style={{ borderColor: brand }} />
                          <img src={coinIcon} alt="" aria-hidden
                            className="absolute w-24 h-24 object-contain select-none opacity-35 anim-float"
                            style={{ filter: `blur(1.5px) drop-shadow(0 0 10px ${brand}60)`, animationDelay: `${(cardIdx % 3) * -2}s` }} />
                          <span className="relative z-10 font-black leading-none tracking-tighter select-none" style={{ fontSize: tickerFontSize, color: brand, textShadow: `0 0 30px ${brand}80, 0 4px 20px rgba(0,0,0,0.6)` }}>{ticker}</span>
                        </div>
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-1 rounded-md border backdrop-blur-md" style={{ color: ts.color, borderColor: ts.border, background: "rgba(0,0,0,0.4)" }}>{ts.label}</span>
                        </div>
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border backdrop-blur-md" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.6)" }}>×{count}</span>
                        </div>
                        <div className="absolute bottom-2.5 left-2.5 z-10">
                          <span className="text-[9px] uppercase tracking-[0.22em] text-white/60">{PLAYER_ROLES[playerId]}</span>
                        </div>
                        {isAllLocked && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-none" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(1px)" }}>
                            <span className="text-2xl">🔒</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white/70 mt-0.5">{lang === "ru" ? "В игре" : "In play"}</span>
                          </div>
                        )}
                        {isPartialLocked && (
                          <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                            <span className="text-[10px]">🔒</span>
                            <span className="text-[9px] font-bold text-red-400">{lockedCount}</span>
                          </div>
                        )}
                        {isNew && <div className="absolute left-2 top-10 z-20 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-white">NEW</div>}
                        {(isRare || isEpic || isLegendary) && <div aria-hidden className="absolute inset-0 holo-sheen overflow-hidden" />}
                        <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ts.color}, transparent)` }} />
                      </div>
                      <div className="relative p-3.5 bg-[#0a0c18]/90">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm tracking-tight truncate" style={{ color: ts.color }}>{HEROES[playerId]}</h4>
                          </div>
                          {isLegendary && <div className="shrink-0 text-[10px] font-black text-amber-400">★ MAX</div>}
                        </div>
                        {tier < 3 ? (
                          <div className="mb-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">
                                {availableCount >= 5 ? (lang === "ru" ? "Готов к мерджу" : "Ready") : (lang === "ru" ? "До апгрейда" : "Upgrade")}
                              </span>
                              <span className="text-[10px] font-semibold tabular-nums text-white/70">{Math.min(availableCount, 5)}/5{isPartialLocked && <span className="text-red-400/70 ml-1">🔒{lockedCount}</span>}</span>
                            </div>
                            <div className="relative h-1.5 rounded-full bg-black/60 overflow-hidden">
                              <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{
                                width: `${Math.min(100, (availableCount / 5) * 100)}%`,
                                background: `linear-gradient(90deg, ${ts.color}, ${ts.color}aa)`,
                                boxShadow: `0 0 12px ${ts.glow}`,
                              }} />
                            </div>
                          </div>
                        ) : (
                          <div className="mb-1 h-[34px]" />
                        )}
                        {canMerge ? (
                          <button onClick={() => onMerge(playerId, tier, mergeCardAddrs)} disabled={busy !== null}
                            className="w-full mb-0.5 py-2 rounded-lg text-xs font-black text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 disabled:opacity-50 transition">
                            {busy === mergeKey ? "…" : "MERGE ×5"}
                          </button>
                        ) : canQuickBuy ? (
                          <button
                            onClick={() => setQuickBuyMergeModal({
                              playerId,
                              tier,
                              ownedCount: availableCount,
                              neededCount,
                            })}
                            disabled={busy !== null}
                            className="w-full mb-0.5 py-2 rounded-lg border text-xs font-semibold tracking-tight transition-all duration-150 hover:brightness-125 hover:scale-[1.03] active:scale-95 disabled:opacity-40"
                            style={{
                              borderColor: tier === 0 ? "rgba(255,255,255,0.65)" : ts.border,
                              color: tier === 0 ? "rgba(255,255,255,0.96)" : ts.color,
                              background: tier === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                              boxShadow: tier === 0 ? "0 0 18px rgba(255,255,255,0.16), inset 0 0 10px rgba(255,255,255,0.05)" : undefined,
                              textShadow: tier === 0 ? "0 0 12px rgba(255,255,255,0.35)" : undefined,
                            }}
                          >
                            {lang === "ru" ? "Быстрая покупка" : "Quick buy"}
                          </button>
                        ) : (
                          <div className="mb-0.5 h-[34px]" />
                        )}
                        <button onClick={() => { setSellModal({ playerId, tier }); setSellPrice("0.1"); }} disabled={busy !== null || availableCount === 0}
                          className="w-full py-2 rounded-lg border text-xs font-semibold tracking-tight transition-all duration-150 hover:brightness-125 hover:scale-[1.03] active:scale-95 disabled:opacity-40"
                          style={{
                            borderColor: isAllLocked ? "rgba(239,68,68,0.3)" : tier === 0 ? "rgba(255,255,255,0.65)" : ts.border,
                            color: isAllLocked ? "rgb(248,113,113)" : tier === 0 ? "rgba(255,255,255,0.96)" : ts.color,
                            background: tier === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                            boxShadow: tier === 0 && !isAllLocked ? "0 0 18px rgba(255,255,255,0.16), inset 0 0 10px rgba(255,255,255,0.05)" : undefined,
                            textShadow: tier === 0 && !isAllLocked ? "0 0 12px rgba(255,255,255,0.35)" : undefined,
                          }}
                          title={isAllLocked ? (lang === "ru" ? "Все карточки в лайнапе" : "All cards in lineup") : undefined}>
                          {isAllLocked ? "🔒" : (lang === "ru" ? "Продать" : "Sell")}
                        </button>
                        <button onClick={() => { setTransferModal({ playerId, tier, cardAddr: unlockedCardAddr }); setTransferRecipient(""); }} disabled={busy !== null || !unlockedCardAddr}
                          className="w-full mt-1 py-2 rounded-lg border border-white/10 bg-white/[0.02] text-xs font-medium text-white/50 hover:bg-white/[0.05] hover:scale-[1.03] active:scale-95 disabled:opacity-40 transition"
                          title={isAllLocked ? (lang === "ru" ? "Все карточки в лайнапе" : "All cards in lineup") : undefined}>
                          {isAllLocked ? "🔒" : (lang === "ru" ? "Отправить" : "Send")}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {flGroups.length > ROSTER_PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button onClick={() => setRosterPage((p) => Math.max(0, p - 1))} disabled={rosterPage === 0}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-30 transition">
              ←
            </button>
            <span className="text-xs text-zinc-400">
              {rosterPage + 1} / {Math.ceil(flGroups.length / ROSTER_PAGE_SIZE)}
            </span>
            <button onClick={() => setRosterPage((p) => Math.min(Math.ceil(flGroups.length / ROSTER_PAGE_SIZE) - 1, p + 1))} disabled={rosterPage >= Math.ceil(flGroups.length / ROSTER_PAGE_SIZE) - 1}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-30 transition">
              →
            </button>
          </div>
        )}

        {/* Brand logo */}
        <div className="flex justify-center pt-2 pb-1">
          <img src="/logo.svg" alt="CoinDeck" className="h-10 w-auto opacity-80" />
        </div>
      </div>
    </>
  );
}
