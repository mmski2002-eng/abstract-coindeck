import { readMarketJobState, writeMarketJobState, tryAcquireMarketJob, type CoinResult, type JobStatus } from "@/lib/storage/marketData";
import { ASSET_CGK_IDS as CGK_IDS } from "@/config/assetUniverse";

export type { CoinResult, JobStatus };

const jobs = new Map<string, JobStatus>();

function cacheKey(dateKey: string, dayStartTs?: number | "today") {
  if (dayStartTs === "today" || dateKey === "today") return "today";
  if (typeof dayStartTs === "number") return `${dateKey}.${dayStartTs}-${dayStartTs + 86400}`;
  return dateKey;
}

const CGK_DELAY_MS = Number(process.env.CGK_DELAY_MS ?? "2200");
const CGK_FETCH_TIMEOUT_MS = Number(process.env.CGK_FETCH_TIMEOUT_MS ?? "15000");
const CGK_API_KEY = process.env.CGK_API_KEY ?? "";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function cgkHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (CGK_API_KEY) headers["x-cg-demo-api-key"] = CGK_API_KEY;
  return headers;
}

async function persistStatus(key: string, status: JobStatus) {
  jobs.set(key, status);
  await writeMarketJobState(key, status);
}

async function loadSeedData(key: string): Promise<CoinResult[]> {
  const existing = await readMarketJobState(key);
  return existing.state === "done" ? existing.data : [];
}

async function fetchTrendingIds(): Promise<Set<string>> {
  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      headers: cgkHeaders(),
      signal: AbortSignal.timeout(CGK_FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return new Set();
    const json = await resp.json() as { coins?: { item: { id: string } }[] };
    return new Set((json.coins ?? []).map((coin) => coin.item.id));
  } catch {
    return new Set();
  }
}

