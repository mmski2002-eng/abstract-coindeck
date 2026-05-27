import { dbQuery } from "@/lib/db/client";

export type MarketplaceListing = {
  listing_id: number;
  seller: string;
  card_addr: string;
  player_id: number;
  tier: number;
  price: number;
};

function normalizeMarketplaceListing(row: MarketplaceListing): MarketplaceListing {
  return {
    listing_id: Number(row.listing_id),
    seller: row.seller,
    card_addr: row.card_addr,
    player_id: Number(row.player_id),
    tier: Number(row.tier),
    price: Number(row.price),
  };
}

const SYNC_JOB_KEY = "marketplace-sync";
const SYNC_STALE_MS = 30_000;

export async function getMarketplaceListings(opts?: {
  player_id?: number;
  tier?: number;
  seller?: string;
}): Promise<MarketplaceListing[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  if (opts?.player_id !== undefined) { conditions.push(`player_id = $${p++}`); params.push(opts.player_id); }
  if (opts?.tier !== undefined)      { conditions.push(`tier = $${p++}`);      params.push(opts.tier); }
  if (opts?.seller)                  { conditions.push(`seller = $${p++}`);    params.push(opts.seller); }
  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const result = await dbQuery<MarketplaceListing>(
    `select listing_id, seller, card_addr, player_id, tier, price from marketplace_listings ${where} order by listing_id`,
    params,
  );
  return result.rows.map(normalizeMarketplaceListing);
}

export async function saveMarketplaceListings(listings: MarketplaceListing[]): Promise<void> {
  await dbQuery(`delete from marketplace_listings`, []);
  if (listings.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < listings.length; i += CHUNK) {
    const chunk = listings.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    const now = Date.now();
    for (const row of chunk) {
      placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      values.push(row.listing_id, row.seller, row.card_addr, row.player_id, row.tier, row.price, now);
    }
    await dbQuery(
      `insert into marketplace_listings (listing_id, seller, card_addr, player_id, tier, price, updated_at) values ${placeholders.join(", ")}`,
      values,
    );
  }
}

export async function getMarketplaceSyncState(): Promise<{ syncedAt: number | null; count: number }> {
  const result = await dbQuery<{ payload: { synced_at: number; count: number } }>(
    `select payload from job_state where job_key = $1 limit 1`,
    [SYNC_JOB_KEY],
  );
  const p = result.rows[0]?.payload;
  return { syncedAt: p?.synced_at ?? null, count: p?.count ?? 0 };
}

export async function saveMarketplaceSyncState(syncedAt: number, count: number): Promise<void> {
  await dbQuery(
    `insert into job_state (job_key, job_type, state, payload, updated_at)
     values ($1, 'marketplace-sync', 'done', $2::jsonb, now())
     on conflict (job_key)
     do update set state = 'done', payload = excluded.payload, updated_at = now()`,
    [SYNC_JOB_KEY, JSON.stringify({ synced_at: syncedAt, count })],
  );
}

export function isMarketplaceSyncStale(syncedAt: number | null): boolean {
  if (syncedAt === null) return true;
  return Date.now() - syncedAt > SYNC_STALE_MS;
}
