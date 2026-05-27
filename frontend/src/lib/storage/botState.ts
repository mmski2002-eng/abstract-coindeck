import { dbQuery, withDbTransaction } from "@/lib/db/client";

export type BotMode = "manual" | "auto";
export type BotStage =
  | "idle"
  | "daily"
  | "leaderboard"
  | "claim-list"
  | "fund-claim"
  | "start-claim"
  | "done"
  | "error"
  | "stopped";

export type BotConfig = {
  mode: BotMode;
  enabled: boolean;
  claimDays: number;
  updatedAt: number;
};

export type BotState = {
  running: boolean;
  stopRequested: boolean;
  stage: BotStage;
  message: string;
  epoch: number | null;
  currentDay: number | null;
  completedDays: number[];
  lastRunAt: number | null;
  lastError: string | null;
  txHashes: Record<string, string>;
  ownerId: string | null;
  leaseUntil: number | null;
  pendingTimelock: null | {
    action: string;
    actionType: number;
    executeAfter: number;
    directLabel: string;
    payloadHash?: string;
  };
  lastClaimList: null | {
    totalOctas: number;
    entries: number;
    generatedAt: number;
  };
};

export function defaultBotConfig(): BotConfig {
  return { mode: "manual", enabled: false, claimDays: 6, updatedAt: Date.now() };
}

export function defaultBotState(): BotState {
  return {
    running: false,
    stopRequested: false,
    stage: "idle",
    message: "Bot is idle",
    epoch: null,
    currentDay: null,
    completedDays: [],
    lastRunAt: null,
    lastError: null,
    txHashes: {},
    ownerId: null,
    leaseUntil: null,
    pendingTimelock: null,
    lastClaimList: null,
  };
}

export async function readBotConfig(): Promise<BotConfig> {
  const result = await dbQuery<{ value: BotConfig }>("select value from bot_config where key = 'default' limit 1");
  return { ...defaultBotConfig(), ...(result.rows[0]?.value ?? {}) };
}

export async function writeBotConfig(config: BotConfig): Promise<void> {
  await dbQuery(
    `insert into bot_config (key, value, updated_at)
     values ('default', $1::jsonb, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(config)],
  );
}

export async function readBotState(): Promise<BotState> {
  const result = await dbQuery<{ value: BotState }>("select value from bot_state where key = 'default' limit 1");
  return { ...defaultBotState(), ...(result.rows[0]?.value ?? {}) };
}

export async function writeBotState(state: BotState): Promise<void> {
  await dbQuery(
    `insert into bot_state (key, value, updated_at)
     values ('default', $1::jsonb, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(state)],
  );
}

export async function acquireBotLease(ownerId: string, leaseUntil: number): Promise<boolean> {
  return withDbTransaction(async (client) => {
    await client.query(
      `insert into bot_state (key, value, updated_at)
       values ('default', $1::jsonb, now())
       on conflict (key) do nothing`,
      [JSON.stringify(defaultBotState())],
    );
    const result = await client.query<{ value: BotState }>(
      `select value from bot_state where key = 'default' for update`,
    );
    const state = { ...defaultBotState(), ...(result.rows[0]?.value ?? {}) };
    if (state.running && (state.leaseUntil ?? 0) > Date.now()) return false;
    const next: BotState = {
      ...state,
      running: true,
      ownerId,
      leaseUntil,
      lastRunAt: Date.now(),
      stopRequested: false,
      lastError: null,
    };
    await client.query(
      `update bot_state set value = $1::jsonb, updated_at = now() where key = 'default'`,
      [JSON.stringify(next)],
    );
    return true;
  });
}

export async function renewBotLease(ownerId: string, newLeaseUntil: number): Promise<void> {
  await dbQuery(
    `update bot_state
     set value = value || jsonb_build_object('leaseUntil', $2::bigint),
         updated_at = now()
     where key = 'default' and value->>'ownerId' = $1`,
    [ownerId, newLeaseUntil],
  );
}

export async function releaseBotLease(ownerId: string): Promise<void> {
  await dbQuery(
    `update bot_state
     set value = value || '{"running":false,"ownerId":null,"leaseUntil":null}'::jsonb,
         updated_at = now()
     where key = 'default' and value->>'ownerId' = $1`,
    [ownerId],
  );
}

export async function appendBotAudit(event: string, data: Record<string, unknown> = {}): Promise<void> {
  await dbQuery(
    "insert into audit_log (scope, payload) values ('bot', $1::jsonb)",
    [JSON.stringify({ event, ...data, ts: new Date().toISOString() })],
  );
}
