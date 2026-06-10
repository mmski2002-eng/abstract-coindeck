import { createHash } from "crypto";
import { createPublicClient, http } from "viem";
import { abstractTestnet } from "viem/chains";
import { getCached, runJob as runLeaderboardJob } from "@/app/api/leaderboard/worker";
import { areAllLineupsComplete } from "@/lib/storage/leaderboard";
import { areAllOracleDaysFromChain } from "@/lib/storage/oracleHistory";
import { readLeaderboardConfig } from "@/lib/storage/leaderboardConfig";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";
import { TOURNAMENT_VIEW_ABI, CLAIM_ABI } from "@/lib/evmContracts";

const runtimeAddresses = getRuntimeProjectAddresses();
const TOTAL_DAYS = 6;
const WEI = 10n ** 18n;

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
  poolWei: string;
  totalWei: string;
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

function createEvmClient() {
  return createPublicClient({
    chain: abstractTestnet,
    transport: http(runtimeAddresses.restUrl),
  });
}

async function getPrizePoolWei(): Promise<bigint> {
  try {
    const client = createEvmClient();
    const state = await client.readContract({
      address: runtimeAddresses.tournament as `0x${string}`,
      abi: TOURNAMENT_VIEW_ABI,
      functionName: "getState",
    });
    return BigInt(state[5]);
  } catch {
    return 0n;
  }
}

async function getVaultBalanceWei(): Promise<bigint> {
  try {
    const client = createEvmClient();
    const result = await client.readContract({
      address: runtimeAddresses.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "getClaimState",
    });
    return BigInt(result[3]);
  } catch {
    return 0n;
  }
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
  return addr.toLowerCase();
}

function formatEthAmount(wei: bigint): string {
  const whole = wei / WEI;
  const frac = wei % WEI;
  return `${whole}.${frac.toString().padStart(18, "0").replace(/0+$/, "") || "0"}`;
}

export async function getCurrentTournamentProgress(): Promise<{ epoch: number; closedDay: number } | null> {
  try {
    const client = createEvmClient();
    const state = await client.readContract({
      address: runtimeAddresses.tournament as `0x${string}`,
      abi: TOURNAMENT_VIEW_ABI,
      functionName: "getState",
    });
    const epoch = Number(state[1]);
    const currentDay = Number(state[2]);
    const isRest = state[3];
    if (!Number.isInteger(epoch) || epoch < 1) return null;
    return {
      epoch,
      closedDay: isRest ? TOTAL_DAYS : Math.max(0, Math.min(TOTAL_DAYS, currentDay - 1)),
    };
  } catch {
    return null;
  }
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
  const prizePool = await getPrizePoolWei();
  const vaultBalance = await getVaultBalanceWei();
  const poolWei = prizePool > vaultBalance ? prizePool : vaultBalance;
  const pools = {
    2: poolWei * BigInt(prizeConfig.goldPct) / 100n,
    1: poolWei * BigInt(prizeConfig.silverPct) / 100n,
    0: poolWei * BigInt(prizeConfig.bronzePct) / 100n,
  };

  const addrs: string[] = [];
  const amounts: string[] = [];
  const lines: string[] = [];
  const leagueNames = ["Bronze", "Silver", "Gold"];

  for (const league of [2, 1, 0] as const) {
    const leagueRows = rows.filter((row) => row.league === league).sort((a, b) => b.score - a.score);
    if (leagueRows.length > 0) {
      lines.push(`# ${leagueNames[league]} (pool: ${formatEthAmount(pools[league])} ETH)`);
    }
    leagueRows.forEach((row, rank) => {
      const amount = pools[league] * BigInt(Math.floor(positionPct(rank, prizeConfig) * 100)) / 10000n;
      const normalized = normalizeAddress(row.addr);
      if (amount > 0n && /^0x[0-9a-fA-F]{40}$/.test(row.addr) && !addrs.includes(normalized)) {
        addrs.push(normalized);
        amounts.push(String(amount));
        lines.push(`${normalized} ${formatEthAmount(amount)}`);
      }
    });
  }

  const totalWei = amounts.reduce((sum, value) => sum + BigInt(value), 0n);
  if (addrs.length === 0 || totalWei <= 0n) throw new Error("claim list is empty");
  if (totalWei > poolWei) throw new Error(`claim list exceeds pool: ${totalWei} > ${poolWei}`);

  lines.unshift(`# Total pool: ${formatEthAmount(poolWei)} ETH | Total distributed: ${formatEthAmount(totalWei)} ETH`);

  const claimListHash = createHash("sha256")
    .update(addrs.join(",") + "|" + amounts.join(","))
    .digest("hex");

  return {
    epoch,
    poolWei: String(poolWei),
    totalWei: String(totalWei),
    updatedAt: cache.updatedAt,
    rows,
    addrs,
    amounts,
    claimListText: lines.join("\n"),
    claimListHash,
  };
}
