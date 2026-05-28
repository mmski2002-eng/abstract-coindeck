"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  HEROES, COIN_TICKERS, COIN_ICONS, PLAYER_TEAMS,
  TIER_COLORS, TIER_NAMES, TIER_MULTS, PLAYER_ROLE_IDS, CARD_TIER_STYLES,
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
  const [nowMs, setNowMs] = useState(() => Date.now());

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
          border: "3px solid rgba(176,38,255,0.15)",
          borderTop: "3px solid #B026FF",
          animation: "spin 0.9s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {tnError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{tnError}</div>}

      {!tnState && !tnRefreshing && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
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
              <div className="rounded-xl border border-white/8 bg-black/40 backdrop-blur px-4 py-2.5 flex items-center gap-3" style={{ width: 210 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 shrink-0">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <div className="min-w-0">
                  {timerSubLabel && <div className="text-[9px] font-semibold uppercase tracking-widest text-white/30 leading-none mb-0.5">{timerSubLabel}</div>}
                  <div className="font-mono text-lg font-black tracking-tight tabular-nums leading-none"
                    style={{ background: "linear-gradient(90deg,#00F0FF,#B026FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 6px rgba(0,240,255,0.35))" }}>
                    {dayCountdown || "00:00:00"}
                  </div>
                  <div className="text-[9px] text-white/30 mt-0.5 leading-none truncate">{timerLabel}</div>
                </div>
              </div>
              {tnLineups.length > 0 && (
                <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 shrink-0 shadow-lg shadow-cyan-400/20 self-stretch flex items-center">
                  <div className="text-sm font-bold text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); border-color: rgba(255,255,255,0.25); }
          50% { box-shadow: 0 0 14px 3px rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.65); }
        }
        .eligible-glow { animation: eligiblePulse 1.8s ease-in-out infinite; }
      `}</style>
      {tnState?.active && tnState.startTimestamp * 1000 > nowMs && hasWalletAccount && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-center text-sm text-violet-200">
          {lang === "ru" ? "Турнир стартует завтра — выставить портфель можно будет после старта" : "Tournament starts tomorrow — you can submit your portfolio once it begins"}
        </div>
      )}
      {tnState?.active && tnState.currentDay === 0 && !tnRefreshing && (viewEpoch === null || viewEpoch === tnState.epoch) && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-950/30 p-4 flex items-start gap-3">
          <div className="text-xl mt-0.5">⏳</div>
          <div>
            <div className="text-sm font-semibold text-amber-200">
              {lang === "ru" ? "Предыдущий турнир завершён — рассчитываются результаты" : "Previous tournament ended — results are being calculated"}
            </div>
            <div className="text-xs text-amber-400/70 mt-1">
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
            <div className="rounded-2xl border border-white/10 bg-[#0a0c18]/80 backdrop-blur-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300 text-sm shrink-0">
                  🔒
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {lang === "ru" ? `День ${tnState.currentDay} · Портфель заблокирован` : `Day ${tnState.currentDay} · Portfolio locked`}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
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
                          <div className="relative w-full aspect-square rounded-xl overflow-hidden border" style={{ borderColor: ts.border }}>
                            <div className="absolute inset-0" style={{ background: ts.gradient, opacity: 0.4 }} />
                            <img src={COIN_ICONS[card.playerId]} alt="" className="absolute inset-0 w-full h-full object-contain p-1 opacity-80" />
                            <div className="absolute inset-0 flex items-end justify-center pb-1">
                              <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: ts.color }}>{TIER_NAMES[card.tier]}</span>
                            </div>
                            {/* Lock badge */}
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/70 flex items-center justify-center text-[8px]">🔒</div>
                          </div>
                          <div className="text-[8px] font-semibold text-zinc-400 truncate w-full text-center leading-tight">{HEROES[card.playerId]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cancel button */}
              <div className="px-5 pb-4">
                <div className="rounded-xl border border-red-500/10 bg-red-950/20 p-3 mb-3">
                  <div className="text-[11px] text-zinc-400 leading-relaxed">
                    {lang === "ru"
                      ? "Отмена снимет лайнап и разблокирует карточки до конца дня."
                      : "Cancelling removes the lineup and unlocks cards until day end."}
                    {feeMove && (
                      <span className="text-red-300 font-semibold ml-1">
                        {lang === "ru" ? `Стоимость: ${feeMove} ETH` : `Fee: ${feeMove} ETH`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={busy !== null}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 hover:text-red-300 transition disabled:opacity-40">
                  {busy === "tn_cancel" ? "…" : (lang === "ru" ? "Отменить лайнап" : "Cancel lineup")}
                </button>
              </div>

              {/* Confirm modal */}
              {cancelConfirmOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setCancelConfirmOpen(false)} />
                  <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl overflow-hidden" style={{ background: "rgba(8,10,22,0.98)" }}>
                    <div className="p-6 space-y-4">
                      <div className="text-center">
                        <div className="text-2xl mb-2">⚠️</div>
                        <div className="font-display font-bold text-base text-white mb-1">
                          {lang === "ru" ? "Отменить лайнап?" : "Cancel lineup?"}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {lang === "ru"
                            ? "Очки за этот день не будут засчитаны. Действие необратимо."
                            : "Points for this day will not be counted. This cannot be undone."}
                        </div>
                        {feeMove && (
                          <div className="mt-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm font-bold text-red-300">
                            {lang === "ru" ? `Комиссия: ${feeMove} ETH` : `Fee: ${feeMove} ETH`}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setCancelConfirmOpen(false)}
                          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-sm font-semibold text-zinc-300 transition">
                          {lang === "ru" ? "Назад" : "Back"}
                        </button>
                        <button
                          onClick={() => { setCancelConfirmOpen(false); onCancelLineup(); }}
                          disabled={busy !== null}
                          className="rounded-xl bg-red-600 hover:bg-red-500 py-2.5 text-sm font-bold text-white transition disabled:opacity-40">
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
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4" data-tour="invest-portfolio">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">
                  {lang === "ru" ? `День ${tnState.currentDay} · Портфель` : `Day ${tnState.currentDay} · Portfolio`}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {lang === "ru" ? "Выбери монету для каждой категории" : "Pick a coin for each category"}
                </div>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 shrink-0">
                ⚡ +{roleBonusPct}% {lang === "ru" ? "за роль" : "role bonus"}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {SLOT_ROLES.map((role, slotIdx) => {
                const addr = tnSelectedCards[slotIdx];
                const card = addr ? flCards.find((c) => c.cardAddr === addr) : null;
                const isRoleMatch = card ? PLAYER_ROLE_IDS[card.playerId] === slotIdx : false;
                const isOpen = lineupPickerSlot === slotIdx;
                const tc = card ? TIER_COLORS[card.tier] : null;
                return (
                  <button key={role}
                    onClick={() => { setLineupPickerSlot(isOpen ? null : slotIdx); setLineupPickerSearch(""); }}
                    className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
                      isOpen
                        ? "border-white/30 bg-white/10 ring-1 ring-white/20"
                        : card
                          ? `${tc!.border} bg-black/30 hover:bg-black/50`
                          : "border-dashed border-white/15 bg-white/3 hover:bg-white/8 hover:border-white/30"
                    }`}
                  >
                    {card ? (
                      <>
                        <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider leading-tight">{role}</div>
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                          <img src={COIN_ICONS[card.playerId]} alt="" className="w-full h-full object-contain p-1 opacity-90" />
                          {isRoleMatch && <div className="absolute top-0.5 right-0.5 text-[10px] leading-none">⚡</div>}
                        </div>
                        <div className="text-[10px] font-semibold text-white leading-tight truncate w-full">{HEROES[card.playerId]}</div>
                        <span className={`text-[9px] rounded px-1 py-0.5 font-bold ${tc!.badge}`}>{TIER_NAMES[card.tier]}</span>
                      </>
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-white/5 flex items-center justify-center relative">
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-zinc-400 uppercase tracking-wider text-center px-1 z-0 leading-tight">{role}</span>
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
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => { setLineupPickerSlot(null); setLineupPickerSearch(""); }} />
                  <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: "rgba(8,10,22,0.97)" }}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                      <div>
                        <div className="font-display font-bold text-sm uppercase tracking-widest text-white">
                          {lang === "ru" ? `Слот ${si + 1}` : `Slot ${si + 1}`}
                          <span className="ml-2 text-cyan-400">{SLOT_ROLES[si]}</span>
                        </div>
                        {tnSelectedCards[si] && (
                          <button onClick={() => { const n = [...tnSelectedCards]; n[si] = null; setTnSelectedCards(n); }}
                            className="mt-0.5 text-[10px] text-zinc-500 hover:text-red-400 transition">
                            {lang === "ru" ? "✕ снять текущую" : "✕ clear current"}
                          </button>
                        )}
                      </div>
                      <button onClick={() => { setLineupPickerSlot(null); setLineupPickerSearch(""); }}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white/60 hover:text-white transition text-base">✕</button>
                    </div>
                    <div className="px-5 pt-4 pb-3 space-y-2.5">
                      <input type="text"
                        placeholder={lang === "ru" ? "Поиск по названию…" : "Search by name…"}
                        value={lineupPickerSearch}
                        onChange={(e) => setLineupPickerSearch(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {([null, 0, 1, 2, 3] as (number | null)[]).map((t) => (
                          <button key={t ?? "all"} onClick={() => setLineupPickerTier(t)}
                            className={`whitespace-nowrap font-display font-bold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-md transition-all ${
                              lineupPickerTier === t
                                ? "text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/50"
                                : "text-gray-400 bg-white/[0.02] border border-white/10 hover:text-white hover:border-white/30"
                            }`}
                            style={lineupPickerTier === t ? { boxShadow: "inset 0 -2px 0 #00FF66, 0 0 12px rgba(0,255,102,0.22)" } : {}}>
                            {t === null ? (lang === "ru" ? "Все" : "All") : TIER_NAMES[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      {options.length === 0 ? (
                        <div className="py-10 text-center text-sm text-zinc-500">
                          {lang === "ru" ? "Нет доступных карточек" : "No cards available"}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-0.5">
                          {options.map((c) => {
                            const isRoleMatch = PLAYER_ROLE_IDS[c.playerId] === si;
                            const tc = TIER_COLORS[c.tier];
                            return (
                              <button key={c.cardAddr}
                                onClick={() => {
                                  const n = [...tnSelectedCards]; n[si] = c.cardAddr; setTnSelectedCards(n);
                                  setLineupPickerSlot(null); setLineupPickerSearch("");
                                }}
                                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 text-center transition hover:scale-105 active:scale-95 ${
                                  isRoleMatch ? "eligible-glow bg-white/5" : `${tc.border} bg-black/20`
                                }`}>
                                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/30">
                                  <img src={COIN_ICONS[c.playerId]} alt="" className="w-full h-full object-contain p-1 opacity-90" />
                                  {isRoleMatch && <div className="absolute top-0.5 right-0.5 text-[9px] leading-none">⚡</div>}
                                </div>
                                <div className="text-[9px] font-semibold text-white truncate w-full leading-tight">{HEROES[c.playerId]}</div>
                                <span className={`text-[8px] rounded px-1 font-bold ${tc.badge}`}>{TIER_NAMES[c.tier]}</span>
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
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50 transition">
              {lang === "ru" ? "Выставить портфель →" : "Submit portfolio →"}
            </button>
          </div>
        );
      })()}

      {/* My portfolios history */}
      {tnLineups.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-zinc-400 mb-3">{lang === "ru" ? "Мои портфели" : "My portfolios"}</div>
          <div className="space-y-3">
            {tnLineups.map((l) => {
              const leagueLabel = ["Bronze", "Silver", "Gold"][l.league] ?? "Bronze";
              const cached = oracleDayCache.get(l.day);
              const hasScores = cached?.finalized === true;
              const dayScores = hasScores ? cached!.scores : new Array(50).fill(0) as number[];
              const totalPts = l.slots ? l.slots.reduce((sum, slot, si) => sum + heroScore(slot.playerId, slot.tier, si, dayScores), 0) : 0;
              const isExpanded = expandedPortfolios.has(l.day);
              return (
                <div key={l.day} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                  <button
                    onClick={() => {
                      const newSet = new Set(expandedPortfolios);
                      if (isExpanded) newSet.delete(l.day);
                      else newSet.add(l.day);
                      setExpandedPortfolios(newSet);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left">
                    <span className="text-xs text-zinc-400 w-14 shrink-0">{lang === "ru" ? `День ${l.day}` : `Day ${l.day}`}</span>
                    <span className={`text-[10px] rounded px-1.5 py-0.5 font-semibold shrink-0 ${l.league === 2 ? "bg-amber-900/60 text-amber-300" : l.league === 1 ? "bg-blue-900/60 text-blue-300" : "bg-zinc-800 text-zinc-300"}`}>{leagueLabel}</span>
                    <span className="flex-1 text-sm font-black text-white">{hasScores ? <>{totalPts} <span className="text-xs font-normal text-zinc-400">pts</span></> : <span className="text-zinc-600 text-xs">—</span>}</span>
                    <svg className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && l.slots && l.slots.length > 0 && (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {l.slots.map((slot, si) => {
                        const pts = cached ? heroScore(slot.playerId, slot.tier, si, dayScores) : 0;
                        const tc = TIER_COLORS[slot.tier];
                        const hasRoleBonus = PLAYER_ROLE_IDS[slot.playerId] === si;
                        return (
                          <div key={si}>
                            <div className="flex items-center gap-2 px-4 py-1.5">
                              <img src={COIN_ICONS[slot.playerId]} alt="" className="h-6 w-10 rounded object-cover object-top shrink-0 opacity-80" />
                              <span className="text-xs text-white/80 w-24 shrink-0 truncate">{HEROES[slot.playerId]}</span>
                              <span className={`text-[9px] rounded px-1 py-0.5 font-semibold shrink-0 ${tc.badge}`}>{TIER_NAMES[slot.tier]}</span>
                              <span className="text-[9px] text-zinc-500 shrink-0">{SLOT_ROLES[si]}</span>
                              {hasRoleBonus && <span className="text-[9px] text-emerald-400 shrink-0">+role</span>}
                              {hasScores && (
                                <div className="text-xs text-white/80 shrink-0 ml-2 flex flex-col items-start">
                                  <div className="flex items-center gap-1">
                                    <span>{dayScores[slot.playerId] ?? 0} pts</span>
                                    <span>×</span>
                                    <span>{TIER_MULTS[slot.tier] ?? 100}%</span>
                                    <span className="text-zinc-500">({lang === "ru" ? "редкость" : "rarity"})</span>
                                    {hasRoleBonus && (
                                      <>
                                        <span>×</span>
                                        <span>{((100 + roleBonusPct) / 100).toFixed(2)}</span>
                                        <span className="text-zinc-500">({lang === "ru" ? "роль" : "role"})</span>
                                      </>
                                    )}
                                    <span>=</span>
                                    <span className="font-semibold">{pts} pts</span>
                                  </div>
                                </div>
                              )}
                              <span className="flex-1" />
                              <span className={`text-xs font-bold shrink-0 ${hasScores ? "text-white" : "text-zinc-600"}`}>{hasScores ? pts : "—"} pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isExpanded && (!l.slots || l.slots.length === 0) && (
                    <div className="border-t border-white/5 px-4 py-2 text-[10px] text-zinc-600">
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
            <details className="rounded-xl border border-white/5 bg-white/3">
              <summary className="cursor-pointer px-3 py-2 text-xs text-zinc-400 hover:text-white transition select-none">
                {lang === "ru" ? "ℹ️ Формула рассчета pts" : "ℹ️ How scoring works"}
              </summary>
              <div className="px-3 pb-3 pt-1 overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="text-zinc-500 border-b border-white/10">
                      <th className="text-left py-1 pr-3 font-semibold">{lang === "ru" ? "Категория" : "Category"}</th>
                      <th className="text-left py-1 pr-3 font-semibold">{lang === "ru" ? "Формула" : "Formula"}</th>
                      <th className="text-right py-1 font-semibold">Cap</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 divide-y divide-white/5">
                    {([
                      { cat: lang === "ru" ? "Изменение цены" : "Price change",  formula: lang === "ru" ? "±10 pts за 1%" : "±10 pts per 1%",                                          cap: "±300" },
                      { cat: lang === "ru" ? "Объём торгов"   : "Trading volume", formula: lang === "ru" ? "Ступени $10M→$500M+" : "Steps $10M→$500M+",                                 cap: "+100" },
                      { cat: lang === "ru" ? "Волатильность"  : "Volatility",     formula: lang === "ru" ? "(high−low)/low×100, ступени 2%→20%" : "(high−low)/low×100, steps 2%→20%",  cap: "+100" },
                      { cat: lang === "ru" ? "Температура"    : "Temperature",    formula: lang === "ru" ? "+10 pts за 1% vol/mcap" : "+10 pts per 1% vol/mcap",                         cap: "+150" },
                      { cat: lang === "ru" ? "Выборов игроков" : "Player picks",   formula: lang === "ru" ? "+100 топ-15 монет по выборам игроков за предыдущий день (при равенстве — все)" : "+100 for top-15 coins by player picks previous day (ties included)", cap: "+100" },
                    ] as { cat: string; formula: string; cap: string }[]).map(({ cat, formula, cap }) => (
                      <tr key={cat}>
                        <td className="py-1.5 pr-3 font-medium text-white">{cat}</td>
                        <td className="py-1.5 pr-3 text-zinc-400">{formula}</td>
                        <td className="py-1.5 text-right font-mono text-emerald-400">{cap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {claimState?.active && userClaimable > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-900/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-amber-300">🎉 {lang === "ru" ? "Ваш приз готов к получению" : "Your prize is ready to claim"}</div>
                    <div className="text-xs text-amber-400/80 mt-0.5">
                      {(userClaimable / 1e18).toFixed(4)} ETH
                      {claimState.deadline > 0 && (
                        <> · {lang === "ru" ? "Дедлайн" : "Deadline"}: {new Date(claimState.deadline * 1000).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>
                      )}
                    </div>
                  </div>
                  <button onClick={onClaim} disabled={busy !== null}
                    className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-black text-black disabled:opacity-50 transition">
                    {busy === "claim" ? "…" : (lang === "ru" ? "Забрать" : "Claim")}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">{lang === "ru" ? "Выбери день" : "Select day"}</div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.max(totalDays, 1) }, (_, i) => i + 1).map(d => {
                    const past = isDayPast(d);
                    const isToday = tnState?.active && d === tnState.currentDay;
                    const finalized = past && oracleDayCache.get(d)?.finalized;
                    const date = dayToDate(d);
                    const dayNum = date.getDate();
                    const mon = date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "short" });
                    const btnClass = isToday
                      ? "border border-cyan-400/60 bg-cyan-500/10 text-cyan-300"
                      : !past
                        ? "opacity-30 cursor-not-allowed bg-white/5 text-zinc-600"
                        : resultsDay === d
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white";
                    return (
                      <button key={d}
                        onClick={() => { setResultsDay(d); if (past) fetchOracleDays([d]); }}
                        disabled={!past && !isToday}
                        className={`w-12 h-12 rounded-lg text-xs font-bold transition relative flex flex-col items-center justify-center leading-none ${btnClass}`}>
                        <span className="text-sm font-black">{dayNum}</span>
                        <span className="text-[9px] font-normal opacity-70">{mon}</span>
                        {isToday && <span className="text-[7px] font-bold uppercase tracking-wider opacity-70 leading-none mt-0.5">{lang === "ru" ? "сегодня" : "today"}</span>}
                        {finalized && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden" data-tour="invest-coins">
              <button
                type="button"
                onClick={() => setCoinListOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition text-left">
                <div className="text-xs font-semibold text-zinc-400">
                  {lang === "ru" ? "Монеты" : "Coins"}{` · ${fmtDay(resultsDay)}`}
                </div>
                <div className="flex items-center gap-2">
                  {(resultsDaysLoading || (!allDaysLoaded && activeDays.length > 0)) && (
                    <span className="text-xs text-zinc-500">⏳</span>
                  )}
                  <svg className={`w-4 h-4 text-zinc-500 transition-transform ${coinListOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div className="hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{lang === "ru" ? "Фильтр" : "Filter"}</span>
                <select
                  value={coinCategoryFilter}
                  onChange={(e) => setCoinCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="h-8 rounded-lg border border-white/10 bg-[#0a0c18] px-2 text-xs font-semibold text-zinc-300 outline-none transition hover:border-white/20 focus:border-cyan-400/50">
                  {coinCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {coinListOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-zinc-500">
                        <th className="px-3 py-2 text-left w-7">#</th>
                        <th className="px-2 py-2 text-left">{lang === "ru" ? "Монета" : "Coin"}</th>
                        <th className="px-2 py-2 text-center">
                          <select
                            aria-label={lang === "ru" ? "Категория" : "Category"}
                            value={coinCategoryFilter}
                            onChange={(e) => setCoinCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                            className="mx-auto h-7 max-w-[130px] rounded-md border border-white/10 bg-[#0a0c18] px-2 text-[10px] font-semibold text-zinc-400 outline-none transition hover:border-white/20 focus:border-cyan-400/50">
                            {coinCategoryOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </th>
                        {marketData && (<>
                          <th className="px-2 py-2 text-right text-emerald-500/80">{lang === "ru" ? "Цена%" : "Price%"}</th>
                          <th className="px-2 py-2 text-right text-zinc-400">{lang === "ru" ? "Объём" : "Vol"}</th>
                          <th className="px-2 py-2 text-right text-zinc-400">High</th>
                          <th className="px-2 py-2 text-right text-zinc-400">Low</th>
                          <th className="px-2 py-2 text-right text-cyan-500/80">{lang === "ru" ? "Темп%" : "Temp%"}</th>
                          <th className="px-2 py-2 text-center text-violet-400">ХАЙП</th>
                        </>)}
                        <th className="px-3 py-2 text-right font-semibold text-blue-400">{lang === "ru" ? "Очки" : "Score"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coinRows.map(({ pid, name, score, rank, market }) => (
                        <tr key={pid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                          <td className="px-3 py-1.5 text-zinc-500 tabular-nums">
                            {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank + 1}`}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <img src={COIN_ICONS[pid]} alt={name} className="h-5 w-5 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                              <div>
                                <div className="text-zinc-200 font-semibold leading-none">{name}</div>
                                <div className="text-[9px] text-zinc-500">{COIN_TICKERS[pid]}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center text-zinc-500">{PLAYER_TEAMS[pid]}</td>
                          {marketData && (<>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px]">
                              {market ? (
                                <span className={market.priceChg >= 0 ? "text-emerald-400" : "text-red-400"}>
                                  {market.priceChg >= 0 ? "+" : ""}{market.priceChg.toFixed(2)}%
                                </span>
                              ) : <span className="text-zinc-700">—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px] text-zinc-400">
                              {market ? fmtVol(market.vol24h) : <span className="text-zinc-700">—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px] text-zinc-400">
                              {market ? fmtPrice(market.high24h) : <span className="text-zinc-700">—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px] text-zinc-400">
                              {market ? fmtPrice(market.low24h) : <span className="text-zinc-700">—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[11px] text-cyan-400">
                              {market ? `${market.tempRatio.toFixed(1)}%` : <span className="text-zinc-700">—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {market?.hype
                                ? <span className="text-emerald-400 font-bold tabular-nums font-mono text-[11px]">🔥{lineupStats?.[pid] ?? ""}</span>
                                : <span className="text-zinc-700 tabular-nums font-mono text-[11px]">{lineupStats ? lineupStats[pid] || "—" : "—"}</span>}
                            </td>
                          </>)}
                          <td className="px-3 py-1.5 text-right font-black tabular-nums">
                            <span className={score > 0 ? "text-emerald-400" : score < 0 ? "text-red-400" : "text-zinc-600"}>{score}</span>
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
