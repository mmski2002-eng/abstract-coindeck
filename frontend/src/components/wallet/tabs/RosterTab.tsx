"use client";

import { useState, useRef, useEffect } from "react";
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
  const [tierOpen, setTierOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const tierRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tierRef.current && !tierRef.current.contains(e.target as Node)) setTierOpen(false);
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setTeamOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const TIER_OPTIONS = [
    { id: null,  label: lang === "ru" ? "Все редкости" : "All rarities" },
    { id: 0,     label: lang === "ru" ? "Маленькое" : "Small" },
    { id: 1,     label: lang === "ru" ? "Среднее" : "Medium" },
    { id: 2,     label: lang === "ru" ? "Тяжелое" : "Heavy" },
    { id: 3,     label: lang === "ru" ? "Супер Тяжелое" : "Super Heavy" },
  ] as { id: number | null; label: string }[];

  const TEAM_OPTIONS = [
    { id: null, label: lang === "ru" ? "Все типы" : "All types" },
    ...ALL_TEAMS.map(t => ({ id: t, label: t })),
  ];

  const tierLabel = TIER_OPTIONS.find(o => o.id === filterTier)?.label ?? (lang === "ru" ? "Все редкости" : "All rarities");
  const teamLabel = TEAM_OPTIONS.find(o => o.id === filterTeam)?.label ?? (lang === "ru" ? "Все типы" : "All types");

  return (
    <>
      {/* Stats bar */}
      {walletConnected && (
        <section className="relative mb-6" data-tour="roster-info">
          <div className="relative grid grid-cols-2 gap-3 rounded-3xl p-3 lg:grid-cols-4" style={{ border: "2.5px solid var(--outline)", background: "var(--info-block-shell)", boxShadow: "4px 4px 0 var(--info-shell-shadow)" }}>
            {([
              { label: lang === "ru" ? "НФТ" : "NFTs", value: String(flCards.length + chestCounts.wooden + chestCounts.iron + chestCounts.silver), unit: lang === "ru" ? "шт" : "pcs", delta: `${new Set(flCards.map((c) => c.playerId)).size} ${lang === "ru" ? "монет" : "coins"}`, rot: -4.5 },
              { label: lang === "ru" ? "Яиц" : "Eggs", value: String(chestCounts.wooden + chestCounts.iron + chestCounts.silver), unit: lang === "ru" ? "шт" : "pcs", delta: `🪵×${chestCounts.wooden} 🪨×${chestCounts.iron} 🪙×${chestCounts.silver}`, rot: 2.4 },
              { label: lang === "ru" ? "Готово к слиянию" : "Merge ready", value: String(mergeReadyCount), unit: lang === "ru" ? "стаков" : "stacks", delta: lang === "ru" ? "×5 → уровень выше" : "×5 → tier up", rot: -1.8 },
              { label: lang === "ru" ? "Тяжелое / Супер тяжелое" : "Heavy / Super Heavy", value: String(flCards.filter((c) => c.tier >= 2).length), unit: lang === "ru" ? "яиц" : "eggs", delta: lang === "ru" ? "Тяжелые яйца" : "Heavy eggs", rot: 3.6 },
            ] as const).map((s, i) => (
              <div key={i} style={{ transform: `rotate(${s.rot}deg)` }}>
                <div className="relative group overflow-hidden rounded-2xl p-5 anim-card-entry" style={{ animationDelay: `${i * 80}ms`, border: "2.5px solid var(--outline)", background: "var(--info-block-card)", boxShadow: "2px 2px 0 var(--card-shadow)" }}>
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
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main roster content */}
      <div className="space-y-4">
        {/* Chest shop — секция магазина, отдельный фон */}
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
          @keyframes coinPass {
            0%   { left: 5%;    transform: translateY(-50%) scale(0.25); opacity: 0; }
            12%  { opacity: 1; }
            50%  { left: 32.5%; transform: translateY(-50%) scale(1);    opacity: 1; }
            88%  { opacity: 1; }
            100% { left: 60%;   transform: translateY(-50%) scale(0.25); opacity: 0; }
          }
          .coin-pass {
            position: absolute;
            top: 50%;
            width: 35%;
            height: 35%;
            object-fit: contain;
            mix-blend-mode: multiply;
            animation: coinPass 4.5s ease-in-out infinite;
          }
        `}</style>
        {/* Секция Магазин сундуков — отдельная зона с paper-фоном */}
        <div
          data-tour="roster-chests"
          style={{
            background: "var(--paper)",
            border: "2.5px solid var(--outline)",
            borderRadius: 20,
            boxShadow: "4px 4px 0 var(--card-shadow)",
            padding: "20px 20px 24px",
          }}
        >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="block h-0.5 w-6 rounded-full" style={{ background: "var(--section-rule)" }} />
              <span className="font-mono text-[13px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--section-label)" }}>{lang === "ru" ? "Магазин сундуков" : "Chest Shop"}</span>
            </div>
            <div className="hidden items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest md:flex" style={{ color: "var(--section-label)" }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--up)" }} />
              Drop rate · Live
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-7">
            {([
              {
                type: 0 as const,
                label:     lang === "ru" ? "Маленькое яйцо" : "Small Egg",
                tierLabel: lang === "ru" ? "Маленькое" : "Small",
                rarity:    lang === "ru" ? "Маленькое" : "Small",
                dropLabel: lang === "ru" ? "Маленькие карточки" : "Small cards",
                accent:    "var(--rarity-common)",
                accentSoft:"var(--paper-2)",
                floatCls:  "anim-float",
                count: chestCounts.wooden,
                price: chestPrices.wooden,
              },
              {
                type: 1 as const,
                label:     lang === "ru" ? "Среднее яйцо" : "Medium Egg",
                tierLabel: lang === "ru" ? "Среднее" : "Medium",
                rarity:    lang === "ru" ? "Среднее" : "Medium",
                dropLabel: lang === "ru" ? "Средние карточки" : "Medium cards",
                accent:    "var(--rarity-rare)",
                accentSoft:"var(--sky-soft)",
                floatCls:  "anim-float-delay",
                count: chestCounts.iron,
                price: chestPrices.iron,
              },
              {
                type: 2 as const,
                label:     lang === "ru" ? "Тяжелое яйцо" : "Large Egg",
                tierLabel: lang === "ru" ? "Тяжелое" : "Heavy",
                rarity:    lang === "ru" ? "Тяжелое" : "Heavy",
                dropLabel: lang === "ru" ? "Большие карточки" : "Large cards",
                accent:    "var(--rarity-epic)",
                accentSoft:"var(--mint-soft)",
                floatCls:  "anim-float-delay-2",
                count: chestCounts.silver,
                price: chestPrices.silver,
              },
            ]).map(({ type, label, tierLabel, rarity, dropLabel, accent, floatCls, count, price }) => {
              const has = count > 0;
              const isBuying = busy === `fl_buy_${type}`;
              const isOpening = busy === `fl_open_${type}`;
              const justBought = chestBuySuccess === type;
              const descMap: Record<number, { ru: string; en: string; emoji: string }> = {
                0: { emoji: "🐹", ru: "Гарантированное маленькое яйцо. Хороший старт для новичков.", en: "Guaranteed small egg. A great start for newcomers." },
                1: { emoji: "🐻", ru: "Гарантированное среднее яйцо. Сильнее обычного — больше очков в турнире.", en: "Guaranteed medium egg. Stronger than common — more points in tournaments." },
                2: { emoji: "🐂", ru: "Гарантированное большое яйцо. Максимальная сила — для твоей корзины.", en: "Guaranteed large egg. Maximum power — for your basket." },
              };
              return (
                <div
                  key={type}
                  className={`select-none relative${justBought ? " chest-buy-bounce" : ""}`}
                  style={{
                    background: "var(--paper-2)",
                    border: "2.5px solid var(--outline)",
                    borderRadius: 18,
                    boxShadow: "4px 4px 0 var(--card-shadow)",
                    padding: 20,
                    transform: `rotate(${([-1.2, 0.6, -3] as const)[type]}deg)`,
                  }}
                >
                  {/* top row: rarity chip + count badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: accent, color: "var(--on-rarity)",
                      border: "2.5px solid var(--outline)", borderRadius: 999,
                      padding: "4px 10px", fontSize: 10, letterSpacing: 1.6,
                      fontWeight: 800, boxShadow: "2px 2px 0 var(--card-shadow)",
                    }}>
                      {tierLabel}
                    </div>
                    {has && (
                      <div style={{
                        background: accent, color: "var(--on-rarity)",
                        border: "2.5px solid var(--outline)", borderRadius: 999,
                        padding: "2px 8px", fontSize: 11, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--card-shadow)",
                        fontFamily: "Roobert, system-ui, sans-serif",
                      }}>
                        ×{count}
                      </div>
                    )}
                  </div>

                  {/* icon */}
                  <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <div className="egg-ripple"   style={{ color: accent, animationDelay: `${[-0, -4, -8][type]}s` }} />
                      <div className="egg-ripple-2" style={{ color: accent, animationDelay: `${[-0, -4, -8][type]}s` }} />
                      {type >= 0 && ([
                        { top: "-18px", left: "50%",    animationDelay: "0s",   animationDuration: "2.1s" },
                        { top: "10%",   left: "-20px",  animationDelay: "0.7s", animationDuration: "1.8s" },
                        { top: "10%",   right: "-20px", animationDelay: "1.3s", animationDuration: "2.4s" },
                        { bottom: "5%", left: "-18px",  animationDelay: "0.4s", animationDuration: "1.6s" },
                        { bottom: "5%", right: "-18px", animationDelay: "1.0s", animationDuration: "2.2s" },
                        { bottom: "-16px", left: "40%", animationDelay: "1.6s", animationDuration: "1.9s" },
                      ] as { top?: string; left?: string; right?: string; bottom?: string; animationDelay: string; animationDuration: string }[]).map((pos, i) => (
                        <span key={i} className="egg-star" style={{ ...pos, color: accent }}>✦</span>
                      ))}
                      <img src="/egg2.webp" alt={label} loading="lazy"
                        className={`egg-shake${type >= 0 ? " egg-glow" : ""}`}
                        style={{ width: ([80, 96, 120] as const)[type], height: ([80, 96, 120] as const)[type], objectFit: "contain", position: "relative", zIndex: 1, animationDelay: `${[-0, -4, -8][type]}s`, color: accent }} />
                    </div>
                  </div>

                  {/* price */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      color: "var(--ink-3)", fontSize: 12,
                      fontFamily: "Roobert, system-ui, sans-serif", fontWeight: 600,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink-2)", fontFamily: "inherit" }}>
                        {(price / 1e18).toFixed(4)}
                      </span>
                      <span style={{ color: "var(--ink-2)", fontWeight: 800 }}>{" ETH"}</span>
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
                    title={!hasWalletAccount ? (lang === "ru" ? "Подключи кошелёк" : "Connect wallet") : undefined}
                    className="btn-sticker-primary"
                    style={{ width: "100%", marginTop: 18, padding: "12px 20px", justifyContent: "center", background: accent, color: "var(--chest-buy-btn-text)" }}
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
                    className={`btn-sticker-outline${!has ? " btn-no-eggs" : ""}`}
                    style={{ width: "100%", marginTop: 8, padding: "10px 20px", justifyContent: "center", borderColor: accent, background: has ? accent : undefined, color: has ? "var(--chest-buy-btn-text)" : "var(--no-eggs-text)", boxShadow: `2px 2px 0 var(--card-shadow)` }}
                  >
                    {isOpening ? "…" : has ? (lang === "ru" ? `Почесать ×${count}` : `Scratch ×${count}`) : (lang === "ru" ? "Нет яиц" : "No eggs")}
                  </button>

                </div>
              );
            })}
          </div>
        </div>
        </div>{/* /Магазин сундуков wrapper */}

        {flError && (
          <div className="rounded-xl p-3 text-sm font-semibold" style={{ border: "2px solid var(--down)", background: "var(--paper-2)", color: "var(--down)", boxShadow: "2px 2px 0 var(--down)" }}>{flError}</div>
        )}

        {/* Claim banner */}
        {claimState?.active && userClaimable > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ border: "2px solid var(--outline)", background: "var(--warn)", color: "var(--on-rarity)", boxShadow: "3px 3px 0 var(--shadow-sticker-color-strong)" }}>
            <div>
              <div className="text-sm font-bold">🎉 {lang === "ru" ? "Доступен приз!" : "Prize available!"}</div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
                {(userClaimable / 1e18).toFixed(4)} ETH
                {claimState.deadline > 0 && (
                  <> · {lang === "ru" ? "до" : "until"} {new Date(claimState.deadline * 1000).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" })}</>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveTab("tournament")}
              className="btn-sticker-outline shrink-0 px-4 py-2 text-xs">
              {lang === "ru" ? "Забрать →" : "Claim →"}
            </button>
          </div>
        )}

        {/* Разделитель секций: инвентарь карточек */}
        {(flCards.length > 0 || chestCounts.wooden + chestCounts.iron + chestCounts.silver > 0) && (
          <div className="flex items-center gap-3 pt-2">
            <span className="block h-0.5 w-6 rounded-full" style={{ background: "var(--section-rule)" }} />
            <span className="font-mono text-[13px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--section-label)" }}>
              {lang === "ru" ? "Инвентарь карточек" : "Card Inventory"}
            </span>
            <span className="block h-px flex-1 rounded-full" style={{ background: "var(--section-rule)", opacity: 0.4 }} />
          </div>
        )}

        {/* Filter & sort bar */}
        {flCards.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
            {/* Tier filter */}
            <div ref={tierRef} style={{ position: "relative" }}>
              <button type="button" className="btn-sticker-outline flex items-center gap-1.5 px-3 py-2"
                onClick={() => { setTierOpen(v => !v); setTeamOpen(false); }}>
                <span className="text-xs font-bold uppercase tracking-widest">{tierLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50" style={{ transform: tierOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {tierOpen && (
                <div className="absolute left-0 top-full z-50 mt-2" style={{ background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 14, boxShadow: "4px 4px 0 var(--shadow-sticker-color)", minWidth: 160 }}>
                  {TIER_OPTIONS.map(({ id, label }, i, arr) => (
                    <button key={String(id)} type="button"
                      onClick={() => { setFilterTier(id); setTierOpen(false); }}
                      className="flex w-full items-center px-4 py-3 text-sm font-bold transition-colors"
                      style={{
                        color: filterTier === id ? "var(--ink)" : "var(--ink-2)",
                        background: filterTier === id ? "var(--mint-soft)" : "transparent",
                        borderBottom: i < arr.length - 1 ? "1.5px solid var(--divider)" : "none",
                        borderRadius: i === 0 ? "11px 11px 0 0" : i === arr.length - 1 ? "0 0 11px 11px" : 0,
                      }}
                      onMouseEnter={e => { if (filterTier !== id) e.currentTarget.style.background = "var(--filter-btn-hover-bg)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = filterTier === id ? "var(--mint-soft)" : "transparent"; }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Team filter */}
            <div ref={teamRef} style={{ position: "relative" }}>
              <button type="button" className="btn-sticker-outline flex items-center gap-1.5 px-3 py-2"
                onClick={() => { setTeamOpen(v => !v); setTierOpen(false); }}>
                <span className="text-xs font-bold uppercase tracking-widest">{teamLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50" style={{ transform: teamOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {teamOpen && (
                <div className="absolute left-0 top-full z-50 mt-2" style={{ background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 14, boxShadow: "4px 4px 0 var(--shadow-sticker-color)", minWidth: 160 }}>
                  {TEAM_OPTIONS.map(({ id, label }, i, arr) => (
                    <button key={String(id)} type="button"
                      onClick={() => { setFilterTeam(id); setTeamOpen(false); }}
                      className="flex w-full items-center px-4 py-3 text-sm font-bold transition-colors"
                      style={{
                        color: filterTeam === id ? "var(--ink)" : "var(--ink-2)",
                        background: filterTeam === id ? "var(--mint-soft)" : "transparent",
                        borderBottom: i < arr.length - 1 ? "1.5px solid var(--divider)" : "none",
                        borderRadius: i === 0 ? "11px 11px 0 0" : i === arr.length - 1 ? "0 0 11px 11px" : 0,
                      }}
                      onMouseEnter={e => { if (filterTeam !== id) e.currentTarget.style.background = "var(--filter-btn-hover-bg)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = filterTeam === id ? "var(--mint-soft)" : "transparent"; }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Sort — segmented switch */}
            <div style={{ marginLeft: "auto", flexShrink: 0, display: "inline-flex", border: "2.5px solid var(--outline)", borderRadius: 12, overflow: "hidden", boxShadow: "2px 2px 0 var(--card-shadow)" }}>
              {([
                { value: "rarity" as const,   labelRu: "РЕДКОСТЬ",  labelEn: "RARITY" },
                { value: "progress" as const, labelRu: "ПРОГРЕСС",  labelEn: "PROGRESS" },
              ]).map(({ value, labelRu, labelEn }, i) => {
                const active = sortBy === value;
                return (
                  <button key={value} type="button" onClick={() => setSortBy(value)}
                    style={{
                      padding: "7px 12px", fontSize: 10, letterSpacing: 1.4, fontWeight: 800,
                      textTransform: "uppercase" as const,
                      background: active ? "var(--ink)" : "transparent",
                      color: active ? "var(--paper)" : "var(--ink-2)",
                      borderRight: i === 0 ? "2px solid var(--outline)" : "none",
                      transition: "background 0.15s, color 0.15s",
                      cursor: "pointer",
                    }}
                    aria-pressed={active}>
                    {lang === "ru" ? labelRu : labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Card grid */}
        {flCards.length === 0 && chestCounts.wooden + chestCounts.iron + chestCounts.silver === 0 ? (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 items-stretch" data-tour="roster-cards">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                border: "2.5px solid var(--outline)", borderRadius: 18, background: "var(--paper-2)",
                boxShadow: "4px 4px 0 var(--card-shadow)", opacity: 0.45, padding: 16,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, minHeight: 180,
              }}>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <img src="/egg2.webp" alt="" aria-hidden style={{ width: 48, height: 48, objectFit: "contain", opacity: 0.55 }} />
                  <div style={{
                    position: "absolute", bottom: -6, right: -10,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--paper)", border: "2px solid var(--outline)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: "var(--ink-2)",
                  }}>?</div>
                </div>
                <div style={{ height: 7, width: 44, background: "var(--ink)", borderRadius: 4, opacity: 0.18 }} />
                <div style={{ height: 5, width: 30, background: "var(--ink)", borderRadius: 4, opacity: 0.12 }} />
              </div>
            ))}
            <div className="col-span-2 pt-2 text-center text-sm sm:col-span-3 md:col-span-4 lg:col-span-5" style={{ color: "var(--ink-3)" }}>
              {lang === "ru" ? "Почеши яйцо, чтобы получить первое нфт" : "Scratch an egg to get your first NFT"}
            </div>
          </div>
        ) : flGroups.length === 0 && (filterTeam !== null || filterTier !== null) ? (
          <div className="card-sticker p-8 text-center">
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-sm" style={{ color: "var(--ink-2)" }}>
              {lang === "ru" ? "Нет карточек по выбранному фильтру" : "No cards match the selected filter"}
            </div>
            <button onClick={() => { setFilterTeam(null); setFilterTier(null); }}
              className="btn-sticker-outline mt-4 px-4 py-2 text-xs">
              {lang === "ru" ? "Сбросить фильтры" : "Clear filters"}
            </button>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 items-stretch" data-tour="roster-cards">
            {/* Chest items in the grid */}
            {!filterTeam && ([
              { type: 0 as const, label: lang === "ru" ? "Маленькое яйцо" : "Small Egg", grad: "", ring: "", buyBg: "", count: chestCounts.wooden, tier: 0, emoji: "🐹" },
              { type: 1 as const, label: lang === "ru" ? "Среднее яйцо" : "Medium Egg", grad: "", ring: "", buyBg: "", count: chestCounts.iron, tier: 1, emoji: "🐻" },
              { type: 2 as const, label: lang === "ru" ? "Тяжелое яйцо" : "Large Egg", grad: "", ring: "", buyBg: "", count: chestCounts.silver, tier: 2, emoji: "🐂" },
            ]).filter(c => c.count > 0 && (filterTier === null || filterTier === c.tier)).map(({ type, label, grad, ring, buyBg, count, tier, emoji }) => {
              const isOpening = busy === `fl_open_${type}`;
              const chestFill = (["var(--rarity-common)","var(--rarity-rare)","var(--rarity-epic)"] as const)[type] ?? "var(--rarity-common)";
              const tierLabel = type === 0 ? (lang === "ru" ? "Маленькое" : "Small") : type === 1 ? (lang === "ru" ? "Среднее" : "Medium") : (lang === "ru" ? "Тяжелое" : "Heavy");
              return (
                <article key={`chest_${type}`} className="anim-card-entry select-none" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{
                    background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 18,
                    boxShadow: "4px 4px 0 var(--card-shadow)", padding: 16,
                    height: "100%", justifyContent: "flex-start",
                    display: "flex", flexDirection: "column", gap: 12, position: "relative",
                  }}>
                    {/* top row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: chestFill, color: "var(--on-rarity)",
                        border: "2.5px solid var(--outline)", borderRadius: 999,
                        padding: "3px 9px", fontSize: 9, letterSpacing: 1.6, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--card-shadow)",
                      }}>{tierLabel}</div>
                      <div style={{
                        fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                        background: chestFill, color: "var(--on-rarity)",
                        border: "2.5px solid var(--outline)", boxShadow: "2px 2px 0 var(--card-shadow)",
                        fontFamily: "Roobert, system-ui, sans-serif",
                      }}>×{count}</div>
                    </div>
                    {/* image plate */}
                    <div style={{
                      height: 140, borderRadius: 14, background: chestFill,
                      border: "2.5px solid var(--outline)", display: "grid", placeItems: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      <div aria-hidden style={{
                        position: "absolute", inset: 0,
                        background: "transparent", opacity: 0.12,
                      }} />
                      <img src="/egg2.webp" alt={label} loading="lazy"
                        className={isOpening ? "animate-bounce" : "anim-float"}
                        style={{ width: ([72, 88, 108] as const)[type], height: ([72, 88, 108] as const)[type], objectFit: "contain", position: "relative" }} />
                    </div>
                    {/* name */}
                    <div>
                      <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 14, letterSpacing: -0.2 }}>{label}</div>
                    </div>
                    {/* buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                      <button
                        disabled={busy !== null}
                        onClick={() => { if (busy) return; setChestOpenQty(1); setChestOpenModal({ type, label, emoji, tier, available: count, grad, ring, buyBg }); }}
                        className="btn-sticker-outline"
                        style={{ width: "100%", padding: "10px 16px", justifyContent: "center", borderColor: chestFill }}>
                        {isOpening ? "…" : (lang === "ru" ? "Почесать" : "Scratch")}
                      </button>
                      <button
                        onClick={() => {
                          const d = { 0: { emoji: "🐹", ru: "Гарантированное маленькое яйцо.", en: "Guaranteed small egg." }, 1: { emoji: "🐻", ru: "Гарантированное среднее яйцо.", en: "Guaranteed medium egg." }, 2: { emoji: "🐂", ru: "Гарантированное большое яйцо.", en: "Guaranteed large egg." } }[type]!;
                          setChestBuyQty(1);
                          setChestBuyModal({ type, label, emoji: d.emoji, rarity: tierLabel, desc: lang === "ru" ? d.ru : d.en, price: type === 0 ? chestPrices.wooden : type === 1 ? chestPrices.iron : chestPrices.silver, buyBg });
                        }}
                        disabled={!hasWalletAccount || busy !== null}
                        title={!hasWalletAccount ? (lang === "ru" ? "Подключи кошелёк" : "Connect wallet") : undefined}
                        className="btn-sticker-outline"
                        style={{ width: "100%", padding: "10px 16px", justifyContent: "center", borderColor: chestFill }}>
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

              const ts = CARD_TIER_STYLES[tier] ?? CARD_TIER_STYLES[0];
              const brand = COIN_BRAND_COLORS[playerId] ?? "var(--ink-3)";
              const ticker = COIN_TICKERS[playerId];
              const coinIcon = COIN_ICONS[playerId];
              const eggW = ([72, 88, 108, 120] as const)[tier] ?? 88;
              const eggH = eggW;
              const isLegendary = tier === 3;
              const primerFill = (["var(--rarity-common)","var(--rarity-rare)","var(--rarity-epic)","var(--rarity-legendary)"] as const)[tier] ?? "var(--rarity-common)";
              return (
                <article key={`${playerId}_${tier}`} className="anim-card-entry" style={{ animationDelay: `${cardIdx * 40}ms`, height: "100%", minHeight: 260, display: "flex", flexDirection: "column" }}>
                  <div style={{
                    background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 18,
                    boxShadow: isLegendary ? "4px 4px 0 var(--card-shadow), 8px 8px 0 var(--rarity-legendary)" : "4px 4px 0 var(--card-shadow)",
                    padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative", height: "100%", justifyContent: "flex-start",
                  }}>
                    {/* top row: rarity chip + badges */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: primerFill, color: "var(--on-rarity)",
                        border: "2.5px solid var(--outline)", borderRadius: 999,
                        padding: "3px 9px", fontSize: 10, letterSpacing: 1.4, fontWeight: 800,
                        boxShadow: "2px 2px 0 var(--card-shadow)",
                      }}>
                        {lang === "ru" ? ts.label : ts.enLabel}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                          background: primerFill, color: "var(--on-rarity)",
                          border: "2.5px solid var(--outline)", boxShadow: "2px 2px 0 var(--card-shadow)",
                          fontFamily: "Roobert, system-ui, sans-serif",
                        }}>×{count}</div>
                      </div>
                    </div>

                    {/* image plate */}
                    <div style={{
                      height: 140, borderRadius: 14, background: primerFill,
                      border: "2.5px solid var(--outline)", display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                    }}>
                      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <div className="egg-ripple"   style={{ color: primerFill, animationDelay: `${(cardIdx % 3) * -3}s` }} />
                        <div className="egg-ripple-2" style={{ color: primerFill, animationDelay: `${(cardIdx % 3) * -3}s` }} />
                        {([
                          { top: "-18px", left: "50%",    animationDelay: "0s",   animationDuration: "2.1s" },
                          { top: "10%",   left: "-20px",  animationDelay: "0.7s", animationDuration: "1.8s" },
                          { top: "10%",   right: "-20px", animationDelay: "1.3s", animationDuration: "2.4s" },
                          { bottom: "5%", left: "-18px",  animationDelay: "0.4s", animationDuration: "1.6s" },
                          { bottom: "5%", right: "-18px", animationDelay: "1.0s", animationDuration: "2.2s" },
                          { bottom: "-16px", left: "40%", animationDelay: "1.6s", animationDuration: "1.9s" },
                        ] as { top?: string; left?: string; right?: string; bottom?: string; animationDelay: string; animationDuration: string }[]).map((pos, i) => (
                          <span key={i} className="egg-star" style={{ ...pos, color: primerFill }}>✦</span>
                        ))}
                        <div className="egg-shake egg-glow" style={{ position: "relative", width: eggW, height: eggH, zIndex: 1, animationDelay: `${(cardIdx % 3) * -2}s`, color: primerFill }}>
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
                      {isAllLocked && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--down)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                          </div>
                          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.5, color: "var(--ink)" }}>{lang === "ru" ? "В ИГРЕ" : "IN PLAY"}</span>
                        </div>
                      )}
                      {isPartialLocked && (
                        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", alignItems: "center", gap: 3, background: "var(--down-soft)", border: "1px solid var(--outline)", borderRadius: 6, padding: "2px 6px" }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--down)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "var(--down)" }}>{lockedCount}</span>
                        </div>
                      )}
                    </div>

                    {/* name + role */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ color: "var(--ink-2)", fontWeight: 800, fontSize: 17, letterSpacing: -0.2 }}>{HEROES[playerId]}</div>
                      <div style={{ color: "var(--ink-2)", fontSize: 10, letterSpacing: 1.6, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>{PLAYER_ROLES[playerId]}</div>
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
                              background: i < Math.min(availableCount, 5) ? (tier === 0 ? "var(--progress-filled)" : primerFill) : "var(--ink-3)",
                              border: "2px solid var(--outline)",
                            }} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: 10 }} />
                    )}

                    {/* action buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                      {canMerge ? (
                        <button onClick={() => onMerge(playerId, tier, mergeCardAddrs)} disabled={busy !== null}
                          className="btn-sticker-primary"
                          style={{ width: "100%", padding: "10px 16px", justifyContent: "center", background: primerFill, color: "var(--on-rarity)" }}>
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
              className="btn-sticker-outline px-3 py-1.5 text-xs">
              ←
            </button>
            <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
              {rosterPage + 1} / {Math.ceil(flGroups.length / ROSTER_PAGE_SIZE)}
            </span>
            <button onClick={() => setRosterPage((p) => Math.min(Math.ceil(flGroups.length / ROSTER_PAGE_SIZE) - 1, p + 1))} disabled={rosterPage >= Math.ceil(flGroups.length / ROSTER_PAGE_SIZE) - 1}
              className="btn-sticker-outline px-3 py-1.5 text-xs">
              →
            </button>
          </div>
        )}

        {/* Brand logo */}
        <div className="flex justify-center pt-2 pb-1">
          <img src="/logo.svg" alt="HeavyEggs" className="h-10 w-auto opacity-80" />
        </div>
      </div>
    </>
  );
}
