import fs from "fs";
import { randomUUID } from "crypto";
// TODO: migrate to EVM — Aptos SDK removed, these stubs throw at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Account: any = { fromPrivateKey: () => { throw new Error("Aptos not supported"); } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Aptos: any = class { constructor() { throw new Error("Aptos not supported"); } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AptosConfig: any = class { constructor() { throw new Error("Aptos not supported"); } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ed25519PrivateKey: any = class { constructor() { throw new Error("Aptos not supported"); } };
const Network = { CUSTOM: "custom" } as const;
import { getStatus as getMarketStatus, startJob as startMarketJob, type CoinResult } from "../market-data/worker";
import { saveDay } from "../oracle-history/lib";
import {
  acquireBotLease,
  renewBotLease,
  releaseBotLease,
  appendBotAudit,
  defaultBotConfig,
  defaultBotState,
  readBotConfig,
  readBotState,
  writeBotConfig,
  writeBotState,
  type BotConfig,
  type BotMode,
  type BotState,
  type BotStage,
} from "@/lib/storage/botState";
import { calcOraclePoints } from "@/lib/oracleScoring";
import { formatUtcDateKey } from "@/lib/oracleWindow";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";
import { buildClaimListForEpoch } from "@/lib/claimList";
import { getTopPickPids } from "@/lib/storage/lineupStats";

const runtimeAddresses = getRuntimeProjectAddresses();
const MODULE = runtimeAddresses.moduleAddress;
const REST_URL = runtimeAddresses.restUrl;
const PRIZE_RETURN_ADDRESS = runtimeAddresses.prizeVaultAddress;
const TOTAL_DAYS = 6;
const OCTAS = 100_000_000;
const ORACLE_POST_BUFFER_SECS = Number(process.env.BOT_ORACLE_POST_BUFFER_SECS ?? "3600");
const MARKET_DATA_WAIT_TIMEOUT_MS = Number(process.env.BOT_MARKET_DATA_WAIT_TIMEOUT_MS ?? "1800000");
const MARKET_DATA_EXPECTED_COINS = 50;
const MARKET_DATA_REPAIR_ATTEMPTS = Number(process.env.BOT_MARKET_DATA_REPAIR_ATTEMPTS ?? "3");
const LEASE_DURATION_MS = Number(process.env.BOT_STALE_TIMEOUT_MS ?? String(60 * 60 * 1000));
const HEARTBEAT_INTERVAL_MS = 30_000;

let runPromise: Promise<void> | null = null;

export { defaultBotConfig as defaultConfig, defaultBotState as defaultState };
export type { BotMode, BotStage, BotConfig, BotState };

async function audit(event: string, data: Record<string, unknown> = {}) {
  await appendBotAudit(event, data);
}

export async function readConfig(): Promise<BotConfig> {
  return readBotConfig();
}

export async function writeConfig(patch: Partial<BotConfig>): Promise<BotConfig> {
  const next = { ...(await readConfig()), ...patch, updatedAt: Date.now() };
  await writeBotConfig(next);
  await audit("config-updated", { mode: next.mode, enabled: next.enabled });
  return next;
}

export async function readState(): Promise<BotState> {
  return readBotState();
}

async function writeState(patch: Partial<BotState>): Promise<BotState> {
  const next = { ...(await readState()), ...patch };
  await writeBotState(next);
  return next;
}

export async function requestStop() {
  await writeState({ stopRequested: true, message: "Stop requested" });
}

export async function resetError() {
  await writeState({ lastError: null, stage: "idle", message: "Error reset", stopRequested: false });
}

export async function recoverStaleRun(): Promise<void> {
  await writeState({ running: false, stage: "idle", message: "Auto-recovered from crash", lastError: "Process died unexpectedly (auto-recovered)", stopRequested: false, ownerId: null, leaseUntil: null });
  await audit("stale-recovery", {});
}

