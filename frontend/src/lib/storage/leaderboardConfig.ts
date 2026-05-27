import { dbQuery } from "@/lib/db/client";

export const DEFAULT_TIER_MULTS = [100, 140, 190, 250];
export const DEFAULT_PRIZE_CONFIG = {
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

export type LeaderboardConfig = {
  tierMults: number[];
  roleBonusPct: number;
  prizeConfig: typeof DEFAULT_PRIZE_CONFIG;
};

function normalizePrizeConfig(raw: unknown): typeof DEFAULT_PRIZE_CONFIG {
  const src = typeof raw === "object" && raw !== null ? raw as Partial<Record<keyof typeof DEFAULT_PRIZE_CONFIG, unknown>> : {};
  const next = { ...DEFAULT_PRIZE_CONFIG };
  for (const key of Object.keys(next) as (keyof typeof DEFAULT_PRIZE_CONFIG)[]) {
    const value = Number(src[key]);
    if (Number.isFinite(value) && value >= 0 && value <= 10000) next[key] = value;
  }
  return next;
}

export function normalizeLeaderboardConfig(data: unknown): LeaderboardConfig {
  const source = typeof data === "object" && data !== null ? data as Partial<LeaderboardConfig> : {};
  return {
    tierMults: Array.isArray(source.tierMults) ? source.tierMults.map(Number) : DEFAULT_TIER_MULTS,
    roleBonusPct: Number.isFinite(source.roleBonusPct) ? Number(source.roleBonusPct) : 15,
    prizeConfig: normalizePrizeConfig(source.prizeConfig),
  };
}

export async function readLeaderboardConfig(): Promise<LeaderboardConfig> {
  const result = await dbQuery<{ value: LeaderboardConfig }>(
    "select value from app_config where namespace = 'leaderboard' and key = 'config' limit 1",
  );
  return normalizeLeaderboardConfig(result.rows[0]?.value ?? {});
}

export async function writeLeaderboardConfig(config: LeaderboardConfig): Promise<void> {
  await dbQuery(
    `insert into app_config (namespace, key, value, updated_at)
     values ('leaderboard', 'config', $1::jsonb, now())
     on conflict (namespace, key)
     do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(config)],
  );
}
