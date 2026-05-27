import { getRuntimeProjectAddresses } from "@/config/projectAddresses";
import {
  saveMarketplaceListings,
  saveMarketplaceSyncState,
  type MarketplaceListing,
} from "@/lib/storage/marketplace";

const { restUrl, moduleAddress } = getRuntimeProjectAddresses();
const PAGE_SIZE = 200;
const MAX_LISTINGS = 10_000;

let syncing = false;

async function viewFn(fn: string, args: string[]): Promise<unknown[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(`${restUrl}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: `${moduleAddress}::${fn}`, type_arguments: [], arguments: args }),
      });
      if (resp.ok) {
        const json = await resp.json() as unknown;
        if (Array.isArray(json)) return json;
        if (json && typeof json === "object" && "value" in json && Array.isArray((json as { value: unknown }).value)) {
          return (json as { value: unknown[] }).value;
        }
        return null;
      }
      if (resp.status === 404) return null;
    } catch { /* retry */ }
    if (attempt < 2) await new Promise<void>((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
}

function parseU8Vec(raw: unknown): number[] {
  if (Array.isArray(raw)) return (raw as (string | number)[]).map(Number);
  if (typeof raw === "string") {
    const h = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (!h) return [];
    const out: number[] = [];
    for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
    return out;
  }
  return [];
}

export async function syncMarketplace(): Promise<{ count: number }> {
  if (syncing) return { count: 0 };
  syncing = true;
  try {
    const countRaw = await viewFn("marketplace::listing_count", []);
    const total = Number(countRaw?.[0] ?? 0);
    if (!Number.isFinite(total) || total < 0) return { count: 0 };

    const listings: MarketplaceListing[] = [];
    let offset = 0;

    while (offset < Math.min(total, MAX_LISTINGS)) {
      const page = await viewFn("marketplace::get_listings_page", [String(offset), String(PAGE_SIZE)]);
      if (!page) break;

      const [ids, sellers, , rawPids, rawTiers, prices] = page as [string[], string[], unknown, unknown, unknown, string[]];
      if (!Array.isArray(ids) || ids.length === 0) break;

      const pids = parseU8Vec(rawPids);
      const tiers = parseU8Vec(rawTiers);

      for (let i = 0; i < ids.length; i++) {
        listings.push({
          listing_id: Number(ids[i]),
          seller: (sellers)[i] ?? "",
          card_addr: "",
          player_id: Math.min(Math.max(pids[i] ?? 0, 0), 49),
          tier: Math.min(Math.max(tiers[i] ?? 0, 0), 3),
          price: Number((prices)[i] ?? 0),
        });
      }

      offset += PAGE_SIZE;
      if (ids.length < PAGE_SIZE) break;
    }

    await saveMarketplaceListings(listings);
    await saveMarketplaceSyncState(Date.now(), listings.length);
    return { count: listings.length };
  } finally {
    syncing = false;
  }
}