export function botWalletStatus() {
  const raw = readBotPrivateKey();
  if (!raw) return { configured: false, address: null as string | null };
  try {
    return { configured: true, address: botAccount().accountAddress.toString() };
  } catch {
    return { configured: false, address: null as string | null };
  }
}

function readBotPrivateKey(): string {
  const file = process.env.BOT_PRIVATE_KEY_FILE;
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  return (process.env.BOT_PRIVATE_KEY ?? "").trim();
}

function botAccount() {
  const raw = readBotPrivateKey();
  if (!raw) throw new Error("BOT_PRIVATE_KEY or BOT_PRIVATE_KEY_FILE is not configured");
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(raw), legacy: true });
}

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: REST_URL }));

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

async function tx(label: string, fn: string, args: unknown[]) {
  const account = botAccount();
  const functionId = `${MODULE}::${fn}` as `${string}::${string}::${string}`;
  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: functionId, typeArguments: [], functionArguments: args as never[] },
  });
  const auth = aptos.transaction.sign({ signer: account, transaction: txn });
  const submitted = await aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: auth });
  await aptos.waitForTransaction({ transactionHash: submitted.hash, options: { timeoutSecs: 60 } });
  const state = await readState();
  await writeState({ txHashes: { ...state.txHashes, [label]: submitted.hash } });
  await audit("tx", { label, hash: submitted.hash });
  return submitted.hash;
}

async function waitMarketData(dateKey: string, dayStartTs?: number): Promise<CoinResult[]> {
  const parsedDate = dayStartTs ?? (dateKey === "today" ? "today" : Math.floor(new Date(`${dateKey}T00:00:00Z`).getTime() / 1000));
  await startMarketJob(dateKey, parsedDate);
  const startedAt = Date.now();
  let repairAttempts = 0;
  while (Date.now() - startedAt < MARKET_DATA_WAIT_TIMEOUT_MS) {
    const status = await getMarketStatus(dateKey, parsedDate);
    if (status.state === "done") {
      if (status.data.length >= MARKET_DATA_EXPECTED_COINS) return status.data;
      if (repairAttempts < MARKET_DATA_REPAIR_ATTEMPTS) {
        repairAttempts += 1;
        await writeState({
          stage: "daily",
          message: `Market data incomplete (${status.data.length}/${MARKET_DATA_EXPECTED_COINS}) for ${dateKey}. Retrying missing coins (${repairAttempts}/${MARKET_DATA_REPAIR_ATTEMPTS})`,
        });
        await startMarketJob(dateKey, parsedDate, true);
      } else {
        throw new Error(`market-data returned ${status.data.length}/${MARKET_DATA_EXPECTED_COINS} entries for ${dateKey} after ${repairAttempts} repair attempts`);
      }
    }
    if (status.state === "error") throw new Error(status.error);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`market-data timeout for ${dateKey}`);
}

function parseHashHex(raw: unknown): string {
  if (typeof raw === "string") return raw.startsWith("0x") ? raw.slice(2) : raw;
  if (Array.isArray(raw)) return Buffer.from(raw as number[]).toString("hex");
  return "";
}

async function getOnChainPendingActions(): Promise<Array<{ actionType: number; executeAfter: number; payloadHash: string }>> {
  const result = await view<unknown[]>("admin_control::get_pending_actions");
  if (!result || !Array.isArray(result[0])) return [];
  const actionTypes = (result[0] as (string | number)[]).map(Number);
  const executeAfters = (result[1] as (string | number)[]).map(Number);
  const hashes = Array.isArray(result[2]) ? (result[2] as unknown[]) : [];
  return actionTypes.map((actionType, i) => ({
    actionType,
    executeAfter: executeAfters[i] ?? 0,
    payloadHash: parseHashHex(hashes[i]),
  }));
}

async function saveOracleHistory(epoch: number, day: number, scores: number[]) {
  try {
    await saveDay(epoch, day, scores, "chain");
  } catch (e) {
    await audit("oracle-history-save-failed", { epoch, day, error: e instanceof Error ? e.message : String(e) });
  }
}

