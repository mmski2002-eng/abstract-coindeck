"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HEROES, COIN_TICKERS, COIN_ICONS, PLAYER_TEAMS,
  TIER_NAMES, TIER_MULTS, PLAYER_ROLE_IDS, CARD_TIER_STYLES,
} from "../constants";
import type { TournamentStateData } from "../types";

type CardData = { playerId: number; tier: number; cardAddr: string };
type LineupSlot = { playerId: number; tier: number };
type LineupEntry = { day: number; league: number; slots?: LineupSlot[] };
type OracleDay = { scores: number[]; finalized: boolean };
type ClaimState = { active: boolean; startTs: number; deadline: number; vaultBalance: number; claimDays: number } | null;
type CoinMarketData = { pid: number; priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype: boolean };

const SLOT_ROLES = ["Layer 1", "Layer 2", "DeFi", "Exchange", "Meme/Infra"];

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

function fmtPrice(v: number): string {
  if (v >= 1000) return `$${v.toFixed(0)}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(3)}`;
}

type Props = {
  lang: string;
  tnError: string;
  tnState: TournamentStateData;
  epochRange: [number, number];
  epochPageStart: number;
  setEpochPageStart: React.Dispatch<React.SetStateAction<number>>;
  viewEpoch: number | null;
  setViewEpoch: (v: number | null) => void;
  dayCountdown: string;
  tnLineups: LineupEntry[];
  oracleDayCache: Map<number, OracleDay>;
  tnSelectedCards: (string | null)[];
  setTnSelectedCards: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  lineupPickerSlot: number | null;
  setLineupPickerSlot: (v: number | null) => void;
  lineupPickerTier: number | null;
  setLineupPickerTier: (v: number | null) => void;
  lineupPickerSearch: string;
  setLineupPickerSearch: (v: string) => void;
  setLineupConfirmOpen: (v: boolean) => void;
  expandedPortfolios: Set<number>;
  setExpandedPortfolios: React.Dispatch<React.SetStateAction<Set<number>>>;
  roleBonusPct: number;
  claimState: ClaimState;
  userClaimable: number;
  resultsMode: "day" | "epoch";
  setResultsMode: (v: "day" | "epoch") => void;
  resultsDay: number;
  setResultsDay: (v: number) => void;
  resultsEpoch: number;
  setResultsEpoch: (v: number) => void;
  tnRefreshing: boolean;
  resultsDaysLoading: boolean;
  flCards: CardData[];
  busy: string | null;
  hasWalletAccount: boolean;
  heroScore: (playerId: number, tier: number, slotIdx: number, dayScores: number[]) => number;
  fetchOracleDays: (days: number[]) => void;
  onClaim: () => void;
  lockedCardAddrs: string[];
  cancelFee: number;
  onCancelLineup: () => void;
  fetchMarketSnapshot: (epoch: number, day: number) => void;
  marketSnapshotCache: Map<string, CoinMarketData[]>;
  fetchLineupStats: (epoch: number, day: number) => void;
  lineupStatsCache: Map<string, number[]>;
};

