import { dbQuery } from "@/lib/db/client";

export type OracleHistory = Record<string, Record<string, number[]>>;

export async function readHistory(): Promise<OracleHistory> {
  const rows = await dbQuery<{ epoch: number; day: number; scores: number[] }>(
    "select epoch, day, scores from oracle_history order by epoch asc, day asc",
  );
  const history: OracleHistory = {};
  for (const row of rows.rows) {
    const epochKey = String(row.epoch);
    const dayKey = String(row.day);
    if (!history[epochKey]) history[epochKey] = {};
    history[epochKey][dayKey] = Array.isArray(row.scores) ? row.scores.map(Number) : [];
  }
  return history;
}

export async function saveDay(
  epoch: number,
  day: number,
  scores: number[],
  source = "chain",
  ledgerVersion?: string,
): Promise<void> {
  await dbQuery(
    `insert into oracle_history (epoch, day, scores, source, ledger_version, updated_at)
     values ($1, $2, $3::jsonb, $4, $5, now())
     on conflict (epoch, day)
     do update set scores = excluded.scores, source = excluded.source,
                   ledger_version = excluded.ledger_version, updated_at = now()`,
    [epoch, day, JSON.stringify(scores), source, ledgerVersion ?? null],
  );
}

export async function areAllOracleDaysFromChain(epoch: number, days: number[]): Promise<boolean> {
  if (days.length === 0) return true;
  const result = await dbQuery<{ count: string }>(
    `select count(*) as count from oracle_history
     where epoch = $1 and day = any($2::int[]) and source = 'chain'`,
    [epoch, days],
  );
  return Number(result.rows[0]?.count ?? 0) === days.length;
}

export async function readSyncMeta(): Promise<{ lastSyncAt: number }> {
  const result = await dbQuery<{ value: { lastSyncAt?: number } }>(
    "select value from sync_meta where key = 'oracle-sync-meta' limit 1",
  );
  const value = result.rows[0]?.value;
  return { lastSyncAt: Number(value?.lastSyncAt ?? 0) };
}

export async function writeSyncMeta(meta: { lastSyncAt: number }): Promise<void> {
  await dbQuery(
    `insert into sync_meta (key, value, updated_at)
     values ('oracle-sync-meta', $1::jsonb, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(meta)],
  );
}
