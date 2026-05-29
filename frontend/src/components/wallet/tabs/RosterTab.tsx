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
          <div className="relative grid grid-cols-2 gap-3 rounded-3xl p-3 lg:grid-cols-4" style={{ border: "1px solid var(--info-block-shell-border)", background: "var(--info-block-shell)", boxShadow: "var(--info-block-shell-shadow)" }}>
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
          @keyframes chestBuyBounce {
            0%   { transform: scale(1)    translateX(0); }
            12%  { transform: scale(1.10) translateX(0); }
            25%  { transform: scale(0.95) translateX(0); }
            36%  { transform: scale(1.04) translateX(-5px); }
            48%  { transform: scale(1.01) translateX(5px); }
            60%  { transform: scale(1)    translateX(-3px); }
            72%  { transform: scale(1)    translateX(3px); }
            84%  { transform: scale(1)    translateX(-1px); }
            100% { transform: scale(1)    translateX(0); }
          }
          .chest-buy-flash  { animation: chestBuyPop 2s ease-out forwards; }
          .chest-float-up   { animation: floatUp 1.8s ease-out forwards; }
          .chest-buy-bounce { animation: chestBuyBounce 0.65s cubic-bezier(.17,.67,.35,1.3) both; }
        `}</style>
        <div className="space-y-6" data-tour="roster-chests">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="block h-0.5 w-6 rounded-full" style={{ background: "var(--section-rule)" }} />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--section-label)" }}>{lang === "ru" ? "Магазин сундуков" : "Chest Shop"}</span>
            </div>
            <div className="hidden items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest md:flex" style={{ color: "var(--section-label)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Drop rate · Live
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-7">
            {([
              {
                type: 0 as const,
                label:     lang === "ru" ? "Сундук хомяка" : "Hamster Chest",
                tierLabel: lang === "ru" ? "Маленькое" : "Small",
                rarity:    lang === "ru" ? "Маленькое" : "Small",
                dropLabel: lang === "ru" ? "Маленькие карточки" : "Small cards",
                accent:    "#D9D3C2",
                accentSoft:"rgba(217,211,194,0.25)",
                floatCls:  "anim-float",
                count: chestCounts.wooden,
                price: chestPrices.wooden,
              },
              {
                type: 1 as const,
                label:     lang === "ru" ? "Сундук медведя" : "Bear Chest",
                tierLabel: lang === "ru" ? "Среднее" : "Medium",
                rarity:    lang === "ru" ? "Среднее" : "Medium",
                dropLabel: lang === "ru" ? "Средние карточки" : "Medium cards",
                accent:    "#7AC7E8",
                accentSoft:"rgba(122,199,232,0.20)",
                floatCls:  "anim-float-delay",
                count: chestCounts.iron,
                price: chestPrices.iron,
              },
              {
                type: 2 as const,
                label:     lang === "ru" ? "Сундук быка" : "Bull Chest",
                tierLabel: lang === "ru" ? "Большое" : "Heavy",
                rarity:    lang === "ru" ? "Большое" : "Heavy",
                dropLabel: lang === "ru" ? "Большие карточки" : "Large cards",
                accent:    "#26C6A8",
                accentSoft:"rgba(38,198,168,0.18)",
                floatCls:  "anim-float-delay-2",
                count: chestCounts.silver,
                price: chestPrices.silver,
              },
            ]).map(({ type, label, tierLabel, rarity, dropLabel, accent, floatCls, count, price }) => {
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
                <div
                  key={type}
                  className={`select-none relative${justBought ? " chest-buy-bounce" : ""}`}
                  style={{
                    background: "var(--paper-2)",
                    border: "2.5px solid var(--ink)",
                    borderRadius: 18,
                    boxShadow: "4px 4px 0 var(--ink)",
                    padding: 20,
                    transform: `rotate(${([-1.2, 0.6, -0.4] as const)[type]}deg)`,
                  }}
                >
                  {/* top row: rarity chip + count badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: accent, color: "var(--ink)",
                      border: "2.5px solid var(--ink)", borderRadius: 999,
                      padding: "4px 10px", fontSize: 10, letterSpacing: 1.6,
                      fontWeight: 800, boxShadow: "2px 2px 0 var(--ink)",
                    }}>
                      {tierLabel}
                    </div>
                    {has && (
                      <div style={{
                        background: accent, color: "var(--ink)",
                        border: "2.5px solid var(--ink)", borderRadius: 999,
                        padding: "2px 8px", fontSize: 11, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--ink)",
                        fontFamily: "ui-monospace, monospace",
                      }}>
                        ×{count}
                      </div>
                    )}
                  </div>

                  {/* icon plate */}
                  <div
                    className={floatCls}
                    style={{
                      marginTop: 18, width: 80, height: 80, borderRadius: 18,
                      background: accent, border: "2.5px solid var(--ink)",
                      display: "grid", placeItems: "center",
                      boxShadow: "2px 2px 0 var(--ink)",
                    }}
                  >
                    <img src={chestImg} alt={label} loading="lazy"
                      style={{ width: 52, height: 52, objectFit: "contain" }} />
                  </div>

                  {/* name + price */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>
                      {label}
                    </div>
                    <div style={{
                      color: "var(--ink-3)", fontSize: 12, marginTop: 6,
                      fontFamily: 'ui-monospace,"JetBrains Mono",monospace', fontWeight: 600,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink-2)", fontFamily: "inherit" }}>
                        {(price / 1e18).toFixed(4)}
                      </span>
                      {" ETH · "}{dropLabel}
                    </div>
                  </div>

                  {/* buy button */}
                  <button
                    onClick={() => {
                      const d = descMap[type];
                      setChestBuyQty(1);
                      setChestBuyModal({ type, label, emoji: d.emoji, rarity, desc: lang === "ru" ? d.ru : d.en, price, buyBg: "" });
                    }}
                    disabled={!hasWalletAccount || busy !== null}
                    className="btn-sticker-primary"
                    style={{ width: "100%", marginTop: 18, padding: "12px 20px", justifyContent: "center", background: accent }}
                  >
                    {isBuying ? "…" : (lang === "ru" ? "Купить" : "Buy")}
                  </button>

                  {/* open button */}
                  <button
                    onClick={() => {
                      if (!busy && has) {
                        setChestOpenQty(1);
                        setChestOpenModal({ type, label, emoji: descMap[type].emoji, tier: type, available: count, grad: "", ring: "", buyBg: "" });
                      }
                    }}
                    disabled={!has || busy !== null}
                    className="btn-sticker-outline"
                    style={{ width: "100%", marginTop: 8, padding: "10px 20px", justifyContent: "center", borderColor: accent, color: accent, boxShadow: `2px 2px 0 var(--ink)` }}
                  >
                    {isOpening ? "…" : has ? (lang === "ru" ? `Открыть ×${count}` : `Open ×${count}`) : (lang === "ru" ? "Нет сундуков" : "None owned")}
                  </button>

                  {justBought && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center"
                      style={{ background: "rgba(251,247,236,0.85)", borderRadius: 16 }}>
                      <span className="chest-float-up text-3xl font-black" style={{ color: "#0F1115" }}>?</span>
                    </div>
                  )}
                </div>
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
                {(userClaimable / 1e18).toFixed(4)} ETH
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
                      style={{
                        padding: "8px 14px", whiteSpace: "nowrap",
                        background: active ? "var(--mint)" : "var(--paper-3)",
                        color: "var(--ink)", border: "2.5px solid var(--ink)", borderRadius: 999,
                        fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                        boxShadow: active ? "4px 4px 0 var(--ink)" : "2px 2px 0 var(--ink)",
                        transition: "background .12s",
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sky-soft)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--mint)" : "var(--paper-3)"; }}>
                      {team ?? (lang === "ru" ? "Все" : "All")}
                    </button>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {([
                  { value: "progress" as const, labelRu: "ПРОГРЕСС", labelEn: "PROGRESS" },
                  { value: "rarity" as const,   labelRu: "РЕДКОСТЬ", labelEn: "RARITY" },
                ]).map(({ value, labelRu, labelEn }) => {
                  const active = sortBy === value;
                  return (
                    <button key={value} type="button" onClick={() => setSortBy(value)}
                      style={{
                        padding: "8px 14px", whiteSpace: "nowrap",
                        background: active ? "var(--mint)" : "var(--paper-3)",
                        color: "var(--ink)", border: "2.5px solid var(--ink)", borderRadius: 999,
                        fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                        boxShadow: active ? "4px 4px 0 var(--ink)" : "2px 2px 0 var(--ink)",
                        transition: "background .12s",
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sky-soft)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--mint)" : "var(--paper-3)"; }}
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
                { id: 0,    label: lang === "ru" ? "Маленькое" : "Small" },
                { id: 1,    label: lang === "ru" ? "Среднее" : "Medium" },
                { id: 2,    label: lang === "ru" ? "Большое" : "Heavy" },
                { id: 3,    label: lang === "ru" ? "Тяжёлое" : "Super Heavy" },
              ] as { id: number | null; label: string }[]).map(({ id, label }) => {
                const active = filterTier === id;
                return (
                  <button key={id ?? "all"} onClick={() => setFilterTier(id)}
                    style={{
                      padding: "8px 14px", whiteSpace: "nowrap",
                      background: active ? "var(--mint)" : "var(--paper-3)",
                      color: "var(--ink)", border: "2.5px solid var(--ink)", borderRadius: 999,
                      fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                      boxShadow: active ? "4px 4px 0 var(--ink)" : "2px 2px 0 var(--ink)",
                      transition: "background .12s",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sky-soft)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--mint)" : "var(--paper-3)"; }}>
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
              const chestFill = (["#D9D3C2","#7AC7E8","#26C6A8"] as const)[type] ?? "#D9D3C2";
              const tierLabel = type === 0 ? (lang === "ru" ? "Маленькое" : "Small") : type === 1 ? (lang === "ru" ? "Среднее" : "Medium") : (lang === "ru" ? "Большое" : "Heavy");
              return (
                <article key={`chest_${type}`} className="anim-card-entry select-none">
                  <div style={{
                    background: "var(--paper-2)", border: "2.5px solid var(--ink)", borderRadius: 18,
                    boxShadow: "4px 4px 0 var(--ink)", padding: 16,
                    display: "flex", flexDirection: "column", gap: 12, position: "relative",
                  }}>
                    {/* top row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: chestFill, color: "var(--ink)",
                        border: "2.5px solid var(--ink)", borderRadius: 999,
                        padding: "3px 9px", fontSize: 9, letterSpacing: 1.6, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--ink)",
                      }}>{tierLabel}</div>
                      <div style={{
                        fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                        background: chestFill, color: "var(--ink)",
                        border: "2.5px solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
                        fontFamily: "ui-monospace, monospace",
                      }}>×{count}</div>
                    </div>
                    {/* image plate */}
                    <div style={{
                      height: 140, borderRadius: 14, background: chestFill,
                      border: "2.5px solid var(--ink)", display: "grid", placeItems: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      <div aria-hidden style={{
                        position: "absolute", inset: 0,
                        backgroundImage: "radial-gradient(var(--ink) 1.2px, transparent 1.4px)",
                        backgroundSize: "14px 14px", opacity: 0.12,
                      }} />
                      <img src={chestImg} alt={label} loading="lazy"
                        className={isOpening ? "animate-bounce" : "anim-float"}
                        style={{ width: 72, height: 72, objectFit: "contain", position: "relative" }} />
                    </div>
                    {/* name */}
                    <div>
                      <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 14, letterSpacing: -0.2 }}>{label}</div>
                      <div style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: 1.2, marginTop: 2, fontWeight: 700 }}>
                        {type === 0 ? (lang === "ru" ? "Маленькие карточки" : "Small cards") : type === 1 ? (lang === "ru" ? "Средние и выше" : "Medium+") : (lang === "ru" ? "Большие и выше" : "Heavy+")}
                      </div>
                    </div>
                    {/* buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        disabled={busy !== null}
                        onClick={() => { if (busy) return; setChestOpenQty(1); setChestOpenModal({ type, label, emoji, tier, available: count, grad, ring, buyBg }); }}
                        className="btn-sticker-outline"
                        style={{ width: "100%", padding: "10px 16px", justifyContent: "center", borderColor: chestFill, color: "var(--ink-2)" }}>
                        {isOpening ? "…" : (lang === "ru" ? "Открыть" : "Open")}
                      </button>
                      <button
                        onClick={() => {
                          const d = { 0: { emoji: "🐹", ru: "Гарантированная карточка Tier 1.", en: "Guaranteed Tier 1 card." }, 1: { emoji: "🐻", ru: "Гарантированная карточка Tier 2.", en: "Guaranteed Tier 2 card." }, 2: { emoji: "🐂", ru: "Гарантированная карточка Tier 3.", en: "Guaranteed Tier 3 card." } }[type]!;
                          setChestBuyQty(1);
                          setChestBuyModal({ type, label, emoji: d.emoji, rarity: tierLabel, desc: lang === "ru" ? d.ru : d.en, price: type === 0 ? chestPrices.wooden : type === 1 ? chestPrices.iron : chestPrices.silver, buyBg });
                        }}
                        disabled={!hasWalletAccount || busy !== null}
                        className="btn-sticker-primary"
                        style={{ width: "100%", padding: "10px 16px", justifyContent: "center", background: chestFill }}>
                        {lang === "ru" ? "Купить ещё" : "Buy more"}
                      </button>
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
              const eggW = (["50%","65%","79%","94%"] as const)[tier] ?? "72%";
              const eggH = (["57%","74%","90%","107%"] as const)[tier] ?? "82%";
              const isLegendary = tier === 3;
              const primerFill = (["#D9D3C2","#7AC7E8","#26C6A8","#88FC00"] as const)[tier] ?? "#D9D3C2";
              return (
                <article key={`${playerId}_${tier}`} className="anim-card-entry" style={{ animationDelay: `${cardIdx * 40}ms` }}>
                  <div style={{
                    background: "var(--paper-2)", border: "2.5px solid var(--ink)", borderRadius: 18,
                    boxShadow: isLegendary ? "4px 4px 0 var(--ink), 8px 8px 0 #88FC00" : "4px 4px 0 var(--ink)",
                    padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative",
                  }}>
                    {/* top row: rarity chip + badges */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: primerFill, color: "var(--ink)",
                        border: "2.5px solid var(--ink)", borderRadius: 999,
                        padding: "3px 9px", fontSize: 9, letterSpacing: 1.6, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--ink)",
                      }}>
                        {lang === "ru" ? ts.label : ts.enLabel}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {isNew && (
                          <div style={{
                            fontSize: 9, letterSpacing: 1.5, fontWeight: 800, padding: "3px 8px",
                            borderRadius: 999, background: "var(--lime-pop)", color: "var(--ink)",
                            border: "2.5px solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
                          }}>NEW</div>
                        )}
                        <div style={{
                          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                          background: primerFill, color: "var(--ink)",
                          border: "2.5px solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
                          fontFamily: "ui-monospace, monospace",
                        }}>×{count}</div>
                      </div>
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
                      <div className="anim-float" style={{ position: "relative", width: eggW, height: eggH, animationDelay: `${(cardIdx % 3) * -2}s` }}>
                        <img src="/egg.png" alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        {coinIcon && (
                          <img src={coinIcon} alt="" aria-hidden style={{
                            position: "absolute", width: "35%", height: "35%", objectFit: "contain",
                            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                            mixBlendMode: "multiply", opacity: 0.9,
                          }} />
                        )}
                      </div>
                      {isAllLocked && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(251,247,236,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 22 }}>🔒</span>
                          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.5, color: "var(--ink-3)", marginTop: 4 }}>{lang === "ru" ? "В ИГРЕ" : "IN PLAY"}</span>
                        </div>
                      )}
                      {isPartialLocked && (
                        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", alignItems: "center", gap: 3, background: "rgba(226,92,92,0.15)", borderRadius: 6, padding: "2px 6px" }}>
                          <span style={{ fontSize: 9 }}>🔒</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#E25C5C" }}>{lockedCount}</span>
                        </div>
                      )}
                    </div>

                    {/* name + role */}
                    <div>
                      <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 15, letterSpacing: -0.2 }}>{HEROES[playerId]}</div>
                      <div style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: 1.6, marginTop: 2, fontWeight: 700 }}>{PLAYER_ROLES[playerId]}</div>
                    </div>

                    {/* progress segments */}
                    {tier < 3 ? (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-3)", fontSize: 10, letterSpacing: 1.2, marginBottom: 6, fontWeight: 700 }}>
                          <span>{availableCount >= 5 ? (lang === "ru" ? "ГОТОВ К СЛИЯНИЮ" : "READY") : (lang === "ru" ? "ДО СЛИЯНИЯ" : "TO MERGE")}</span>
                          <span>{Math.min(availableCount, 5)}/5</span>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} style={{
                              flex: 1, height: 10, borderRadius: 4,
                              background: i < Math.min(availableCount, 5) ? primerFill : "var(--sunken)",
                              border: "2px solid var(--ink)",
                            }} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: 10 }} />
                    )}

                    {/* action buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {canMerge ? (
                        <button onClick={() => onMerge(playerId, tier, mergeCardAddrs)} disabled={busy !== null}
                          className="btn-sticker-primary"
                          style={{ width: "100%", padding: "10px 16px", justifyContent: "center", background: primerFill }}>
                          {busy === mergeKey ? "…" : (lang === "ru" ? "Слить ×5" : "Merge ×5")}
                        </button>
                      ) : canQuickBuy ? (
                        <button onClick={() => setQuickBuyMergeModal({ playerId, tier, ownedCount: availableCount, neededCount })}
                          disabled={busy !== null}
                          className="btn-sticker-outline"
                          style={{ width: "100%", padding: "10px 16px", justifyContent: "center", borderColor: primerFill }}>
                          {lang === "ru" ? "Докупить" : "Quick buy"}
                        </button>
                      ) : null}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setSellModal({ playerId, tier }); setSellPrice("0.1"); }}
                          disabled={busy !== null || availableCount === 0}
                          className="btn-sticker-outline"
                          style={{ flex: 1, padding: "8px 10px", justifyContent: "center", fontSize: "0.75rem" }}>
                          {isAllLocked ? "🔒" : (lang === "ru" ? "Продать" : "Sell")}
                        </button>
                        <button onClick={() => { setTransferModal({ playerId, tier, cardAddr: unlockedCardAddr }); setTransferRecipient(""); }}
                          disabled={busy !== null || !unlockedCardAddr}
                          className="btn-sticker-outline"
                          style={{ flex: 1, padding: "8px 10px", justifyContent: "center", fontSize: "0.75rem" }}>
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