async function isOraclePostedOnChain(day: number): Promise<boolean> {
  const result = await view<unknown[]>("oracle::is_day_posted", [String(day)]);
  return result?.[0] === true;
}

async function postDay(day: number, epoch: number, epochStartTs: number) {
  const dayStartSec = epochStartTs + (day - 1) * 86400;
  const dateKey = formatUtcDateKey(dayStartSec);
  await writeState({ stage: "daily", message: `Fetching market data for day ${day} (${dateKey})` });
  const data = await waitMarketData(dateKey, dayStartSec);
  if (data.length < MARKET_DATA_EXPECTED_COINS) {
    throw new Error(`market-data returned ${data.length}/${MARKET_DATA_EXPECTED_COINS} entries for day ${day}`);
  }
  const topPids = await getTopPickPids(epoch, day);
  const sorted = data.slice().sort((a, b) => a.pid - b.pid).map(item => ({ ...item, hype: topPids.has(item.pid) }));
  const pids = sorted.map((item) => item.pid);
  const points = sorted.map(calcOraclePoints);
  await tx(`oracle-post-day-${day}`, "oracle::post_day_scores", [String(day), pids, points]);
  const scores = new Array(50).fill(0) as number[];
  sorted.forEach((item, i) => { scores[item.pid] = points[i]; });
  await saveOracleHistory(epoch, day, scores);
  const current = await readState();
  await writeState({ completedDays: Array.from(new Set([...current.completedDays, day])).sort((a, b) => a - b), message: `Posted oracle scores for day ${day}` });
}

