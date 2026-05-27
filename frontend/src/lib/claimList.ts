import { createHash } from "crypto";
import { getCached, runJob as runLeaderboardJob } from "@/app/api/leaderboard/worker";
import { areAllLineupsComplete } from "@/lib/storage/leaderboard";
import { areAllOracleDaysFromChain } from "@/lib/storage/oracleHistory";
import { readLeaderboardConfig } from "@/lib/storage/leaderboardConfig";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

const runtimeAddresses = getRuntimeProjectAddresses();
const MODULE = runtimeAddresses.moduleAddress;
const REST_URL = runtimeAddresses.restUrl;
const CLAIM_VAULT_ADDRESS = runtimeAddresses.claimVaultAddress;
const TOTAL_DAYS = 6;
const OCTAS = 100_000_000;

type PrizeConfig = {
  goldPct: number;
  silverPct: number;
  bronzePct: number;
  pos1: number;
  pos2: number;
  pos3: number;
  pos4_9: number;
  pos10_19: number;
  pos20_49: number;
  pos50_99: number;
};

export type ClaimLeaderboardRow = {
  addr: string;
  score: number;
  league: number;
  days: number;
};

export type ClaimListBuildResult = {
  epoch: number;
  poolOctas: number;
  totalOctas: number;
  updatedAt: number;
  rows: ClaimLeaderboardRow[];
  addrs: string[];
  amounts: string[];
  claimListText: string;
  claimListHash: string;
};

const DEFAULT_PRIZE_CONFIG: PrizeConfig = {
  goldPct: 40,
  silverPct: 35,
  bronzePct: 25,
  pos1: 20,
  pos2: 12,
  pos3: 8,
  pos4_9: 2,
  pos10_19: 1.5,
  pos20_49: 0.8,
  pos50_99: 0.18,
};

