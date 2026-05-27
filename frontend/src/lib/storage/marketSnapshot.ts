import { dbQuery } from "@/lib/db/client";

export type CoinMarketData = {
  pid: number;
  priceChg: number;
  vol24h: number;
  high24h: number;
  low24h: number;
  tempRatio: number;
  hype: boolean;
};

export async function saveMarketSnapshot(epoch: number, day: number, data: CoinMarketData[]): Promise<void> {
  await dbQuery(
    `insert into market_snapshot (epoch, day, coin_data, saved_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (epoch, day)
     do update set coin_data = excluded.coin_data, saved_at = now()`,
    [epoch, day, JSON.stringify(data)],
  );
}

export async function readMarketSnapshot(epoch: number, day: number): Promise<CoinMarketData[] | null> {
  const result = await dbQuery<{ coin_data: CoinMarketData[] }>(
    "select coin_data from market_snapshot where epoch = $1 and day = $2 limit 1",
    [epoch, day],
  );
  const row = result.rows[0];
  if (!row) return null;
  const data = row.coin_data;
  return Array.isArray(data) ? data : null;
}