export function TournamentTab({
  lang, tnError, tnState, epochRange, epochPageStart, setEpochPageStart,
  viewEpoch, setViewEpoch, dayCountdown, tnLineups, oracleDayCache,
  tnSelectedCards, setTnSelectedCards, lineupPickerSlot, setLineupPickerSlot,
  lineupPickerTier, setLineupPickerTier, lineupPickerSearch, setLineupPickerSearch,
  setLineupConfirmOpen, expandedPortfolios, setExpandedPortfolios, roleBonusPct,
  claimState, userClaimable, resultsMode, setResultsMode, resultsDay, setResultsDay,
  resultsEpoch, setResultsEpoch, tnRefreshing, resultsDaysLoading, flCards, busy,
  hasWalletAccount, heroScore, fetchOracleDays, onClaim,
  lockedCardAddrs, cancelFee, onCancelLineup,
  fetchMarketSnapshot, marketSnapshotCache,
  fetchLineupStats, lineupStatsCache,
}: Props) {
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [coinListOpen, setCoinListOpen] = useState(true);
  const [coinCategoryFilter, setCoinCategoryFilter] = useState<number | "all">("all");
  const [coinCatOpen, setCoinCatOpen] = useState(false);
  const coinCatRef = useRef<HTMLDivElement>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    function handleCoinCatClick(e: MouseEvent) {
      if (coinCatRef.current && !coinCatRef.current.contains(e.target as Node)) setCoinCatOpen(false);
    }
    document.addEventListener("mousedown", handleCoinCatClick);
    return () => document.removeEventListener("mousedown", handleCoinCatClick);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const epoch = tnState?.epoch;
    if (!epoch || resultsDay < 1) return;
    fetchMarketSnapshot(epoch, resultsDay);
    fetchLineupStats(epoch, resultsDay);
  }, [resultsDay, tnState?.epoch]); // eslint-disable-line

  if (tnRefreshing && !tnState) {
    return (
      <div className="mt-2 flex flex-col items-center justify-center py-16 gap-4">
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid var(--mint-soft)",
          borderTop: "3px solid var(--mint)",
          animation: "spin 0.9s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {tnError && <div className="rounded-xl p-3 text-sm font-semibold" style={{ border: "2px solid var(--down)", background: "var(--paper-2)", color: "var(--down)", boxShadow: "2px 2px 0 var(--down)" }}>{tnError}</div>}

      {!tnState && !tnRefreshing && (
        <div className="rounded-xl p-4 text-center text-sm font-semibold" style={{ border: "2px solid var(--outline)", background: "var(--warn)", color: "var(--ink)", boxShadow: "3px 3px 0 var(--outline)" }}>
          {lang === "ru" ? "Инвестирование ещё не запущено администратором" : "Investing not started yet"}
        </div>
      )}

      {/* Timer + total */}
      {(() => {
        const timerLabel = (() => {
          if (!tnState) return lang === "ru" ? "Турнир не активен" : "Tournament inactive";
          if (!tnState.active) return tnState.startTimestamp * 1000 > nowMs
            ? (lang === "ru" ? "До старта турнира" : "Until tournament start")
            : (lang === "ru" ? "Турнир завершён" : "Tournament ended");
          if (tnState.currentDay === 0) return lang === "ru" ? "До начала турнира" : "Until tournament start";
          if (tnState.currentDay > tnState.totalDays) return lang === "ru" ? "Все дни завершены" : "All days complete";
          return lang === "ru" ? "До смены торгового дня" : "Until next trading day";
        })();

        const timerSubLabel = tnState?.active && tnState.currentDay > 0 && tnState.currentDay <= tnState.totalDays
          ? (lang === "ru" ? `День ${tnState.currentDay} из ${tnState.totalDays}` : `Day ${tnState.currentDay} of ${tnState.totalDays}`)
          : (tnState?.active && tnState.currentDay === 0 ? (lang === "ru" ? "Рассчитываются результаты" : "Calculating results") : null);

        const weeklyTotal = tnLineups.reduce((sum, l) => {
          const cached = oracleDayCache.get(l.day);
          if (!cached) return sum;
          const dayScores = cached.scores ?? new Array(50).fill(0) as number[];
          return sum + (l.slots ? l.slots.reduce((ds, slot, si) => ds + heroScore(slot.playerId, slot.tier, si, dayScores), 0) : 0);
        }, 0);

        return (
          <div className="flex items-end justify-end gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-[10px] shrink-0">
              <div className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ width: 210, border: "2.5px solid var(--outline)", background: "var(--paper-2)", boxShadow: "4px 4px 0 var(--card-shadow)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--info)" }}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <div className="min-w-0">
                  {timerSubLabel && <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest leading-none" style={{ color: "var(--ink-3)" }}>{timerSubLabel}</div>}
                  <div className="font-mono text-lg font-black tracking-tight tabular-nums leading-none"
                    style={{ color: "var(--ink)" }}>
                    {dayCountdown || "00:00:00"}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] leading-none" style={{ color: "var(--ink-3)" }}>{timerLabel}</div>
                </div>
              </div>
              {tnLineups.length > 0 && (
                <div className="flex shrink-0 items-center self-stretch rounded-xl px-3" style={{ border: "2px solid var(--outline)", background: "var(--sky)", color: "var(--ink)", boxShadow: "3px 3px 0 var(--outline)" }}>
                  <div className="text-sm font-bold">
                    TOTAL {weeklyTotal} pts
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Lineup builder */}
      <style>{`
        @keyframes eligiblePulse {
          0%, 100% { box-shadow: 2px 2px 0 var(--outline), inset 0 0 0 0 var(--warn); }
          50% { box-shadow: 2px 2px 0 var(--outline), inset 0 0 0 4px var(--warn); }
        }
        .eligible-glow { animation: eligiblePulse 1.8s ease-in-out infinite; }
      `}</style>
      {tnState?.active && tnState.startTimestamp * 1000 > nowMs && hasWalletAccount && (
        <div className="rounded-xl p-4 text-center text-sm font-semibold" style={{ border: "2px solid var(--outline)", background: "var(--sky-soft)", color: "var(--ink)", boxShadow: "3px 3px 0 var(--outline)" }}>
          {lang === "ru" ? "Турнир стартует завтра — выставить портфель можно будет после старта" : "Tournament starts tomorrow — you can submit your portfolio once it begins"}
        </div>
      )}
      {tnState?.active && tnState.currentDay === 0 && !tnRefreshing && (viewEpoch === null || viewEpoch === tnState.epoch) && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ border: "2px solid var(--outline)", background: "var(--warn)", color: "var(--ink)", boxShadow: "3px 3px 0 var(--outline)" }}>
          <div className="text-xl mt-0.5">⏳</div>
          <div>
            <div className="text-sm font-semibold">
              {lang === "ru" ? "Предыдущий турнир завершён — рассчитываются результаты" : "Previous tournament ended — results are being calculated"}
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--ink-2)" }}>
              {lang === "ru" ? "Новый раунд начнётся автоматически. Выставить портфель можно будет с первого дня новой эпохи." : "A new round will start automatically. You can submit a portfolio from day 1 of the new epoch."}
            </div>
          </div>
        </div>
      )}
      {tnState?.active && tnState.currentDay !== 0 && !tnRefreshing && tnState.startTimestamp * 1000 <= nowMs && hasWalletAccount && (viewEpoch === null || viewEpoch === tnState.epoch) && (() => {
        const alreadySubmitted = tnLineups.some((l) => l.day === tnState.currentDay);
        if (alreadySubmitted) {
          const seenKeys = new Set<string>();
          const lockedCards = lockedCardAddrs
            .map(addr => flCards.find(c => c.cardAddr === addr))
            .filter((c): c is (typeof flCards)[number] => !!c && !seenKeys.has(c.cardAddr) && (seenKeys.add(c.cardAddr), true));
          const feeMove = cancelFee > 0 ? (cancelFee / 1e18).toFixed(4) : null;
          return (
            <div className="overflow-hidden rounded-2xl" style={{ border: "2.5px solid var(--outline)", background: "var(--paper-2)", boxShadow: "4px 4px 0 var(--card-shadow)" }}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "2px solid var(--outline)" }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm" style={{ border: "2px solid var(--outline)", background: "var(--sky)", color: "var(--ink)" }}>
                  🔒
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {lang === "ru" ? `День ${tnState.currentDay} · Портфель заблокирован` : `Day ${tnState.currentDay} · Portfolio locked`}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {lang === "ru" ? "Карточки защищены от продажи и передачи" : "Cards are protected from sale and transfer"}
                  </div>
                </div>
              </div>

              {/* Locked cards row */}
              {lockedCards.length > 0 && (
                <div className="px-5 py-4">
                  <div className="flex gap-2 justify-center">
                    {lockedCards.map((card) => {
                      const ts = CARD_TIER_STYLES[card.tier] ?? CARD_TIER_STYLES[0];
                      return (
                        <div key={card.cardAddr} className="relative flex flex-col items-center gap-1 w-[13%] min-w-0">
                          <div className="relative w-full aspect-square overflow-hidden rounded-xl" style={{ border: "2px solid var(--outline)", background: ts.color }}>
                            <img src={COIN_ICONS[card.playerId]} alt="" className="absolute inset-0 w-full h-full object-contain p-1 opacity-80" />
                            <div className="absolute inset-0 flex items-end justify-center pb-1">
                              <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: ts.color }}>{TIER_NAMES[card.tier]}</span>
                            </div>
                            {/* Lock badge */}
                            <div className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px]" style={{ border: "1px solid var(--outline)", background: "var(--paper-2)" }}>🔒</div>
                          </div>
                          <div className="w-full truncate text-center text-[8px] font-semibold leading-tight" style={{ color: "var(--ink-3)" }}>{HEROES[card.playerId]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cancel button */}
              <div className="px-5 pb-4">
                <div className="mb-3 rounded-xl p-3" style={{ border: "2px solid var(--down)", background: "var(--paper-2)" }}>
                  <div className="text-[11px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                    {lang === "ru"
                      ? "Отмена снимет лайнап и разблокирует карточки до конца дня."
                      : "Cancelling removes the lineup and unlocks cards until day end."}
                    {feeMove && (
                      <span className="ml-1 font-bold" style={{ color: "var(--down)" }}>
                        {lang === "ru" ? `Стоимость: ${feeMove} ETH` : `Fee: ${feeMove} ETH`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={busy !== null}
                  className="btn-sticker-destructive w-full py-2.5 text-sm">
                  {busy === "tn_cancel" ? "…" : (lang === "ru" ? "Отменить лайнап" : "Cancel lineup")}
                </button>
              </div>

              {/* Confirm modal */}
              {cancelConfirmOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0" style={{ background: "var(--overlay-backdrop)" }} onClick={() => setCancelConfirmOpen(false)} />
                  <div className="card-sticker relative z-10 w-full max-w-sm overflow-hidden">
                    <div className="p-6 space-y-4">
                      <div className="text-center">
                        <div className="text-2xl mb-2">⚠️</div>
                        <div className="mb-1 font-display text-base font-bold" style={{ color: "var(--ink)" }}>
                          {lang === "ru" ? "Отменить лайнап?" : "Cancel lineup?"}
                        </div>
                        <div className="text-sm" style={{ color: "var(--ink-2)" }}>
                          {lang === "ru"
                            ? "Очки за этот день не будут засчитаны. Действие необратимо."
                            : "Points for this day will not be counted. This cannot be undone."}
                        </div>
                        {feeMove && (
                          <div className="mt-2 rounded-xl px-3 py-2 text-sm font-bold" style={{ border: "2px solid var(--down)", background: "var(--paper-2)", color: "var(--down)" }}>
                            {lang === "ru" ? `Комиссия: ${feeMove} ETH` : `Fee: ${feeMove} ETH`}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setCancelConfirmOpen(false)}
                          className="btn-sticker-outline py-2.5 text-sm">
                          {lang === "ru" ? "Назад" : "Back"}
                        </button>
                        <button
                          onClick={() => { setCancelConfirmOpen(false); onCancelLineup(); }}
                          disabled={busy !== null}
                          className="btn-sticker-destructive py-2.5 text-sm">
                          {lang === "ru" ? "Подтвердить" : "Confirm"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          );
        }
        return (
          <div className="rounded-2xl p-4 space-y-4" style={{ border: "2.5px solid var(--outline)", background: "var(--my-lots-bg)", boxShadow: "4px 4px 0 var(--card-shadow)" }} data-tour="invest-portfolio">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {lang === "ru" ? `День ${tnState.currentDay} · Взвешивание` : `Day ${tnState.currentDay} · Weigh-in`}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>
                  {lang === "ru" ? "Выбери яйцо для каждой категории" : "Pick an egg for each category"}
                </div>
              </div>
              <div className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ border: "2px solid var(--outline)", background: "var(--warn)", color: "var(--ink)" }}>
                ⚡ +{roleBonusPct}% {lang === "ru" ? "за роль" : "role bonus"}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {SLOT_ROLES.map((role, slotIdx) => {
                const firstEmptySlot = tnSelectedCards.findIndex(addr => !addr);
                const addr = tnSelectedCards[slotIdx];
                const card = addr ? flCards.find((c) => c.cardAddr === addr) : null;
                const isRoleMatch = card ? PLAYER_ROLE_IDS[card.playerId] === slotIdx : false;
                const isOpen = lineupPickerSlot === slotIdx;
                const tierStyle = card ? CARD_TIER_STYLES[card.tier] : null;
                return (
                  <button key={role}
                    onClick={() => { setLineupPickerSlot(isOpen ? null : slotIdx); setLineupPickerSearch(""); }}
                    className={`relative flex flex-col items-center gap-1 rounded-xl p-2 text-center transition${slotIdx === firstEmptySlot && !card && lineupPickerSlot === null ? " slot-invite" : ""}`}
                    style={isOpen
                      ? { border: "2.5px solid var(--outline)", background: "var(--sky-soft)", boxShadow: "2px 2px 0 var(--outline)" }
                      : card
                        ? { border: "2.5px solid var(--outline)", background: "var(--paper-2)", boxShadow: "2px 2px 0 var(--outline)" }
                        : { border: "2.5px dashed var(--ink)", background: "var(--paper-2)" }
                    }
                  >
                    {card ? (
                      <>
                        <div className="text-[9px] font-semibold uppercase tracking-wider leading-tight" style={{ color: "var(--ink-3)" }}>{role}</div>
                        {/* Egg + coin overlay */}
                        <div className="relative w-full aspect-square flex items-center justify-center">
                          <img src="/egg.webp" alt="" className="w-full h-full object-contain" />
                          <img src={COIN_ICONS[card.playerId]} alt="" className="absolute" style={{ width: "42%", height: "42%", objectFit: "contain", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
                          {isRoleMatch && <div className="absolute top-0.5 right-0.5 text-[10px] leading-none">⚡</div>}
                        </div>
                        <div className="w-full truncate text-[10px] font-semibold leading-tight" style={{ color: "var(--ink-2)" }}>{HEROES[card.playerId]}</div>
                        <span className="rounded px-1 py-0.5 text-[9px] font-bold" style={{ border: "1.5px solid var(--outline)", background: tierStyle?.color ?? "var(--rarity-common)", color: "var(--ink)" }}>{TIER_NAMES[card.tier]}</span>
                      </>
                    ) : (
                      <div className="relative w-full aspect-square flex items-center justify-center">
                        <img src="/egg.webp" alt="" className="w-full h-full object-contain opacity-30" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-center px-1 leading-tight" style={{ color: "var(--ink-2)" }}>{role}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Card picker portal */}
            {lineupPickerSlot !== null && (() => {
              const si = lineupPickerSlot;
              const usedAddrs = new Set(tnSelectedCards.filter((_, i) => i !== si));
              const bestByPlayer = new Map<number, typeof flCards[0]>();
              for (const c of flCards) {
                if (usedAddrs.has(c.cardAddr)) continue;
                const ex = bestByPlayer.get(c.playerId);
                if (!ex || c.tier > ex.tier) bestByPlayer.set(c.playerId, c);
              }
              const allOptions = [...bestByPlayer.values()].sort((a, b) => {
                const aRole = PLAYER_ROLE_IDS[a.playerId] === si ? 0 : 1;
                const bRole = PLAYER_ROLE_IDS[b.playerId] === si ? 0 : 1;
                return aRole - bRole || b.tier - a.tier;
              });
              const options = allOptions.filter((c) => {
                if (lineupPickerTier !== null && c.tier !== lineupPickerTier) return false;
                if (lineupPickerSearch && !HEROES[c.playerId].toLowerCase().includes(lineupPickerSearch.toLowerCase())) return false;
                return true;
              });
              return createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0" style={{ background: "var(--overlay-backdrop)" }} onClick={() => { setLineupPickerSlot(null); setLineupPickerSearch(""); }} />
                  <div className="card-sticker relative z-10 w-full max-w-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "2px solid var(--outline)" }}>
                      <div>
                        <div className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: "var(--panel-text)" }}>
                          {lang === "ru" ? `Слот ${si + 1}` : `Slot ${si + 1}`}
                          <span className="ml-2" style={{ color: "var(--info)" }}>{SLOT_ROLES[si]}</span>
                        </div>
                        {tnSelectedCards[si] && (
                          <button onClick={() => { const n = [...tnSelectedCards]; n[si] = null; setTnSelectedCards(n); }}
                            className="mt-0.5 text-[10px] transition" style={{ color: "var(--down)" }}>
                            {lang === "ru" ? "✕ снять текущую" : "✕ clear current"}
                          </button>
                        )}
                      </div>
                      <button onClick={() => { setLineupPickerSlot(null); setLineupPickerSearch(""); }}
                        className="btn-sticker-ghost h-8 w-8 p-0 text-base">✕</button>
                    </div>
                    <div className="px-5 pt-4 pb-3 space-y-2.5">
                      <input type="text"
                        placeholder={lang === "ru" ? "Поиск по названию…" : "Search by name…"}
                        value={lineupPickerSearch}
                        onChange={(e) => setLineupPickerSearch(e.target.value)}
                        className="input-sticker w-full px-3 py-2 text-xs"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {([null, 0, 1, 2, 3] as (number | null)[]).map((t) => (
                          <button key={t ?? "all"} onClick={() => setLineupPickerTier(t)}
                            className="whitespace-nowrap rounded-full px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest transition-all"
                            style={{ border: "2px solid var(--outline)", background: lineupPickerTier === t ? "var(--mint)" : "var(--paper-2)", color: lineupPickerTier === t ? "var(--ink)" : "var(--ink-2)", boxShadow: lineupPickerTier === t ? "2px 2px 0 var(--outline)" : "none" }}>
                            {t === null ? (lang === "ru" ? "Все" : "All") : TIER_NAMES[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      {options.length === 0 ? (
                        <div className="py-10 text-center text-sm" style={{ color: "var(--ink-3)" }}>
                          {lang === "ru" ? "Нет доступных карточек" : "No cards available"}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-0.5">
                          {options.map((c) => {
                            const isRoleMatch = PLAYER_ROLE_IDS[c.playerId] === si;
                            const tierStyle = CARD_TIER_STYLES[c.tier] ?? CARD_TIER_STYLES[0];
                            return (
                              <button key={c.cardAddr}
                                onClick={() => {
                                  const n = [...tnSelectedCards]; n[si] = c.cardAddr; setTnSelectedCards(n);
                                  setLineupPickerSlot(null); setLineupPickerSearch("");
                                }}
                                className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-center transition hover:scale-105 active:scale-95${isRoleMatch ? " eligible-glow" : ""}`}
                                style={{ border: "2px solid var(--outline)", background: "var(--paper-2)", boxShadow: "2px 2px 0 var(--outline)" }}>
                                <div className="relative w-full aspect-square overflow-hidden rounded-lg" style={{ border: "1.5px solid var(--outline)", background: tierStyle.color }}>
                                  <img src={COIN_ICONS[c.playerId]} alt="" className="w-full h-full object-contain p-1 opacity-90" />
                                  {isRoleMatch && <div className="absolute top-0.5 right-0.5 text-[9px] leading-none">⚡</div>}
                                </div>
                                <div className="text-[9px] font-semibold truncate w-full leading-tight" style={{ color: "var(--panel-text)" }}>{HEROES[c.playerId]}</div>
                                <span className="rounded px-1 text-[8px] font-bold" style={{ border: "1.5px solid var(--outline)", background: tierStyle.color, color: "var(--ink)" }}>{TIER_NAMES[c.tier]}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              );
            })()}

            <button
              onClick={() => setLineupConfirmOpen(true)}
              disabled={busy !== null || tnSelectedCards.some((c) => c === null)}
              className={`disabled:opacity-40${busy === null && !tnSelectedCards.some(c => c === null) ? " btn-glow" : ""}`}
              style={{
                width: "100%", padding: "12px 20px", whiteSpace: "nowrap",
                background: "var(--header-btn-bg)", color: "var(--header-btn-color)",
                border: "2.5px solid var(--outline)", borderRadius: 999,
                fontSize: 13, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                boxShadow: "4px 4px 0 var(--card-shadow)", transition: "background .12s",
              }}>
              {lang === "ru" ? "Выставить портфель →" : "Submit portfolio →"}
            </button>
          </div>
        );
      })()}

      {/* My portfolios history */}
      {tnLineups.length > 0 && (
        <div className="rounded-2xl p-4" style={{ border: "2.5px solid var(--outline)", background: "var(--my-lots-bg)", boxShadow: "4px 4px 0 var(--card-shadow)" }}>
          <div className="text-xs font-semibold mb-3" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Мои портфели" : "My portfolios"}</div>
          <div className="space-y-3">
            {tnLineups.map((l) => {
              const leagueLabel = ["Bronze", "Silver", "Gold"][l.league] ?? "Bronze";
              const cached = oracleDayCache.get(l.day);
              const hasScores = cached?.finalized === true;
              const dayScores = hasScores ? cached!.scores : new Array(50).fill(0) as number[];
              const totalPts = l.slots ? l.slots.reduce((sum, slot, si) => sum + heroScore(slot.playerId, slot.tier, si, dayScores), 0) : 0;
              const isExpanded = expandedPortfolios.has(l.day);
              return (
                <div key={l.day} className="rounded-xl overflow-hidden" style={{ border: "2.5px solid var(--outline)", background: "var(--my-lots-bg)", boxShadow: "4px 4px 0 var(--card-shadow)" }}>
                  <button
                    onClick={() => {
                      const newSet = new Set(expandedPortfolios);
                      if (isExpanded) newSet.delete(l.day);
                      else newSet.add(l.day);
                      setExpandedPortfolios(newSet);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
                    style={{ background: isExpanded ? "var(--paper-3)" : "transparent" }}>
                    <span className="w-14 shrink-0 text-xs" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? `День ${l.day}` : `Day ${l.day}`}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ border: "1.5px solid var(--outline)", background: l.league === 2 ? "var(--warn)" : l.league === 1 ? "var(--sky)" : "var(--rarity-common)", color: "var(--ink)" }}>{leagueLabel}</span>
                    <span className="flex-1 text-sm font-black" style={{ color: "var(--ink)" }}>{hasScores ? <>{totalPts} <span className="text-xs font-normal" style={{ color: "var(--ink-3)" }}>pts</span></> : <span className="text-xs" style={{ color: "var(--ink-3)" }}>—</span>}</span>
                    <svg className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && l.slots && l.slots.length > 0 && (
                    <div style={{ borderTop: "2px solid var(--outline)" }}>
                      {l.slots.map((slot, si) => {
                        const pts = cached ? heroScore(slot.playerId, slot.tier, si, dayScores) : 0;
                        const tierStyle = CARD_TIER_STYLES[slot.tier] ?? CARD_TIER_STYLES[0];
                        const hasRoleBonus = PLAYER_ROLE_IDS[slot.playerId] === si;
                        return (
                          <div key={si}>
                            <div className="flex items-center gap-2 px-4 py-1.5" style={{ borderBottom: "1px solid var(--divider)" }}>
                              <img src={COIN_ICONS[slot.playerId]} alt="" className="h-6 w-10 shrink-0 rounded object-cover object-top opacity-80" style={{ border: "1.5px solid var(--outline)", background: tierStyle.color }} />
                              <span className="w-24 shrink-0 truncate text-xs" style={{ color: "var(--ink-2)" }}>{HEROES[slot.playerId]}</span>
                              <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold" style={{ border: "1.5px solid var(--outline)", background: tierStyle.color, color: "var(--ink)" }}>{TIER_NAMES[slot.tier]}</span>
                              <span className="shrink-0 text-[9px]" style={{ color: "var(--ink-3)" }}>{SLOT_ROLES[si]}</span>
                              {hasRoleBonus && <span className="shrink-0 text-[9px] font-semibold" style={{ color: "var(--up)" }}>+role</span>}
                              {hasScores && (
                                <div className="ml-2 flex shrink-0 flex-col items-start text-xs" style={{ color: "var(--ink-2)" }}>
                                  <div className="flex items-center gap-1">
                                    <span>{dayScores[slot.playerId] ?? 0} pts</span>
                                    <span>×</span>
                                    <span>{TIER_MULTS[slot.tier] ?? 100}%</span>
                                    <span style={{ color: "var(--ink-3)" }}>({lang === "ru" ? "редкость" : "rarity"})</span>
                                    {hasRoleBonus && (
                                      <>
                                        <span>×</span>
                                        <span>{((100 + roleBonusPct) / 100).toFixed(2)}</span>
                                        <span style={{ color: "var(--ink-3)" }}>({lang === "ru" ? "роль" : "role"})</span>
                                      </>
                                    )}
                                    <span>=</span>
                                    <span className="font-semibold">{pts} pts</span>
                                  </div>
                                </div>
                              )}
                              <span className="flex-1" />
                              <span className="shrink-0 text-xs font-bold" style={{ color: hasScores ? "var(--ink)" : "var(--ink-3)" }}>{hasScores ? pts : "—"} pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isExpanded && (!l.slots || l.slots.length === 0) && (
                    <div className="px-4 py-2 text-[10px]" style={{ borderTop: "2px solid var(--outline)", color: "var(--ink-3)" }}>
                      {lang === "ru" ? "Портфель не сохранён (сабмит до обновления)" : "Portfolio not cached (submitted before update)"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results section */}
      {(() => {
        const totalDays = tnState?.totalDays ?? 6;
        const activeDays: number[] = resultsDay <= totalDays ? [resultsDay] : [];

        const nowSec = Math.floor(nowMs / 1000);
        const baseTs = tnState?.startTimestamp ?? 0;
        const epochElapsedDays = baseTs > 0 ? Math.floor((nowSec - baseTs) / 86400) : 0;
        const epochWeeksPassed = Math.floor(epochElapsedDays / 7);
        const currentEpochStartTs = baseTs > 0 ? baseTs + epochWeeksPassed * 7 * 86400 : 0;
        // Day d of current epoch ends at currentEpochStartTs + d * 86400
        const isDayPast = (d: number) => currentEpochStartTs > 0 && nowSec >= currentEpochStartTs + d * 86400;

        const dayToDate = (d: number): Date => {
          if (currentEpochStartTs > 0) return new Date((currentEpochStartTs + (d - 1) * 86400) * 1000);
          const today = new Date();
          const offset = (tnState?.currentDay ?? 1) - d;
          const date = new Date(today);
          date.setDate(today.getDate() - offset);
          return date;
        };
        const fmtDay = (d: number) => dayToDate(d).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" });

        const isDayAvailable = (d: number) => isDayPast(d);

        const coinScores = Array(50).fill(0) as number[];
        for (const d of activeDays) {
          if (!isDayAvailable(d)) continue;
          const cached = oracleDayCache.get(d);
          if (cached?.finalized) cached.scores.forEach((s, i) => { coinScores[i] += s; });
        }
        const coinCategoryOptions = [
          { value: "all" as const, label: lang === "ru" ? "Все категории" : "All categories" },
          ...SLOT_ROLES.map((role, id) => ({ value: id, label: role })),
        ];
        const snapshotKey = `${tnState?.epoch ?? 0}-${resultsDay}`;
        const marketData = marketSnapshotCache.get(snapshotKey);
        const marketMap = new Map<number, CoinMarketData>(marketData?.map(d => [d.pid, d]) ?? []);
        const lineupStats = lineupStatsCache.get(snapshotKey);

        const coinRows = HEROES.map((name, i) => ({ pid: i, name, score: coinScores[i], market: marketMap.get(i) ?? null }))
          .sort((a, b) => b.score - a.score)
          .map((row, rank) => ({ ...row, rank }))
          .filter(({ pid }) => coinCategoryFilter === "all" || PLAYER_ROLE_IDS[pid] === coinCategoryFilter);

        const pastActiveDays = activeDays.filter(isDayAvailable);
        const allDaysLoaded = pastActiveDays.length > 0 && pastActiveDays.every(d => oracleDayCache.get(d)?.finalized);

        return (
          <div className="mt-2 space-y-4">
            <details className="rounded-xl" style={{ border: "2.5px solid var(--outline)", background: "var(--my-lots-bg)", boxShadow: "4px 4px 0 var(--card-shadow)" }}>
              <summary className="cursor-pointer select-none px-3 py-2 text-xs transition" style={{ color: "var(--ink-2)" }}>
                {lang === "ru" ? "ℹ️ Формула рассчета pts" : "ℹ️ How scoring works"}
              </summary>
              <div className="px-3 pb-3 pt-1 overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--outline)", color: "var(--ink-3)" }}>
                      <th className="text-left py-1 pr-3 font-semibold">{lang === "ru" ? "Категория" : "Category"}</th>
                      <th className="text-left py-1 pr-3 font-semibold">{lang === "ru" ? "Формула" : "Formula"}</th>
                      <th className="text-right py-1 font-semibold">Cap</th>
                    </tr>
                  </thead>
                  <tbody style={{ color: "var(--ink-2)" }}>
                    {([
                      { cat: lang === "ru" ? "Изменение цены" : "Price change",  formula: lang === "ru" ? "±10 pts за 1%" : "±10 pts per 1%",                                          cap: "±300" },
                      { cat: lang === "ru" ? "Объём торгов"   : "Trading volume", formula: lang === "ru" ? "Ступени $10M→$500M+" : "Steps $10M→$500M+",                                 cap: "+100" },
                      { cat: lang === "ru" ? "Волатильность"  : "Volatility",     formula: lang === "ru" ? "(high−low)/low×100, ступени 2%→20%" : "(high−low)/low×100, steps 2%→20%",  cap: "+100" },
                      { cat: lang === "ru" ? "Температура"    : "Temperature",    formula: lang === "ru" ? "+10 pts за 1% vol/mcap" : "+10 pts per 1% vol/mcap",                         cap: "+150" },
                      { cat: lang === "ru" ? "Выборов игроков" : "Player picks",   formula: lang === "ru" ? "+100 топ-15 монет по выборам игроков за предыдущий день (при равенстве — все)" : "+100 for top-15 coins by player picks previous day (ties included)", cap: "+100" },
                    ] as { cat: string; formula: string; cap: string }[]).map(({ cat, formula, cap }) => (
                      <tr key={cat}>
                        <td className="py-1.5 pr-3 font-medium" style={{ color: "var(--panel-text)" }}>{cat}</td>
                        <td className="py-1.5 pr-3" style={{ color: "var(--ink-2)" }}>{formula}</td>
                        <td className="py-1.5 text-right font-mono" style={{ color: "var(--up)" }}>{cap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {claimState?.active && userClaimable > 0 && (
              <div className="space-y-3 rounded-xl p-4" style={{ border: "2px solid var(--outline)", background: "var(--warn)", color: "var(--ink)", boxShadow: "3px 3px 0 var(--outline)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">🎉 {lang === "ru" ? "Ваш приз готов к получению" : "Your prize is ready to claim"}</div>
                    <div className="mt-0.5 text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
                      {(userClaimable / 1e18).toFixed(4)} ETH
                      {claimState.deadline > 0 && (
                        <> · {lang === "ru" ? "Дедлайн" : "Deadline"}: {new Date(claimState.deadline * 1000).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>
                      )}
                    </div>
                  </div>
                  <button onClick={onClaim} disabled={busy !== null}
                    className="btn-sticker-outline shrink-0 px-5 py-2.5 text-sm">
                    {busy === "claim" ? "…" : (lang === "ru" ? "Забрать" : "Claim")}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Выбери день" : "Select day"}</div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.max(totalDays, 1) }, (_, i) => i + 1).map(d => {
                    const past = isDayPast(d);
                    const isToday = tnState?.active && d === tnState.currentDay;
                    const finalized = past && oracleDayCache.get(d)?.finalized;
                    const date = dayToDate(d);
                    const dayNum = date.getDate();
                    const mon = date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "short" });
                    const btnClass = !past && !isToday ? "cursor-not-allowed" : "";
                    return (
                      <button key={d}
                        onClick={() => { setResultsDay(d); if (past) fetchOracleDays([d]); }}
                        disabled={!past && !isToday}
                        className={`w-12 h-12 rounded-lg text-xs font-bold transition relative flex flex-col items-center justify-center leading-none ${btnClass}`}
                        style={isToday
                          ? { border: "2px solid var(--outline)", background: "var(--sky)", color: "var(--ink)", boxShadow: "2px 2px 0 var(--outline)" }
                          : resultsDay === d
                            ? { border: "2px solid var(--outline)", background: "var(--mint)", color: "var(--ink)", boxShadow: "2px 2px 0 var(--outline)" }
                            : !past
                              ? { background: "var(--paper-2)", color: "var(--ink-3)", border: "2px dashed var(--ink)" }
                              : { background: "var(--paper-2)", color: "var(--ink-2)", border: "2px solid var(--outline)" }}>
                        <span className="text-sm font-black">{dayNum}</span>
                        <span className="text-[9px] font-normal opacity-70">{mon}</span>
                        {isToday && <span className="text-[7px] font-bold uppercase tracking-wider opacity-70 leading-none mt-0.5">{lang === "ru" ? "сегодня" : "today"}</span>}
                        {finalized && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full" style={{ background: "var(--up)" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: "2.5px solid var(--outline)", background: "var(--my-lots-bg)", boxShadow: "4px 4px 0 var(--card-shadow)" }} data-tour="invest-coins">
              <button
                type="button"
                onClick={() => setCoinListOpen(o => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition"
                style={{ borderBottom: "2px solid var(--outline)" }}>
                <div className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
                  {lang === "ru" ? "Монеты" : "Coins"}{` · ${fmtDay(resultsDay)}`}
                </div>
                <div className="flex items-center gap-2">
                  {(resultsDaysLoading || (!allDaysLoaded && activeDays.length > 0)) && (
                    <span className="text-xs" style={{ color: "var(--ink-3)" }}>⏳</span>
                  )}
                  <svg className={`w-4 h-4 transition-transform ${coinListOpen ? "rotate-180" : ""}`} style={{ color: "var(--ink-3)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div className="hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Фильтр" : "Filter"}</span>
                <select
                  value={coinCategoryFilter}
                  onChange={(e) => setCoinCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="input-sticker h-8 px-2 text-xs font-semibold"
                  style={{ border: "2.5px solid var(--outline)", background: "var(--my-lots-bg)", boxShadow: "4px 4px 0 var(--card-shadow)", color: "var(--panel-text)" }}>
                  {coinCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {coinListOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px]" style={{ borderBottom: "2px solid var(--outline)", color: "var(--ink-3)" }}>
                        <th className="px-3 py-2 text-left w-7">#</th>
                        <th className="px-2 py-2 text-left">{lang === "ru" ? "Монета" : "Coin"}</th>
                        <th className="px-2 py-2 text-center">
                          <div ref={coinCatRef} style={{ position: "relative", display: "inline-block" }}>
                            <button type="button" className="btn-sticker-outline flex items-center gap-1.5 px-3 py-1.5"
                              onClick={() => setCoinCatOpen(v => !v)}>
                              <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                                {coinCategoryOptions.find(o => o.value === coinCategoryFilter)?.label ?? (lang === "ru" ? "Все категории" : "All categories")}
                              </span>
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50" style={{ transform: coinCatOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>
                                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            {coinCatOpen && (
                              <div style={{ position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 50, background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 14, boxShadow: "4px 4px 0 var(--shadow-sticker-color)", minWidth: 150 }}>
                                {coinCategoryOptions.map(({ value, label }, i, arr) => (
                                  <button key={String(value)} type="button"
                                    onClick={() => { setCoinCategoryFilter(value); setCoinCatOpen(false); }}
                                    className="flex w-full items-center px-4 py-2.5 text-xs font-bold transition-colors"
                                    style={{
                                      color: coinCategoryFilter === value ? "var(--ink)" : "var(--ink-2)",
                                      background: coinCategoryFilter === value ? "var(--mint-soft)" : "transparent",
                                      borderBottom: i < arr.length - 1 ? "1.5px solid var(--divider)" : "none",
                                      borderRadius: i === 0 ? "11px 11px 0 0" : i === arr.length - 1 ? "0 0 11px 11px" : 0,
                                    }}
                                    onMouseEnter={e => { if (coinCategoryFilter !== value) e.currentTarget.style.background = "var(--filter-btn-hover-bg)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = coinCategoryFilter === value ? "var(--mint-soft)" : "transparent"; }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </th>
                        {marketData && (<>
                          <th className="px-2 py-2 text-right" style={{ color: "var(--up)" }}>{lang === "ru" ? "Цена%" : "Price%"}</th>
                          <th className="px-2 py-2 text-right" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Объём" : "Vol"}</th>
                          <th className="px-2 py-2 text-right" style={{ color: "var(--ink-3)" }}>High</th>
                          <th className="px-2 py-2 text-right" style={{ color: "var(--ink-3)" }}>Low</th>
                          <th className="px-2 py-2 text-right" style={{ color: "var(--info)" }}>{lang === "ru" ? "Темп%" : "Temp%"}</th>
                          <th className="px-2 py-2 text-center" style={{ color: "var(--mint-deep)" }}>ХАЙП</th>
                        </>)}
                        <th className="px-3 py-2 text-right font-semibold" style={{ color: "var(--info)" }}>{lang === "ru" ? "Очки" : "Score"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coinRows.map(({ pid, name, score, rank, market }) => (
                        <tr key={pid} style={{ borderBottom: "1px solid var(--divider)" }}>
                          <td className="px-3 py-1.5 tabular-nums" style={{ color: "var(--ink-3)" }}>
                            {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank + 1}`}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <img src={COIN_ICONS[pid]} alt={name} className="h-5 w-5 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                              <div>
                                <div className="font-semibold leading-none" style={{ color: "var(--panel-text)" }}>{name}</div>
                                <div className="text-[9px]" style={{ color: "var(--ink-3)" }}>{COIN_TICKERS[pid]}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center" style={{ color: "var(--ink-3)" }}>{PLAYER_TEAMS[pid]}</td>
                          {marketData && (<>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px]">
                              {market ? (
                                <span style={{ color: market.priceChg >= 0 ? "var(--up)" : "var(--down)" }}>
                                  {market.priceChg >= 0 ? "+" : ""}{market.priceChg.toFixed(2)}%
                                </span>
                              ) : <span style={{ color: "var(--ink-3)" }}>—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px]" style={{ color: "var(--ink-2)" }}>
                              {market ? fmtVol(market.vol24h) : <span style={{ color: "var(--ink-3)" }}>—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px]" style={{ color: "var(--ink-2)" }}>
                              {market ? fmtPrice(market.high24h) : <span style={{ color: "var(--ink-3)" }}>—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px]" style={{ color: "var(--ink-2)" }}>
                              {market ? fmtPrice(market.low24h) : <span style={{ color: "var(--ink-3)" }}>—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px]" style={{ color: "var(--info)" }}>
                              {market ? `${market.tempRatio.toFixed(1)}%` : <span style={{ color: "var(--ink-3)" }}>—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {market?.hype
                                ? <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: "var(--up)" }}>🔥{lineupStats?.[pid] ?? ""}</span>
                                : <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--ink-3)" }}>{lineupStats ? lineupStats[pid] || "—" : "—"}</span>}
                            </td>
                          </>)}
                          <td className="px-3 py-1.5 text-right font-black tabular-nums">
                            <span style={{ color: score > 0 ? "var(--up)" : score < 0 ? "var(--down)" : "var(--ink-3)" }}>{score}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