async function view<T>(fn: string, args: unknown[] = []): Promise<T | null> {
  try {
    const resp = await fetch(`${REST_URL}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: `${MODULE}::${fn}`, type_arguments: [], arguments: args }),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as unknown;
    if (data && typeof data === "object" && "value" in data) return (data as { value: T }).value;
    return data as T;
  } catch {
    return null;
  }
}

async function coinBalance(address: string): Promise<number> {
  const type = encodeURIComponent("0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
  const resp = await fetch(`${REST_URL}/accounts/${address}/resource/${type}`);
  if (resp.status === 404) return 0;
  if (!resp.ok) return 0;
  const json = await resp.json() as { data?: { coin?: { value?: string } } };
  return Number(json.data?.coin?.value ?? 0);
}

async function prizePoolOctas(): Promise<number> {
  const state = await view<unknown[]>("tournament::get_state");
  return Number(state?.[5] ?? 0);
}

async function getLeaderboardConfig(): Promise<{ roleBonusPct: number; prizeConfig: PrizeConfig }> {
  const parsed = await readLeaderboardConfig();
  return {
    roleBonusPct: Number.isFinite(parsed.roleBonusPct) ? Number(parsed.roleBonusPct) : 15,
    prizeConfig: { ...DEFAULT_PRIZE_CONFIG, ...(parsed.prizeConfig ?? {}) },
  };
}

function positionPct(rank: number, prizeConfig: PrizeConfig): number {
  if (rank === 0) return prizeConfig.pos1;
  if (rank === 1) return prizeConfig.pos2;
  if (rank === 2) return prizeConfig.pos3;
  if (rank <= 8) return prizeConfig.pos4_9;
  if (rank <= 18) return prizeConfig.pos10_19;
  if (rank <= 48) return prizeConfig.pos20_49;
  if (rank <= 98) return prizeConfig.pos50_99;
  return 0;
}

function normalizeAddress(addr: string): string {
  return "0x" + (addr.startsWith("0x") ? addr.slice(2) : addr).padStart(64, "0");
}

function formatMoveAmount(octas: number): string {
  return (octas / OCTAS).toFixed(8);
}

export async function getCurrentTournamentProgress(): Promise<{ epoch: number; closedDay: number } | null> {
  const state = await view<unknown[]>("tournament::get_state");
  if (!state) return null;
  const epoch = Number(state[1] ?? 0);
  const currentDay = Number(state[2] ?? 0);
  const isRest = state[3] === true || state[3] === "true";
  if (!Number.isInteger(epoch) || epoch < 1) return null;
  return {
    epoch,
    closedDay: isRest ? TOTAL_DAYS : Math.max(0, Math.min(TOTAL_DAYS, currentDay - 1)),
  };
}

export async function buildClaimListForEpoch(epoch: number): Promise<ClaimListBuildResult> {
  const { roleBonusPct, prizeConfig } = await getLeaderboardConfig();
  await runLeaderboardJob(epoch, TOTAL_DAYS, TOTAL_DAYS, roleBonusPct);
  const cache = await getCached(epoch, TOTAL_DAYS, TOTAL_DAYS, roleBonusPct);
  if (!cache || cache.rows.length === 0) {
    throw new Error("leaderboard cache is empty after recalculation");
  }
  if (!cache.allOracleFinalized) {
    throw new Error(`leaderboard cache has unfinalized oracle days — claim list generation blocked (epoch ${epoch})`);
  }
  const scoreDays = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);
  const allFromChain = await areAllOracleDaysFromChain(epoch, scoreDays);
  if (!allFromChain) {
    throw new Error(`oracle history for epoch ${epoch} has days without chain verification — claim blocked`);
  }
  const lineupsComplete = await areAllLineupsComplete(epoch, TOTAL_DAYS);
  if (!lineupsComplete) {
    throw new Error(`lineup snapshots incomplete for epoch ${epoch} — not all ${TOTAL_DAYS} days have complete=true`);
  }

  const rows = cache.rows as ClaimLeaderboardRow[];
  const poolOctas = Math.max(await coinBalance(CLAIM_VAULT_ADDRESS), await prizePoolOctas());
  const pools = {
    2: poolOctas * prizeConfig.goldPct / 100,
    1: poolOctas * prizeConfig.silverPct / 100,
    0: poolOctas * prizeConfig.bronzePct / 100,
  };

  const addrs: string[] = [];
  const amounts: string[] = [];
  const lines: string[] = [];
  const leagueNames = ["Bronze", "Silver", "Gold"];

  for (const league of [2, 1, 0] as const) {
    const leagueRows = rows.filter((row) => row.league === league).sort((a, b) => b.score - a.score);
    if (leagueRows.length > 0) {
      lines.push(`# ${leagueNames[league]} (pool: ${formatMoveAmount(Math.floor(pools[league]))} MOVE)`);
    }
    leagueRows.forEach((row, rank) => {
      const amount = Math.floor((pools[league] * positionPct(rank, prizeConfig)) / 100);
      const normalized = normalizeAddress(row.addr);
      if (amount > 0 && /^0x[0-9a-fA-F]+$/.test(row.addr) && !addrs.includes(normalized)) {
        addrs.push(normalized);
        amounts.push(String(amount));
        lines.push(`${normalized} ${formatMoveAmount(amount)}`);
      }
    });
  }

  const totalOctas = amounts.reduce((sum, value) => sum + Number(value), 0);
  if (addrs.length === 0 || totalOctas <= 0) throw new Error("claim list is empty");
  if (totalOctas > poolOctas) throw new Error(`claim list exceeds pool: ${totalOctas} > ${poolOctas}`);

  lines.unshift(`# Total pool: ${formatMoveAmount(poolOctas)} MOVE | Total distributed: ${formatMoveAmount(totalOctas)} MOVE`);

  const claimListHash = createHash("sha256")
    .update(addrs.join(",") + "|" + amounts.join(","))
    .digest("hex");

  return {
    epoch,
    poolOctas,
    totalOctas,
    updatedAt: cache.updatedAt,
    rows,
    addrs,
    amounts,
    claimListText: lines.join("\n"),
    claimListHash,
  };
}