async function fetchCoinHistorical(id: string, from: number, to: number) {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: cgkHeaders(),
        signal: AbortSignal.timeout(CGK_FETCH_TIMEOUT_MS),
      });
      if (resp.status === 429) {
        await delay(70_000 * Math.pow(2, attempt));
        continue;
      }
      if (!resp.ok) return null;
      return await resp.json() as { prices: [number, number][]; total_volumes: [number, number][]; market_caps: [number, number][] };
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchCurrentAll(): Promise<CoinResult[]> {
  type CoinMarket = {
    id: string;
    total_volume?: number;
    market_cap?: number;
    price_change_percentage_24h?: number;
    high_24h?: number;
    low_24h?: number;
  };

  const [trendingIds, markets] = await Promise.all([
    fetchTrendingIds(),
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CGK_IDS.join(",")}&order=market_cap_desc&per_page=250&sparkline=false`, {
      headers: cgkHeaders(),
      signal: AbortSignal.timeout(CGK_FETCH_TIMEOUT_MS),
    })
      .then((resp) => resp.ok ? resp.json() as Promise<CoinMarket[]> : [] as CoinMarket[])
      .catch(() => [] as CoinMarket[]),
  ]);

  const marketMap = new Map<string, CoinMarket>(markets.map((item) => [item.id, item]));
  return CGK_IDS.flatMap((id, pid) => {
    const market = marketMap.get(id);
    if (!market) return [];
    const volume = market.total_volume ?? 0;
    const marketCap = market.market_cap ?? 0;
    return [{
      pid,
      priceChg: market.price_change_percentage_24h ?? 0,
      vol24h: volume,
      high24h: market.high_24h ?? 0,
      low24h: market.low_24h ?? 0,
      tempRatio: marketCap > 0 ? (volume / marketCap) * 100 : 0,
      hype: trendingIds.has(id),
    }];
  });
}

function parseCoinData(pid: number, data: { prices: [number, number][]; total_volumes: [number, number][]; market_caps: [number, number][] }): CoinResult | null {
  const prices = data.prices ?? [];
  const volumes = data.total_volumes ?? [];
  const mcaps = data.market_caps ?? [];
  if (prices.length === 0) return null;
  const open = prices[0][1];
  const close = prices[prices.length - 1][1];
  const high = Math.max(...prices.map((point) => point[1]));
  const low = Math.min(...prices.map((point) => point[1]));
  const priceChg = open > 0 ? ((close - open) / open) * 100 : 0;
  const vol24h = volumes.length > 0 ? volumes[volumes.length - 1][1] : 0;
  const marketCap = mcaps.length > 0 ? mcaps[mcaps.length - 1][1] : 0;
  return { pid, priceChg, vol24h, high24h: high, low24h: low, tempRatio: marketCap > 0 ? (vol24h / marketCap) * 100 : 0, hype: false };
}

async function runHistoricalJob(dateKey: string, dayStartTs: number, seedData: CoinResult[] = []) {
  const key = cacheKey(dateKey, dayStartTs);
  const dayEndTs = dayStartTs + 86400;
  const total = CGK_IDS.length;
  const startedAt = Date.now();
  const resultMap = new Map<number, CoinResult>(seedData.map((coin) => [coin.pid, coin]));
  const missingPids = CGK_IDS.map((_, pid) => pid).filter((pid) => !resultMap.has(pid));

  for (let i = 0; i < missingPids.length; i++) {
    const pid = missingPids[i];
    await persistStatus(key, { state: "running", progress: resultMap.size, total, startedAt });
    const data = await fetchCoinHistorical(CGK_IDS[pid], dayStartTs, dayEndTs);
    if (data) {
      const coin = parseCoinData(pid, data);
      if (coin) resultMap.set(pid, coin);
    }
    if (i < missingPids.length - 1) await delay(CGK_DELAY_MS);
  }

  // Retry missing coins once
  const missing = CGK_IDS.map((_, pid) => pid).filter(pid => !resultMap.has(pid));
  if (missing.length > 0) {
    await persistStatus(key, { state: "running", progress: resultMap.size, total, startedAt });
    for (let i = 0; i < missing.length; i++) {
      const pid = missing[i];
      await delay(CGK_DELAY_MS * 2);
      const data = await fetchCoinHistorical(CGK_IDS[pid], dayStartTs, dayEndTs);
      if (data) {
        const coin = parseCoinData(pid, data);
        if (coin) resultMap.set(pid, coin);
      }
      await persistStatus(key, { state: "running", progress: resultMap.size, total, startedAt });
    }
  }

  await persistStatus(key, {
    state: "done",
    data: Array.from(resultMap.values()).sort((a, b) => a.pid - b.pid),
    completedAt: Date.now(),
    fromTs: dayStartTs,
    toTs: dayEndTs,
  });
}

async function runCurrentJob(dateKey: string) {
  const key = cacheKey(dateKey, "today");
  const startedAt = Date.now();
  await persistStatus(key, { state: "running", progress: 0, total: 1, startedAt });
  const data = await fetchCurrentAll();
  await persistStatus(key, { state: "done", data, completedAt: Date.now() });
}

export async function getStatus(dateKey: string, dayStartTs?: number | "today"): Promise<JobStatus> {
  const key = cacheKey(dateKey, dayStartTs);
  const mem = jobs.get(key);
  if (mem) return mem;

  const stored = await readMarketJobState(key);
  jobs.set(key, stored);
  return stored;
}

export async function startJob(dateKey: string, dayStartTs: number | "today", force = false): Promise<boolean> {
  const key = cacheKey(dateKey, dayStartTs);
  const seedData = force && dayStartTs !== "today" ? await loadSeedData(key) : [];
  const acquired = await tryAcquireMarketJob(key, force);
  if (!acquired) return false;

  const runningStatus: JobStatus = { state: "running", progress: 0, total: 0, startedAt: Date.now() };
  jobs.set(key, runningStatus);

  if (dayStartTs === "today") {
    void runCurrentJob(dateKey).catch(async (error) => {
      await persistStatus(key, { state: "error", error: error instanceof Error ? error.message : String(error) });
    });
  } else {
    void (async () => {
      await runHistoricalJob(dateKey, dayStartTs, seedData);
    })().catch(async (error) => {
      await persistStatus(key, { state: "error", error: error instanceof Error ? error.message : String(error) });
    });
  }
  return true;
}