async function coinBalance(address: string): Promise<number> {
  const type = encodeURIComponent("0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
  const resp = await fetch(`${REST_URL}/accounts/${address}/resource/${type}`);
  if (resp.status === 404) return 0;
  if (!resp.ok) return 0;
  const json = await resp.json() as { data?: { coin?: { value?: string } } };
  return Number(json.data?.coin?.value ?? 0);
}

async function buildClaimList(epoch: number) {
  await writeState({ stage: "leaderboard", message: "Recalculating leaderboard" });
  const result = await buildClaimListForEpoch(epoch);
  await audit("claim-list-generated", {
    epoch,
    entries: result.addrs.length,
    totalOctas: result.totalOctas,
    claimListHash: result.claimListHash,
    cacheUpdatedAt: result.updatedAt,
  });
  await writeState({
    stage: "claim-list",
    message: `Generated claim list: ${result.addrs.length} entries (hash: ${result.claimListHash.slice(0, 12)}...)`,
    lastClaimList: { totalOctas: result.totalOctas, entries: result.addrs.length, generatedAt: Date.now() },
  });
  return { addrs: result.addrs, amounts: result.amounts, totalOctas: result.totalOctas };
}

async function actionDelay(actionType: number): Promise<number> {
  const result = await view<unknown[]>("admin_control::get_action_delay", [String(actionType)]);
  return Number(Array.isArray(result) ? result[0] : result ?? 0);
}

async function runTimelocked(actionType: number, queueLabel: string, queueFn: string, directLabel: string, directFn: string, args: unknown[]) {
  const delay = await actionDelay(actionType);
  const pending = (await readState()).pendingTimelock;
  const nowSecs = Math.floor(Date.now() / 1000);

  if (delay > 0 && (!pending || pending.directLabel !== directLabel)) {
    const onChainPending = await getOnChainPendingActions();
    const alreadyQueued = onChainPending.find((p) => p.actionType === actionType && p.executeAfter > nowSecs);
    if (!alreadyQueued) {
      await tx(queueLabel, queueFn, args);
    }
    // Re-read to get definitive payloadHash (pre-existing or freshly queued)
    const freshPending = alreadyQueued ? onChainPending : await getOnChainPendingActions();
    const queued = freshPending.find((p) => p.actionType === actionType && p.executeAfter > nowSecs);
    const executeAfter = queued?.executeAfter ?? nowSecs + delay;
    await writeState({
      pendingTimelock: { action: queueLabel, actionType, executeAfter, directLabel, payloadHash: queued?.payloadHash },
      message: `${queueLabel} queued until ${new Date(executeAfter * 1000).toISOString()}`,
    });
    throw new Error(`timelock-wait:${queueLabel}`);
  }
  if (pending?.directLabel === directLabel && nowSecs < pending.executeAfter) {
    throw new Error(`timelock-wait:${pending.action}`);
  }
  if (delay > 0) {
    const onChainPending = await getOnChainPendingActions();
    const isReady = onChainPending.some(
      (p) => p.actionType === actionType
        && p.executeAfter <= nowSecs
        && (!pending?.payloadHash || p.payloadHash === pending.payloadHash),
    );
    if (!isReady) {
      await writeState({ pendingTimelock: null });
      throw new Error(`timelock-verify-failed: ${directLabel} not found in on-chain pending actions`);
    }
  }
  await tx(directLabel, directFn, args);
  if (pending?.directLabel === directLabel) await writeState({ pendingTimelock: null });
}

async function finalizeClaim(epoch: number) {
  const claimState = await view<unknown[]>("claim::get_claim_state");
  if (Boolean(claimState?.[0])) {
    const deadline = Number(claimState?.[2] ?? 0);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (deadline > 0 && nowSeconds > deadline) {
      await writeState({ stage: "done", message: "Closing expired claim window" });
      await runTimelocked(8, "queue-close-claim", "claim::queue_close_claim", "close-claim", "claim::close_claim", []);
      await writeState({ stage: "done", message: "Claim window closed, funds returned", running: false });
      await audit("claim-closed", { epoch, deadline });
    } else {
      await writeState({ stage: "done", message: "Claim window already active", running: false });
    }
    return;
  }

  const { addrs, amounts, totalOctas } = await buildClaimList(epoch);
  await runTimelocked(6, "queue-set-claim-list", "claim::queue_set_claim_list", "set-claim-list", "claim::set_claim_list", [addrs, amounts]);

  const claimBalance = await coinBalance(runtimeAddresses.claimVaultAddress);
  if (claimBalance < totalOctas) {
    await writeState({ stage: "fund-claim", message: `Funding claim vault with ${(totalOctas - claimBalance) / OCTAS} MOVE` });
    await runTimelocked(4, "queue-withdraw-to-claim", "tournament::queue_admin_withdraw_to", "withdraw-to-claim", "tournament::admin_withdraw_to", [runtimeAddresses.claimVaultAddress, String(totalOctas - claimBalance)]);
  }

  await writeState({ stage: "start-claim", message: "Opening claim window" });
  await runTimelocked(7, "queue-start-claim", "claim::queue_start_claim", "start-claim", "claim::start_claim", [PRIZE_RETURN_ADDRESS]);
  await writeState({ stage: "done", message: "Claim window started", running: false });
}

const CRITICAL_ACTION_TYPES = [4, 6, 7, 8]; // withdraw, set-claim-list, start-claim, close-claim

async function checkGovernanceConfigured(): Promise<void> {
  const unconfigured: number[] = [];
  for (const actionType of CRITICAL_ACTION_TYPES) {
    const delay = await actionDelay(actionType);
    if (delay === 0) unconfigured.push(actionType);
  }
  if (unconfigured.length > 0) {
    await audit("governance-warning", {
      message: `Timelock delay = 0 for critical action types: ${unconfigured.join(", ")}. Call configure_governance on-chain before live.`,
      unconfiguredActions: unconfigured,
    });
    await writeState({ message: `WARNING: timelock delays not configured for actions [${unconfigured.join(", ")}] — governance not set up` });
  }
}

async function runInternal() {
  if (runPromise) return runPromise;
  runPromise = (async () => {
    const ownerId = randomUUID();
    const acquired = await acquireBotLease(ownerId, Date.now() + LEASE_DURATION_MS);
    if (!acquired) return;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      heartbeat = setInterval(() => {
        void renewBotLease(ownerId, Date.now() + LEASE_DURATION_MS);
      }, HEARTBEAT_INTERVAL_MS);
      await writeState({ stopRequested: false, lastError: null });
      await checkGovernanceConfigured();
      const config = await readConfig();
      if (config.mode !== "auto" && !config.enabled) throw new Error("bot is in manual mode");
      const state = await view<unknown[]>("tournament::get_state");
      const active = Boolean(state?.[0]);
      const epoch = Number(state?.[1] ?? 1);
      const currentDay = Math.min(Math.max(Number(state?.[2] ?? 0), 0), TOTAL_DAYS);
      const startTimestamp = Number(state?.[4] ?? 0);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const elapsedTotalDays = startTimestamp > 0 ? Math.floor((nowSeconds - startTimestamp) / 86400) : 0;
      const weeksPassed = Math.floor(elapsedTotalDays / 7);
      const epochStartTs = startTimestamp > 0 ? startTimestamp + weeksPassed * 7 * 86400 : 0;
      const elapsedAfterBuffer = epochStartTs > 0 ? (nowSeconds - epochStartTs) - ORACLE_POST_BUFFER_SECS : -1;
      const closedDay = epochStartTs > 0 && elapsedAfterBuffer >= 86400
        ? Math.min(Math.floor(elapsedAfterBuffer / 86400), TOTAL_DAYS)
        : 0;

      const savedState = await readState();
      if (savedState.epoch !== null && savedState.epoch !== epoch) {
        await writeState({ completedDays: [], pendingTimelock: null });
        await audit("epoch-change", { from: savedState.epoch, to: epoch });
        for (let day = 1; day <= TOTAL_DAYS; day++) {
          try {
            await tx(`reset-oracle-day-${day}-ep${epoch}`, "oracle::set_posted", [String(day), false]);
          } catch {}
        }
      }

      await writeState({ epoch, currentDay });
      if (!active) throw new Error("tournament is not active");
      if (currentDay < 1 && closedDay < TOTAL_DAYS) {
        await writeState({
          stage: "daily",
          message: "Waiting for day 1. Tournament is active, but day 0 is still running.",
          running: false,
        });
        return;
      }
      if (closedDay < 1) {
        await writeState({
          stage: "daily",
          message: `Waiting for day 1 to finish plus ${Math.round(ORACLE_POST_BUFFER_SECS / 60)} min CoinGecko buffer.`,
          running: false,
        });
        return;
      }

      const existingClaim = await view<unknown[]>("claim::get_claim_state");
      if (Boolean(existingClaim?.[0])) {
        const deadline = Number(existingClaim?.[2] ?? 0);
        if (deadline > 0 && nowSeconds > deadline) {
          await writeState({ stage: "done", message: "Closing expired claim window" });
          await runTimelocked(8, "queue-close-claim", "claim::queue_close_claim", "close-claim", "claim::close_claim", []);
          await writeState({ stage: "done", message: "Claim window closed, funds returned", running: false });
          await audit("claim-closed", { epoch, deadline });
          return;
        }
      }

      for (let day = 1; day <= closedDay; day++) {
        const current = await readState();
        if (current.stopRequested) throw new Error("stopped by admin");
        const postedOnChain = await isOraclePostedOnChain(day);
        if (!postedOnChain) await postDay(day, epoch, epochStartTs);
      }

      if (closedDay >= TOTAL_DAYS) await finalizeClaim(epoch);
      else await writeState({ stage: "daily", message: `Waiting for day ${closedDay + 1} to finish`, running: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isWait = message.startsWith("timelock-wait:");
      const currentState = await readState();
      await writeState({
        running: false,
        stage: isWait ? currentState.stage : "error",
        lastError: isWait ? null : message,
        message: isWait ? message : `Bot error: ${message}`,
      });
      if (!isWait) await audit("error", { message });
    } finally {
      if (heartbeat !== null) clearInterval(heartbeat);
      await releaseBotLease(ownerId);
      runPromise = null;
    }
  })();
  return runPromise;
}

export function runOnce() {
  return runInternal();
}
