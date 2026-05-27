import { getRuntimeProjectAddresses } from "@/config/projectAddresses";
import { createPublicClient, http } from "viem";
import { abstractTestnet } from "viem/chains";
import { MARKETPLACE_ABI } from "@/lib/evmContracts";
import {
  saveMarketplaceListings,
  saveMarketplaceSyncState,
  type MarketplaceListing,
} from "@/lib/storage/marketplace";

const { restUrl, marketplace } = getRuntimeProjectAddresses();
const PAGE_SIZE = 200;
const MAX_LISTINGS = 10_000;
const client = createPublicClient({
  chain: abstractTestnet,
  transport: http(restUrl),
});

let syncing = false;

export async function syncMarketplace(): Promise<{ count: number }> {
  if (syncing) return { count: 0 };
  syncing = true;
  try {
    const total = Number(await client.readContract({
      address: marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "listingCount",
    }));
    if (!Number.isFinite(total) || total < 0) return { count: 0 };

    const listings: MarketplaceListing[] = [];
    let offset = 0;

    while (offset < Math.min(total, MAX_LISTINGS)) {
      const [ids, sellers, cardIds, pids, tiers, prices] = await client.readContract({
        address: marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: "getListingsPage",
        args: [BigInt(offset), BigInt(PAGE_SIZE)],
      });
      if (ids.length === 0) break;

      for (let i = 0; i < ids.length; i++) {
        listings.push({
          listing_id: Number(ids[i]),
          seller: sellers[i] ?? "",
          card_addr: String(cardIds[i] ?? ""),
          player_id: Math.min(Math.max(pids[i] ?? 0, 0), 49),
          tier: Math.min(Math.max(tiers[i] ?? 0, 0), 3),
          price: Number(prices[i] ?? 0n),
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
