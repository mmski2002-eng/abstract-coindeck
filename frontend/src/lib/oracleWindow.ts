const DAY_SECS = 86400;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatUtcDateKey(ts: number): string {
  const date = new Date(ts * 1000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseDateInputToUtcTs(input: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ts = Date.UTC(year, month - 1, day, 0, 0, 0) / 1000;
  return Number.isFinite(ts) ? ts : null;
}

function currentUtcDayStartTs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) / 1000;
}

export type OracleWindow = {
  dateKey: string;
  fromTs: number | "today";
  toTs?: number;
  day: number | null;
};

export function resolveOracleWindow(input: string, tournamentStartTs?: number | null): OracleWindow {
  const selectedUtcTs = parseDateInputToUtcTs(input) ?? currentUtcDayStartTs();
  const todayUtcTs = currentUtcDayStartTs();

  if (typeof tournamentStartTs === "number" && Number.isFinite(tournamentStartTs) && tournamentStartTs > 0) {
    const day = Math.max(1, Math.floor((selectedUtcTs - tournamentStartTs) / DAY_SECS) + 1);
    const fromTs = tournamentStartTs + (day - 1) * DAY_SECS;
    return {
      dateKey: formatUtcDateKey(fromTs),
      fromTs,
      toTs: fromTs + DAY_SECS,
      day,
    };
  }

  if (selectedUtcTs === todayUtcTs) {
    return { dateKey: "today", fromTs: "today", day: null };
  }

  return {
    dateKey: formatUtcDateKey(selectedUtcTs),
    fromTs: selectedUtcTs,
    toTs: selectedUtcTs + DAY_SECS,
    day: null,
  };
}

export function buildMarketDataQuery(window: OracleWindow): string {
  const params = new URLSearchParams({ date: window.dateKey });
  if (typeof window.fromTs === "number") params.set("fromTs", String(window.fromTs));
  return params.toString();
}
