import { useEffect, useRef, useState } from "react";
import type { Config } from "@wagmi/core";
import { TIER_MULTS, PLAYER_ROLE_IDS } from "../constants";
import type { TransactionPayload, TxOptions, TournamentStateData, LineupSlot, LineupEntry } from "../types";
import { getErrorMessage } from "../utils";
import {
  readEvmCancelFee,
  readEvmOracleDayScores,
  readEvmPlayerLineups,
  readEvmTournamentState,
} from "@/lib/evmContracts";

interface Deps {
  restUrl: string;
  moduleAddress: string;
  wagmiConfig: Config;
  submitTx: (p: TransactionPayload, opts?: TxOptions) => Promise<void>;
  setBusy: (v: string | null) => void;
  flCards: { playerId: number; tier: number; cardAddr: string }[];
  walletAccount: { address: unknown } | null | undefined;
  lang: string;
}

export function useTournamentLogic({ restUrl, moduleAddress, wagmiConfig, submitTx, setBusy, flCards, walletAccount, lang }: Deps) {
  const [tnState, setTnState] = useState<TournamentStateData>(null);
  const [tnLineups, setTnLineups] = useState<LineupEntry[]>([]);
  const [lockedCardAddrs, setLockedCardAddrs] = useState<string[]>([]);
  const [cancelFee, setCancelFee] = useState(0);
  const [oracleDayCache, setOracleDayCache] = useState<Map<number, { scores: number[]; finalized: boolean }>>(new Map());
  const [marketSnapshotCache, setMarketSnapshotCache] = useState<Map<string, { pid: number; priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype: boolean }[]>>(new Map());
  const [lineupStatsCache, setLineupStatsCache] = useState<Map<string, number[]>>(new Map());
  const [tnError, setTnError] = useState("");
  const [tnRefreshing, setTnRefreshing] = useState(true);
  const [tnSelectedCards, setTnSelectedCards] = useState<(string | null)[]>([null, null, null, null, null]);
  const [lineupPickerSlot, setLineupPickerSlot] = useState<number | null>(null);
  const [lineupPickerTier, setLineupPickerTier] = useState<number | null>(null);
  const [lineupPickerSearch, setLineupPickerSearch] = useState("");
  const [lineupConfirmOpen, setLineupConfirmOpen] = useState(false);
  const [roleBonusPct, setRoleBonusPct] = useState<number>(15);

  useEffect(() => {
    fetch("/api/leaderboard/config")
      .then(r => r.ok ? r.json() : null)
      .then((v: { roleBonusPct?: number } | null) => {
        if (v?.roleBonusPct !== undefined) setRoleBonusPct(v.roleBonusPct);
      })
      .catch(() => {});
  }, []);
  const [viewEpoch, setViewEpoch] = useState<number | null>(null);
  const [epochRange, setEpochRange] = useState<[number, number]>([1, 1]);
  const [epochPageStart, setEpochPageStart] = useState(1);
  const [resultsMode, setResultsMode] = useState<"day" | "epoch">("day");
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<number>>(new Set());
  const [resultsDay, setResultsDay] = useState(1);
  const resultsDayInitialized = useRef(false);
  const [resultsEpoch, setResultsEpoch] = useState(1);
  const [resultsDaysLoading, setResultsDaysLoading] = useState(false);
  const SLOT_ROLES = ["Layer 1", "Layer 2", "DeFi", "Exchange", "Meme/Infra"];
  const [dayCountdown, setDayCountdown] = useState("");

  async function fetchLineupsForEpoch(addr: unknown, epoch: number): Promise<LineupEntry[]> {
    const player = String(addr ?? "").trim();
    if (!player.startsWith("0x")) return [];
    const entries = await readEvmPlayerLineups(wagmiConfig, player as `0x${string}`, epoch);
    setTnLineups(entries);
    return entries;
  }

  async function refreshTournament(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent;
    if (!silent) {
      setTnRefreshing(true);
      setTnError("");
    }
    try {
      const state = await readEvmTournamentState(wagmiConfig);
      const currentEpoch = state.epoch || 1;
      const currentDay = state.day;
      const totalDays = 6;
      setTnState({
        active: state.running,
        currentDay,
        startTimestamp: state.startTimestamp,
        prizePool: Number(state.prizePool),
        ended: !state.running,
        epoch: currentEpoch,
        totalDays,
      });
      setEpochRange([state.firstVisibleEpoch || currentEpoch, currentEpoch]);
      setCancelFee(Number(await readEvmCancelFee(wagmiConfig)));
      if (!resultsDayInitialized.current) {
        resultsDayInitialized.current = true;
        const defaultDay = currentDay === 0 ? totalDays : currentDay > 1 ? currentDay - 1 : 1;
        setResultsDay(defaultDay);
      }

      if (walletAccount) {
        const entries = await fetchLineupsForEpoch(walletAccount.address, currentEpoch);
        // Restore locked card addresses for current day
        const lsKey = `moveinvestor_locked_${String(walletAccount.address)}_day${currentDay}_ep${currentEpoch}`;
        try {
          const stored = localStorage.getItem(lsKey);
          if (stored) {
            setLockedCardAddrs(JSON.parse(stored) as string[]);
          } else {
            // Fallback: reconstruct from today's lineup slots + flCards (when localStorage was not set)
            const todayEntry = entries.find(l => l.day === currentDay);
            if (todayEntry?.slots && todayEntry.slots.length > 0) {
              const usedAddrs = new Set<string>();
              const addrs = todayEntry.slots
                .map(slot => {
                  const card = flCards.find(c => c.playerId === slot.playerId && c.tier === slot.tier && !usedAddrs.has(c.cardAddr));
                  if (card) usedAddrs.add(card.cardAddr);
                  return card?.cardAddr ?? null;
                })
                .filter((a): a is string => a !== null);
              setLockedCardAddrs(addrs);
              if (addrs.length > 0) {
                try { localStorage.setItem(lsKey, JSON.stringify(addrs)); } catch { /* ignore */ }
              }
            } else {
              setLockedCardAddrs([]);
            }
          }
        } catch { setLockedCardAddrs([]); }
      }
    } catch (e: unknown) {
      if (!silent) setTnError(getErrorMessage(e));
    }
    finally {
      if (!silent) setTnRefreshing(false);
    }
  }

  async function onSubmitLineup() {
    if (!walletAccount) return;
    if (tnSelectedCards.some((c) => c === null)) { setTnError(lang === "ru" ? "Выбери все 5 карточек" : "Select all 5 cards"); return; }
    setBusy("tn_submit");
    setTnError("");
    try {
      const submittedAddrs = tnSelectedCards as string[];
      await submitTx({
        function: `${moduleAddress}::tournament::submit_lineup`,
        typeArguments: [],
        functionArguments: [submittedAddrs],
      });
      if (walletAccount && tnState) {
        const slots = submittedAddrs.map(addr => {
          const c = flCards.find(c => c.cardAddr === addr);
          return { playerId: c?.playerId ?? 0, tier: c?.tier ?? 0 };
        });
        localStorage.setItem(`moveinvestor_lineup_${walletAccount.address}_${tnState.currentDay}_ep${tnState.epoch}`, JSON.stringify(slots));
        // Store locked card addresses
        const lsKey = `moveinvestor_locked_${String(walletAccount.address)}_day${tnState.currentDay}_ep${tnState.epoch}`;
        localStorage.setItem(lsKey, JSON.stringify(submittedAddrs));
        setLockedCardAddrs(submittedAddrs);
      }
      setTnSelectedCards([null, null, null, null, null]);
      await refreshTournament({ silent: true });
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 700));
        await refreshTournament({ silent: true });
      }
    } catch (e: unknown) { setTnError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  async function onCancelLineup() {
    if (!walletAccount || !tnState) return;
    setBusy("tn_cancel");
    setTnError("");
    try {
      await submitTx({
        function: `${moduleAddress}::tournament::cancel_lineup`,
        typeArguments: [],
        functionArguments: [],
      });
      const lsKey = `moveinvestor_locked_${String(walletAccount.address)}_day${tnState.currentDay}_ep${tnState.epoch}`;
      localStorage.removeItem(lsKey);
      setLockedCardAddrs([]);
      // Poll until chain reflects the cancel (same pattern as submit)
      await refreshTournament({ silent: true });
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 700));
        await refreshTournament({ silent: true });
      }
    } catch (e: unknown) { setTnError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  function closedOracleDay(): number {
    if (!tnState) return 0;
    if (tnState.currentDay > 0) return Math.max(0, tnState.currentDay - 1);
    const elapsed = tnState.startTimestamp > 0 ? (Date.now() / 1000) - tnState.startTimestamp : 0;
    return elapsed >= tnState.totalDays * 86400 ? tnState.totalDays : 0;
  }

  async function fetchOracleDays(days: number[]) {
    const missing = days.filter(d => !oracleDayCache.has(d));
    if (missing.length === 0) return;
    setResultsDaysLoading(true);
    try {
      const results = await Promise.all(missing.map(async (day) => {
        try {
          const oracleDay = await readEvmOracleDayScores(wagmiConfig, day);
          const posted = oracleDay.posted;
          const finalized = posted && day <= closedOracleDay();
          const scores = new Array(50).fill(0) as number[];
          oracleDay.playerIds.forEach((pid, i) => { if (pid < 50) scores[pid] = Number(oracleDay.points[i] ?? 0n); });
          return [day, { scores, finalized }] as [number, { scores: number[]; finalized: boolean }];
        } catch { return null; }
      }));
      setOracleDayCache(prev => {
        const next = new Map(prev);
        for (const r of results) { if (r) next.set(r[0], r[1]); }
        return next;
      });
    } finally { setResultsDaysLoading(false); }
  }

  function heroScore(playerId: number, tier: number, slotIdx: number, dayScores: number[]): number {
    const base = dayScores[playerId] ?? 0;
    const mult = TIER_MULTS[tier] ?? 100;
    const roleBonus = PLAYER_ROLE_IDS[playerId] === slotIdx ? (100 + roleBonusPct) : 100;
    return Math.floor(base * mult * roleBonus / 10000);
  }

  // Clear oracle cache when epoch advances so stale day-scores don't linger
  const prevEpochRef = useRef<number | null>(null);
  useEffect(() => {
    const ep = tnState?.epoch ?? null;
    if (ep !== null && prevEpochRef.current !== null && prevEpochRef.current !== ep) {
      setOracleDayCache(new Map());
    }
    prevEpochRef.current = ep;
  }, [tnState?.epoch]); // eslint-disable-line

  async function loadOracleHistoryForEpoch(epoch: number) {
    try {
      const resp = await fetch(`/api/oracle-history?epoch=${epoch}`);
      if (!resp.ok) return;
      const data = await resp.json() as Record<string, number[]>;
      if (Object.keys(data).length === 0) return;
      setOracleDayCache(prev => {
        const next = new Map(prev);
        for (const [dayStr, scores] of Object.entries(data)) {
          next.set(Number(dayStr), { scores, finalized: true });
        }
        return next;
      });
    } catch { /* ignore */ }
  }

  // Re-fetch lineups and oracle history when switching to a different epoch view
  const viewEpochInitRef = useRef(false);
  useEffect(() => {
    if (!viewEpochInitRef.current) { viewEpochInitRef.current = true; return; }
    setOracleDayCache(new Map());
    if (!walletAccount) return;
    const currentEpoch = tnState?.epoch;
    const targetEpoch = viewEpoch ?? currentEpoch;
    if (!targetEpoch) return;
    fetchLineupsForEpoch(walletAccount.address, targetEpoch); // eslint-disable-line
    // Past epoch → load from history; current epoch → live oracle data will be fetched as needed
    if (viewEpoch !== null && currentEpoch !== undefined && viewEpoch < currentEpoch) {
      loadOracleHistoryForEpoch(viewEpoch); // eslint-disable-line
    }
  }, [viewEpoch, walletAccount]); // eslint-disable-line

  // Auto-fetch oracle scores for lineup days not yet cached
  useEffect(() => {
    const missing = tnLineups.filter(l => !oracleDayCache.has(l.day)).map(l => l.day);
    if (missing.length === 0) return;
    Promise.all(missing.map(async (day) => {
      try {
        const oracleDay = await readEvmOracleDayScores(wagmiConfig, day);
        const posted = oracleDay.posted;
        const finalized = posted && day <= closedOracleDay();
        const scores = new Array(50).fill(0) as number[];
        oracleDay.playerIds.forEach((pid, i) => { if (pid < 50) scores[pid] = Number(oracleDay.points[i] ?? 0n); });
        return [day, { scores, finalized }] as [number, { scores: number[]; finalized: boolean }];
      } catch { return null; }
    })).then(results => {
      setOracleDayCache(prev => {
        const next = new Map(prev);
        for (const r of results) { if (r) next.set(r[0], r[1]); }
        return next;
      });
    });
  }, [tnLineups]); // eslint-disable-line

  // Day countdown ticker
  useEffect(() => {
    const fmt = (ms: number) => {
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    const tick = () => {
      if (!tnState) { setDayCountdown("00:00:00"); return; }
      const now = Math.floor(Date.now() / 1000);
      if (!tnState.active) {
        const diff = (tnState.startTimestamp - now) * 1000;
        setDayCountdown(diff > 0 ? fmt(diff) : "00:00:00");
        return;
      }
      if (tnState.currentDay > tnState.totalDays) { setDayCountdown("00:00:00"); return; }
      if (tnState.currentDay === 0) {
        const weeksPassed = Math.floor((now - tnState.startTimestamp) / 86400 / 7);
        const nextEpochTs = (tnState.startTimestamp + (weeksPassed + 1) * 7 * 86400) * 1000;
        const diff = nextEpochTs - Date.now();
        setDayCountdown(diff > 0 ? fmt(diff) : "00:00:00");
        return;
      }
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsedDays = Math.floor((nowSec - tnState.startTimestamp) / 86400);
      const weeksPassed = Math.floor(elapsedDays / 7);
      const epochStartSec = tnState.startTimestamp + weeksPassed * 7 * 86400;
      const nextDayTs = (epochStartSec + tnState.currentDay * 86400) * 1000;
      const diff = nextDayTs - Date.now();
      setDayCountdown(diff > 0 ? fmt(diff) : "00:00:00");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tnState?.active, tnState?.startTimestamp, tnState?.currentDay, tnState?.totalDays]); // eslint-disable-line

  async function fetchMarketSnapshot(epoch: number, day: number) {
    const cacheKey = `${epoch}-${day}`;
    if (marketSnapshotCache.has(cacheKey)) return;
    try {
      const resp = await fetch(`/api/market-snapshot?epoch=${epoch}&day=${day}`);
      if (!resp.ok) return;
      const json = await resp.json() as { data: { pid: number; priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype: boolean }[] | null };
      if (json.data) {
        setMarketSnapshotCache(prev => {
          const next = new Map(prev);
          next.set(cacheKey, json.data!);
          return next;
        });
      }
    } catch { /* ignore */ }
  }

  async function fetchLineupStats(epoch: number, day: number) {
    const cacheKey = `${epoch}-${day}`;
    if (lineupStatsCache.has(cacheKey)) return;
    try {
      const resp = await fetch(`/api/lineup-stats?epoch=${epoch}&day=${day}`);
      if (!resp.ok) return;
      const json = await resp.json() as { data: number[] | null };
      if (json.data) setLineupStatsCache(prev => { const next = new Map(prev); next.set(cacheKey, json.data!); return next; });
    } catch { /* ignore */ }
  }

  return {
    tnState, setTnState,
    tnLineups, setTnLineups,
    oracleDayCache, setOracleDayCache,
    tnError, setTnError,
    tnRefreshing, setTnRefreshing,
    tnSelectedCards, setTnSelectedCards,
    lineupPickerSlot, setLineupPickerSlot,
    lineupPickerTier, setLineupPickerTier,
    lineupPickerSearch, setLineupPickerSearch,
    lineupConfirmOpen, setLineupConfirmOpen,
    roleBonusPct, setRoleBonusPct,
    viewEpoch, setViewEpoch,
    epochRange, setEpochRange,
    epochPageStart, setEpochPageStart,
    resultsMode, setResultsMode,
    expandedPortfolios, setExpandedPortfolios,
    resultsDay, setResultsDay,
    resultsEpoch, setResultsEpoch,
    resultsDaysLoading, setResultsDaysLoading,
    SLOT_ROLES, dayCountdown,
    lockedCardAddrs, setLockedCardAddrs,
    cancelFee, setCancelFee,
    fetchLineupsForEpoch, refreshTournament,
    onSubmitLineup, onCancelLineup,
    fetchOracleDays, heroScore, fetchMarketSnapshot,
    marketSnapshotCache, fetchLineupStats, lineupStatsCache,
  };
}
