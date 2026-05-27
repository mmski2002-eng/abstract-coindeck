import { dbQuery, isDatabaseEnabled } from "@/lib/db/client";

const TOTAL_DAYS = 6;
const HYPE_TOP_N = 15;

async function fetchPickCounts(epoch: number, day: number): Promise<number[]> {
  const result = await dbQuery<{ pid: number; picks: number }>(
    `select pid_val::integer as pid, count(*)::integer as picks
     from leaderboard_day_lineups,
       jsonb_each(entries) as e(wallet, entry),
       jsonb_array_elements_text(entry->'pids') as pid_val
     where epoch = $1 and day = $2
     group by pid_val`,
    [epoch, day],
  );
  const counts = new Array(50).fill(0) as number[];
  for (const row of result.rows) {
    if (row.pid >= 0 && row.pid < 50) counts[row.pid] = row.picks;
  }
  return counts;
}

export async function getTopPickPids(epoch: number, day: number): Promise<Set<number>> {
  if (!isDatabaseEnabled()) return new Set();
  let queryEpoch = epoch;
  let queryDay = day - 1;
  if (queryDay < 1) {
    if (epoch <= 1) return new Set();
    queryEpoch = epoch - 1;
    queryDay = TOTAL_DAYS;
  }
  try {
    const counts = await fetchPickCounts(queryEpoch, queryDay);
    const sorted = [...counts].sort((a, b) => b - a);
    const threshold = sorted[HYPE_TOP_N - 1] ?? 0;
    if (threshold === 0) return new Set();
    const topPids = new Set<number>();
    counts.forEach((picks, pid) => { if (picks >= threshold) topPids.add(pid); });
    return topPids;
  } catch {
    return new Set();
  }
}
