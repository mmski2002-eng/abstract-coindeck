"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/ui";
import type { TournamentStateData, RankRow, PrizeConfig } from "../types";
import { COIN_TICKERS, COIN_ICONS } from "../constants";

const PAGE_SIZE = 25;

type LineupDay = { day: number; league: number };

type Props = {
  lang: string;
  epochRange: [number, number];
  tnState: TournamentStateData;
  lbRows: RankRow[];
  lbLoading: boolean;
  lbError: string;
  lbLeagueFilter: number | null;
  setLbLeagueFilter: (v: number | null) => void;
  accountAddress: string | null;
  leagueInfoOpen: boolean;
  setLeagueInfoOpen: (v: boolean) => void;
  tnLineups: LineupDay[];
  prizeConfig: PrizeConfig;
};

export function RankingsTab({
  lang,
  epochRange,
  tnState,
  lbRows,
  lbLoading,
  lbError,
  lbLeagueFilter,
  setLbLeagueFilter,
  accountAddress,
  leagueInfoOpen,
  setLeagueInfoOpen,
  tnLineups,
  prizeConfig,
}: Props) {
  const [lbPage, setLbPage] = useState(0);
  const [prizeInfoOpen, setPrizeInfoOpen] = useState(false);
  const didManualFilter = useRef(false);

  const epoch        = epochRange[1] ?? 1;
  const displayEpoch = epoch - (epochRange[0] ?? 1) + 1;

  const LEAGUE_LABELS = [
    { en: "Bronze", ru: "Bronze", accent: "var(--rarity-common)", soft: "var(--paper-2)" },
    { en: "Silver", ru: "Silver", accent: "var(--rarity-rare)", soft: "var(--sky-soft)" },
    { en: "Gold",   ru: "Gold",   accent: "var(--warn)", soft: "var(--warn-soft)" },
  ];

  const totalDays  = tnState?.totalDays ?? 6;
  const currentDay = tnState?.currentDay === 0 ? totalDays : Math.min(tnState?.currentDay ?? 1, totalDays);

  // Weighted average: Bronze=0, Silver=1, Gold=2; avg<0.5→Bronze, 0.5-1.5→Silver, ≥1.5→Gold
  const myDominantLeague: number | null = (() => {
    if (!tnLineups.length) return null;
    const avg = tnLineups.reduce((sum, l) => sum + Math.max(0, Math.min(l.league, 2)), 0) / tnLineups.length;
    return avg >= 1.5 ? 2 : avg >= 0.5 ? 1 : 0;
  })();

  const myLeaderboardLeague: number | null = (() => {
    if (!accountAddress) return null;
    const row = lbRows.find(r => r.addr.toLowerCase() === accountAddress.toLowerCase());
    return row ? Math.max(0, Math.min(row.league, 2)) : null;
  })();

  const myCurrentLeague = myLeaderboardLeague ?? myDominantLeague;
  const initialLeagueFilter = myCurrentLeague ?? 0;

  // Rank within dominant league
  const myLeagueRank: number | null = (() => {
    if (!accountAddress || myCurrentLeague === null) return null;
    const leagueRows = lbRows
      .filter(r => r.league === myCurrentLeague)
      .sort((a, b) => b.score - a.score);
    const idx = leagueRows.findIndex(r => r.addr.toLowerCase() === accountAddress.toLowerCase());
    return idx === -1 ? null : idx + 1;
  })();

  const visibleRows = lbRows.filter(r => lbLeagueFilter === null || r.league === lbLeagueFilter);
  const normalizedAccount = accountAddress?.toLowerCase() ?? null;
  const myPinnedRow = normalizedAccount
    ? visibleRows.find(r => r.addr.toLowerCase() === normalizedAccount) ?? null
    : null;
  const rankByAddr = new Map(visibleRows.map((row, idx) => [row.addr.toLowerCase(), idx + 1]));
  const otherRows = normalizedAccount
    ? visibleRows.filter(r => r.addr.toLowerCase() !== normalizedAccount)
    : visibleRows;
  const totalPages  = Math.ceil(otherRows.length / PAGE_SIZE);
  const pageRows    = [
    ...(myPinnedRow ? [myPinnedRow] : []),
    ...otherRows.slice(lbPage * PAGE_SIZE, (lbPage + 1) * PAGE_SIZE),
  ];

  // Reset page when filter changes
  const handleFilterChange = (v: number | null) => {
    didManualFilter.current = true;
    setLbLeagueFilter(v);
    setLbPage(0);
  };

  // Auto-select player's league as soon as it is known; fallback to Bronze.
  useEffect(() => {
    if (didManualFilter.current) return;
    if (lbLoading && lbRows.length === 0) return;
    if (lbLeagueFilter === initialLeagueFilter) return;
    queueMicrotask(() => {
      setLbLeagueFilter(initialLeagueFilter);
      setLbPage(0);
    });
  }, [lbLoading, lbRows.length, lbLeagueFilter, initialLeagueFilter, setLbLeagueFilter]);

  const ll = myCurrentLeague !== null ? LEAGUE_LABELS[myCurrentLeague] : null;
  const positionPayouts = [
    { pos: lang === "ru" ? "1 место" : "1st", pct: `${prizeConfig.pos1}%` },
    { pos: lang === "ru" ? "2 место" : "2nd", pct: `${prizeConfig.pos2}%` },
    { pos: lang === "ru" ? "3 место" : "3rd", pct: `${prizeConfig.pos3}%` },
    { pos: lang === "ru" ? "4–9 места" : "4th–9th", pct: lang === "ru" ? `${prizeConfig.pos4_9}% каждому` : `${prizeConfig.pos4_9}% each` },
    { pos: lang === "ru" ? "10–19 места" : "10th–19th", pct: lang === "ru" ? `${prizeConfig.pos10_19}% каждому` : `${prizeConfig.pos10_19}% each` },
    { pos: lang === "ru" ? "20–49 места" : "20th–49th", pct: lang === "ru" ? `${prizeConfig.pos20_49}% каждому` : `${prizeConfig.pos20_49}% each` },
    { pos: lang === "ru" ? "50–99 места" : "50th–99th", pct: lang === "ru" ? `${prizeConfig.pos50_99}% каждому` : `${prizeConfig.pos50_99}% each` },
  ];
  const leagueByDay = new Map(tnLineups.map((lineup) => [lineup.day, Math.max(0, Math.min(lineup.league, 2))]));
  const leagueDots = Array.from({ length: Math.max(totalDays, 6) }, (_, i) => {
    const day = i + 1;
    const league = leagueByDay.get(day);
    return { day, league };
  });
  const leagueDotStyles = LEAGUE_LABELS.map((league) => ({
    color: league.accent,
    soft: league.soft,
  }));

  return (
    <div className="mt-2 space-y-4">
      {/* ── Stats bar ── */}
      <section className="relative mb-6" data-tour="rankings-info">
        <div className="relative grid grid-cols-2 gap-3 rounded-3xl p-3 lg:grid-cols-4" style={{ border: "1px solid var(--info-block-shell-border)", background: "var(--info-block-shell)", boxShadow: "var(--info-block-shell-shadow)" }}>

          {/* Card 1 — Current day */}
          <StatCard
            label={lang === "ru" ? "Текущий день" : "Current day"}
            value={String(currentDay)}
            unit={lang === "ru" ? "день" : "day"}
            delta={lang === "ru" ? `Неделя ${displayEpoch}` : `Week ${displayEpoch}`}
            delay={0}
          />

          {/* Card 2 — Investors */}
          <StatCard
            label={lang === "ru" ? "Инвесторов" : "Investors"}
            value={String(lbRows.length)}
            unit={lang === "ru" ? "чел" : "people"}
            delta={lang === "ru" ? "участников" : "participants"}
            delay={80}
          />

          {/* Card 3 — Prize pool with info button */}
          <div className="relative group overflow-hidden rounded-2xl p-5 anim-card-entry" style={{ animationDelay: "160ms", border: "1px solid var(--info-block-card-border)", background: "var(--info-block-card)", boxShadow: "var(--info-block-card-shadow)" }}>
            <div className="relative mb-4 flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--info-block-label)" }}>{lang === "ru" ? "Призовой фонд" : "Prize pool"}</span>
              <button
                type="button"
                onClick={() => setPrizeInfoOpen(true)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition hover:brightness-95 dark:hover:brightness-110"
                style={{ borderColor: "var(--info-block-icon-border)", background: "var(--info-block-icon-bg)", color: "var(--info-block-icon-text)" }}
                aria-label={lang === "ru" ? "Информация о призовом фонде" : "Prize pool info"}
              >i</button>
            </div>
            <div className="relative flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--info-block-value)" }}>
                {tnState ? (tnState.prizePool / 1e18).toFixed(4) : "0.0000"}
              </span>
              <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--info-block-meta)" }}>ETH</span>
            </div>
            <div className="relative mt-2">
              <span className="font-mono text-[11px]" style={{ color: "var(--info-block-delta)" }}>{lang === "ru" ? "для победителей" : "for winners"}</span>
            </div>
          </div>

          {/* Card 4 — My rank in league */}
          <div className="relative group overflow-hidden rounded-2xl p-5 anim-card-entry" style={{ animationDelay: "240ms", border: "1px solid var(--info-block-card-border)", background: "var(--info-block-card)", boxShadow: "var(--info-block-card-shadow)" }}>
            <div className="relative mb-4 flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--info-block-label)" }}>{lang === "ru" ? "Мой рейтинг" : "My ranking"}</span>
              <button
                type="button"
                onClick={() => setLeagueInfoOpen(true)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition hover:brightness-95 dark:hover:brightness-110"
                style={{ borderColor: "var(--info-block-icon-border)", background: "var(--info-block-icon-bg)", color: "var(--info-block-icon-text)" }}
                aria-label={lang === "ru" ? "Информация о лигах" : "League info"}
              >i</button>
            </div>
            <div className="relative flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--info-block-value)" }}>
                {myLeagueRank ?? "—"}
              </span>
              <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--info-block-meta)" }}>{lang === "ru" ? "место" : "place"}</span>
            </div>
            <div className="relative mt-2 flex items-center gap-1.5">
              {ll ? (
                <>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: ll.accent }}>{ll.en}</span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--info-block-meta)" }}>{lang === "ru" ? "лига" : "league"}</span>
                </>
              ) : (
                <span className="font-mono text-[11px]" style={{ color: "var(--info-block-meta)" }}>{lang === "ru" ? "не участвует" : "not participating"}</span>
              )}
            </div>
            <div className="relative mt-3">
              <LeagueDayDots
                lang={lang}
                leagueDots={leagueDots}
                leagueDotStyles={leagueDotStyles}
                leagueLabels={LEAGUE_LABELS}
                compact
              />
            </div>
          </div>

        </div>
      </section>

      {lbError && (
        <div className="card-sticker rounded-xl p-3 text-sm" style={{ background: "var(--down-soft)", color: "var(--down)" }}>
          {lbError}
        </div>
      )}

      {/* League filter — no "All" option */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Лига" : "League"}</div>
        <div className="flex gap-1.5 flex-wrap">
          {LEAGUE_LABELS.map((l, i) => (
            <button key={i}
              onClick={() => handleFilterChange(lbLeagueFilter === i ? null : i)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${lbLeagueFilter === i ? "nav-tab-active" : ""}`}
              style={lbLeagueFilter === i ? {
                background: "var(--filter-chip-active-bg)",
                color: "var(--filter-chip-active-text)",
                borderColor: "var(--filter-chip-active-border)",
              } : {
                color: "var(--filter-chip-text)",
                background: "var(--filter-chip-bg)",
                borderColor: "var(--filter-chip-border)",
              }}>
              {l.en}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh indicator */}
      {lbLoading && lbRows.length > 0 && (
        <div className="flex items-center gap-2 px-1 pb-1 text-xs" style={{ color: "var(--ink-3)" }}>
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--ink-3)" }} />
          {lang === "ru" ? "Лидерборд обновляется раз в сутки" : "Refreshing rankings, showing cached data…"}
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-base font-bold" style={{ color: "var(--panel-text)" }}>{lang === "ru" ? "🏆 Топ тяжеловесов" : "🏆 Top Heavyweights"}</span>
      </div>

      {/* Table */}
      {lbLoading && lbRows.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm" style={{ border: "1px solid var(--panel-border)", background: "var(--my-lots-bg)", color: "var(--panel-text-muted)" }}>
          <div className="animate-pulse">{lang === "ru" ? "Загрузка рейтинга…" : "Loading rankings…"}</div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Запрашиваем данные участников" : "Fetching participant data"}</div>
        </div>
      ) : !lbLoading && visibleRows.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm" style={{ border: "1px solid var(--panel-border)", background: "var(--my-lots-bg)", color: "var(--nft-muted)" }}>
          {lang === "ru" ? "Нет данных" : "No data"}
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--panel-border)", background: "var(--my-lots-bg)" }} data-tour="rankings-table">
            <div
              className="grid grid-cols-[2rem_1fr_5rem_3.5rem_5rem] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ borderBottom: "2px solid var(--outline)", color: "var(--ink-3)" }}
            >
              <div>#</div>
              <div className="flex items-center justify-between">
                <span>{lang === "ru" ? "Кошелёк" : "Wallet"}</span>
                <span>{lang === "ru" ? "Портфель вчера" : "Yesterday"}</span>
              </div>
              <div className="text-right">{lang === "ru" ? "Лига" : "League"}</div>
              <div className="text-right">{lang === "ru" ? "Дней" : "Days"}</div>
              <div className="text-right">{lang === "ru" ? "Очки" : "Score"}</div>
            </div>
            {pageRows.map((row, idx) => {
              const globalIdx = (rankByAddr.get(row.addr.toLowerCase()) ?? (lbPage * PAGE_SIZE + idx + 1)) - 1;
              const rowLL = LEAGUE_LABELS[row.league] ?? LEAGUE_LABELS[0];
              const isMe  = accountAddress && row.addr.toLowerCase() === accountAddress.toLowerCase();
              const TIER_DOTS = ["var(--rarity-common)", "var(--rarity-rare)", "var(--rarity-epic)", "var(--rarity-legendary)"];
              return (
                <div key={row.addr}
                  className="grid grid-cols-[2rem_1fr_5rem_3.5rem_5rem] gap-3 px-4 py-3 items-center transition-colors"
                  style={{
                    borderBottom: "1.5px solid var(--divider)",
                    borderLeft: isMe ? "3px solid var(--mint)" : "3px solid transparent",
                    background: isMe ? "var(--mint-soft)" : "transparent",
                  }}>
                  <div className="text-sm font-black" style={{ color: globalIdx < 3 ? "var(--ink)" : "var(--ink-3)" }}>
                    {globalIdx === 0 ? "🥇" : globalIdx === 1 ? "🥈" : globalIdx === 2 ? "🥉" : globalIdx + 1}
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      {row.nickname && (
                        <div className={`text-xs font-semibold truncate leading-tight`} style={isMe ? { color: "var(--panel-text)" } : {}}>
                          {row.nickname}
                          {isMe && <span className="ml-1.5 text-[9px] font-black rounded px-1" style={{ color: "var(--ink)", background: "var(--mint-soft)", border: "1px solid var(--outline)" }}>YOU</span>}
                        </div>
                      )}
                      <div
                        className={`font-mono truncate leading-tight ${row.nickname ? "text-[10px]" : `text-xs ${isMe ? "font-bold" : ""}`}`}
                        style={{ color: isMe ? "var(--panel-text)" : "var(--ink-3)" }}>
                        {row.addr.slice(0, 6)}…{row.addr.slice(-4)}
                        {!row.nickname && isMe && <span className="ml-1.5 text-[9px] font-black rounded px-1" style={{ color: "var(--ink)", background: "var(--mint-soft)", border: "1px solid var(--outline)" }}>YOU</span>}
                      </div>
                    </div>
                    {row.prevDayPids && row.prevDayPids.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {row.prevDayPids.slice(0, 5).map((pid, i) => {
                          const tier = row.prevDayTiers?.[i] ?? 0;
                          const ticker = COIN_TICKERS[pid] ?? "BTC";
                          const icon = COIN_ICONS[pid] ?? COIN_ICONS[0];
                          const ringColor = TIER_DOTS[Math.min(tier, 3)];
                          return (
                            <div key={i} className="w-10 h-10 rounded-full overflow-hidden shrink-0" style={{ boxShadow: `0 0 0 1.5px ${ringColor}` }}>
                              <img src={icon} alt={ticker} width={40} height={40} className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-right" style={{ color: rowLL.accent }}>
                    {lang === "ru" ? rowLL.ru : rowLL.en}
                  </div>
                  <div className="text-xs text-right tabular-nums" style={{ color: "var(--ink-3)" }}>{row.days}/{totalDays}</div>
                  <div className="text-sm font-black text-right tabular-nums" style={{ color: "var(--panel-text)" }}>
                    {row.score.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                disabled={lbPage === 0}
                onClick={() => setLbPage(p => p - 1)}
                className="btn-sticker-outline px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i}
                  onClick={() => setLbPage(i)}
                  className={lbPage === i ? "btn-sticker-primary w-7 h-7 rounded-lg p-0 text-xs font-semibold transition" : "btn-sticker-outline w-7 h-7 rounded-lg p-0 text-xs font-semibold transition"}>
                  {i + 1}
                </button>
              ))}
              <button
                disabled={lbPage === totalPages - 1}
                onClick={() => setLbPage(p => p + 1)}
                className="btn-sticker-outline px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
                ›
              </button>
            </div>
          )}
        </>
      )}

      {/* Prize pool info modal */}
      <Modal
        open={prizeInfoOpen}
        onClose={() => setPrizeInfoOpen(false)}
        title={lang === "ru" ? "Призовой фонд" : "Prize Pool"}
      >
        <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--panel-text-muted)" }}>
          <p>
            {lang === "ru"
              ? "100% дохода от покупки сундуков поступает в призовой пул турнира — без комиссий платформы."
              : "100% of chest purchase revenue goes directly into the tournament prize pool — no platform fees."}
          </p>
          <p>
            {lang === "ru"
              ? "Организаторы могут дополнительно пополнять призовой фонд по своему усмотрению, увеличивая общий объём наград для участников."
              : "The organizers may additionally top up the prize pool at their discretion, increasing the total reward for participants."}
          </p>
        </div>
      </Modal>

      {/* League info modal */}
      <Modal
        open={leagueInfoOpen}
        onClose={() => setLeagueInfoOpen(false)}
        title={lang === "ru" ? "Лиги и призовое распределение" : "Leagues & Prize Distribution"}
      >
        <div className="space-y-6 text-sm">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Как определяется лига" : "How leagues are determined"}</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--panel-text-muted)" }}>
              {lang === "ru"
                ? "Лига определяется по взвешенному среднему: Бронза=0, Сильвер=1, Голд=2. Среднее <0.5 → Бронза, 0.5–1.5 → Сильвер, ≥1.5 → Голд. Прогресс в высшую лигу повышает итоговую лигу. Карты делятся на тиры: Common (T1), Rare (T2), Epic (T3), Legendary (T4)."
                : "League is determined by weighted average: Bronze=0, Silver=1, Gold=2. avg<0.5→Bronze, 0.5–1.5→Silver, ≥1.5→Gold. Progressing to a higher league raises your final league. Cards have tiers: Common (T1), Rare (T2), Epic (T3), Legendary (T4)."}
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--warn-soft)", border: "1.5px solid var(--outline)" }}>
                <span className="text-base shrink-0">🥇</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: "var(--warn)" }}>Gold — {prizeConfig.goldPct}% {lang === "ru" ? "призового фонда" : "of prize pool"}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {lang === "ru" ? "1 Legendary или 5 Epic карт в составе." : "1 Legendary or 5 Epic cards in lineup."}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--sky-soft)", border: "1.5px solid var(--outline)" }}>
                <span className="text-base shrink-0">🥈</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: "var(--ink)" }}>Silver — {prizeConfig.silverPct}% {lang === "ru" ? "призового фонда" : "of prize pool"}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {lang === "ru" ? "Хотя бы 1 Epic или все 5 карт Rare." : "At least 1 Epic or all 5 cards Rare."}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--paper-2)", border: "1.5px solid var(--outline)" }}>
                <span className="text-base shrink-0">🥉</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: "var(--ink-2)" }}>Bronze — {prizeConfig.bronzePct}% {lang === "ru" ? "призового фонда" : "of prize pool"}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {lang === "ru" ? "Только Common (T1) карты." : "Only Common (T1) cards."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Распределение внутри лиги" : "Distribution within each league"}</p>
            <div className="card-sticker rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 text-[10px] font-semibold uppercase tracking-wider px-4 py-2" style={{ borderBottom: "2px solid var(--outline)", background: "var(--sunken)", color: "var(--ink-3)" }}>
                <div>{lang === "ru" ? "Позиция" : "Position"}</div>
                <div className="text-right">{lang === "ru" ? "% от фонда лиги" : "% of league pool"}</div>
              </div>
              {positionPayouts.map(({ pos, pct }, idx) => (
                <div key={idx} className="grid grid-cols-2 px-4 py-2.5 transition-colors" style={{ borderBottom: "1.5px solid var(--divider)" }}>
                  <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>{pos}</div>
                  <div className="text-right font-mono text-xs font-semibold" style={{ color: "var(--info)" }}>{pct}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
              {lang === "ru"
                ? "Приз = процент × фонд лиги. Игроки вне призовых позиций награду не получают."
                : "Prize = percentage × league pool. Players outside payout tiers receive no reward."}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LeagueDayDots({
  lang,
  leagueDots,
  leagueDotStyles,
  leagueLabels,
  compact = false,
}: {
  lang: string;
  leagueDots: Array<{ day: number; league: number | undefined }>;
  leagueDotStyles: Array<{ color: string; soft: string }>;
  leagueLabels: Array<{ en: string; ru: string }>;
  compact?: boolean;
}) {
  const dotSize = compact ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[10px]";
  const gridGap = compact ? "gap-1.5" : "gap-2";

  return (
    <>
      <div className={`grid grid-cols-6 ${gridGap}`}>
        {leagueDots.map(({ day, league }) => {
          const active = league !== undefined;
          const colors = active ? leagueDotStyles[league] : { color: "var(--ink-3)", soft: "var(--sunken)" };
          return (
            <div
              key={day}
              className={`grid ${dotSize} place-items-center rounded-full border font-black tabular-nums`}
              style={{
                color: active ? "var(--ink)" : "var(--nft-semi)",
                background: active ? colors.soft : "var(--card)",
                borderColor: active ? colors.color : "var(--panel-border)",
                boxShadow: active ? "var(--shadow-sticker-sm)" : "none",
              }}
              title={active ? leagueLabels[league].en : (lang === "ru" ? "Неактивный день" : "Inactive day")}
            >
              {day}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatCard({ label, value, unit, delta, delay }: {
  label: string; value: string; unit: string;
  delta: string; delay: number;
}) {
  return (
    <div className="relative group overflow-hidden rounded-2xl p-5 anim-card-entry" style={{ animationDelay: `${delay}ms`, border: "1px solid var(--info-block-card-border)", background: "var(--info-block-card)", boxShadow: "var(--info-block-card-shadow)" }}>
      <div className="relative mb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--info-block-label)" }}>{label}</span>
      </div>
      <div className="relative flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--info-block-value)" }}>{value}</span>
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--info-block-meta)" }}>{unit}</span>
      </div>
      <div className="relative mt-2">
        <span className="font-mono text-[11px]" style={{ color: "var(--info-block-delta)" }}>{delta}</span>
      </div>
    </div>
  );
}
