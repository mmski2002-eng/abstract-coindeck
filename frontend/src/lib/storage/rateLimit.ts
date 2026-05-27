import { dbQuery } from "@/lib/db/client";

export async function consumeRateLimit(bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const result = await dbQuery<{ count: number }>(
    `insert into rate_limit_counters (bucket, window_start, count)
     values ($1, $2, 1)
     on conflict (bucket, window_start)
     do update set count = rate_limit_counters.count + 1
     returning count`,
    [bucket, windowStart],
  );
  return (result.rows[0]?.count ?? 1) <= limit;
}

export async function cleanupRateLimitCounters(): Promise<void> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await dbQuery("delete from rate_limit_counters where window_start < $1", [cutoff]);
}
