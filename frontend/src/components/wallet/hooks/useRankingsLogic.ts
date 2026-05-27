import { useRef, useState } from "react";
import type { TournamentStateData, RankRow } from "../types";

const LEADERBOARD_PAGE_LIMIT = 500;

interface Deps {
  tnState: TournamentStateData;
  roleBonusPct: number;
  epochRange: [number, number];
}

type LeaderboardResponse = {
  status: string;
  rows: RankRow[];
  total: number;
  offset: number;
  limit: number;
  updatedAt: number | null;
};

export function useRankingsLogic({ tnState, roleBonusPct, epochRange }: Deps) {
  const [lbRows, setLbRows] = useState<RankRow[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState("");
  const [lbDay, setLbDay] = useState<number | "total">("total");
  const [lbLeagueFilter, setLbLeagueFilter] = useState<number | null>(null);

  const activeRequestRef = useRef<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  async function fetchRankings(_day: number | "total", epoch: number) {
    const totalDays = tnState?.totalDays ?? 6;
    const rawDay = tnState?.currentDay ?? totalDays;
    const currentDay = rawDay < 1 ? totalDays : Math.min(rawDay, totalDays);
    const requestKey = `${epoch}:${totalDays}:${currentDay}:${roleBonusPct}`;

    if (activeRequestRef.current === requestKey) return;
    cancelRef.current?.();
    cancelRef.current = null;
    activeRequestRef.current = requestKey;

    setLbLoading(true);
    setLbError("");
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    cancelRef.current = () => {
      cancelled = true;
      if (pollId) { clearInterval(pollId); pollId = null; }
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      activeRequestRef.current = null;
    };

    try {
      const params = new URLSearchParams({
        epoch:        String(epoch),
        totalDays:    String(totalDays),
        currentDay:   String(currentDay),
        roleBonusPct: String(roleBonusPct),
      });

      async function fetchSnapshot(): Promise<LeaderboardResponse> {
        const firstParams = new URLSearchParams(params);
        firstParams.set("limit", String(LEADERBOARD_PAGE_LIMIT));
        firstParams.set("offset", "0");
        const firstRes = await fetch(`/api/leaderboard?${firstParams}`);
        if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
        const first = await firstRes.json() as LeaderboardResponse;
        const rows = [...first.rows];
        const total = Number.isFinite(first.total) ? first.total : rows.length;

        for (let offset = rows.length; offset < total && !cancelled; offset += LEADERBOARD_PAGE_LIMIT) {
          const pageParams = new URLSearchParams(params);
          pageParams.set("limit", String(LEADERBOARD_PAGE_LIMIT));
          pageParams.set("offset", String(offset));
          const pageRes = await fetch(`/api/leaderboard?${pageParams}`).catch(() => null);
          if (!pageRes || !pageRes.ok) break;
          const page = await pageRes.json() as LeaderboardResponse;
          if (page.rows.length === 0) break;
          rows.push(...page.rows);
        }

        return { ...first, rows, total };
      }

      const data = await fetchSnapshot();
      if (cancelled) return;
      if (!cancelled && data.rows.length > 0) {
        setLbRows(data.rows);
      }
      if (!cancelled && (data.status === "loading" || data.status === "refreshing")) {
        pollId = setInterval(async () => {
          if (cancelled) return;
          const d = await fetchSnapshot().catch(() => null);
          if (!d || cancelled) return;
          if (!cancelled && d.rows.length > 0) {
            setLbRows(d.rows);
          }
          if (d.status !== "loading" && d.status !== "refreshing") {
            cancelRef.current = null;
            activeRequestRef.current = null;
            if (pollId) { clearInterval(pollId); pollId = null; }
            if (!cancelled) setLbLoading(false);
          }
        }, 2000);
        timeoutId = setTimeout(() => {
          cancelRef.current = null;
          activeRequestRef.current = null;
          if (pollId) { clearInterval(pollId); pollId = null; }
          if (!cancelled) setLbLoading(false);
        }, 120_000); // 2 min timeout
        return;
      }
    } catch (e: unknown) {
      if (!cancelled) setLbError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!pollId && !cancelled) {
        cancelRef.current = null;
        activeRequestRef.current = null;
        setLbLoading(false);
      }
    }
  }

  async function forceRefreshRankings() {
    const epoch      = epochRange[1] ?? 1;
    void fetchRankings("total", epoch);
  }

  return {
    lbRows, setLbRows,
    lbLoading, setLbLoading,
    lbError, setLbError,
    lbDay, setLbDay,
    lbLeagueFilter, setLbLeagueFilter,
    fetchRankings, forceRefreshRankings,
  };
}
