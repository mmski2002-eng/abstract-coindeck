import { dbQuery, withDbTransaction } from "@/lib/db/client";

export type CoinResult = {
  pid: number;
  priceChg: number;
  vol24h: number;
  high24h: number;
  low24h: number;
  tempRatio: number;
  hype: boolean;
};

export type JobStatus =
  | { state: "idle" }
  | { state: "running"; progress: number; total: number; startedAt: number }
  | { state: "done"; data: CoinResult[]; completedAt: number; fromTs?: number; toTs?: number }
  | { state: "error"; error: string };

export async function readMarketJobState(key: string): Promise<JobStatus> {
  const result = await dbQuery<{ state: string; payload: JobStatus }>(
    "select state, payload from job_state where job_key = $1 and job_type = 'market-data' limit 1",
    [key],
  );
  return result.rows[0]?.payload ?? { state: "idle" };
}

export async function writeMarketJobState(key: string, status: JobStatus): Promise<void> {
  await dbQuery(
    `insert into job_state (job_key, job_type, state, payload, updated_at)
     values ($1, 'market-data', $2, $3::jsonb, now())
     on conflict (job_key)
     do update set state = excluded.state, payload = excluded.payload, updated_at = now()`,
    [key, status.state, JSON.stringify(status)],
  );
}

const MARKET_JOB_STALE_MS = Number(process.env.MARKET_JOB_STALE_MS ?? String(30 * 60 * 1000));

export async function tryAcquireMarketJob(key: string, force = false): Promise<boolean> {
  return withDbTransaction(async (client) => {
    await client.query(
      `insert into job_state (job_key, job_type, state, payload, updated_at)
       values ($1, 'market-data', 'idle', '{"state":"idle"}'::jsonb, now())
       on conflict (job_key) do nothing`,
      [key],
    );
    const result = await client.query<{ state: string; payload: { startedAt?: number } }>(
      `select state, payload from job_state where job_key = $1 and job_type = 'market-data' for update`,
      [key],
    );
    const row = result.rows[0];
    const state = row?.state;
    const startedAt = row?.payload?.startedAt ?? 0;
    const isStale = state === "running" && startedAt < Date.now() - MARKET_JOB_STALE_MS;
    if (!force && ((state === "running" && !isStale) || state === "done")) return false;
    const initial: JobStatus = { state: "running", progress: 0, total: 0, startedAt: Date.now() };
    await client.query(
      `update job_state set state = 'running', payload = $2::jsonb, updated_at = now()
       where job_key = $1 and job_type = 'market-data'`,
      [key, JSON.stringify(initial)],
    );
    return true;
  });
}
