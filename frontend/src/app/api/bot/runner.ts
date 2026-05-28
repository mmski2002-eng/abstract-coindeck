import fs from "fs";
import { randomUUID } from "crypto";
import {
  createPublicClient, createWalletClient, http,
  keccak256, encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abstractTestnet } from "viem/chains";
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
import {
  TOURNAMENT_VIEW_ABI,
  ORACLE_ABI,
  ORACLE_VIEW_ABI,
  ADMIN_CONTROL_ABI,
  CLAIM_ABI,
  TOURNAMENT_ABI,
} from "@/lib/evmContracts";

const runtimeAddresses = getRuntimeProjectAddresses();
const REST_URL = runtimeAddresses.restUrl;
const PRIZE_RETURN_ADDRESS = runtimeAddresses.prizeVaultAddress;
const TOTAL_DAYS = 6;

const ORACLE_POST_BUFFER_SECS = Number(process.env.BOT_ORACLE_POST_BUFFER_SECS ?? "3600");
const MARKET_DATA_WAIT_TIMEOUT_MS = Number(process.env.BOT_MARKET_DATA_WAIT_TIMEOUT_MS ?? "1800000");
const MARKET_DATA_EXPECTED_COINS = 50;
const MARKET_DATA_REPAIR_ATTEMPTS = Number(process.env.BOT_MARKET_DATA_REPAIR_ATTEMPTS ?? "3");
const LEASE_DURATION_MS = Number(process.env.BOT_STALE_TIMEOUT_MS ?? String(60 * 60 * 1000));
const HEARTBEAT_INTERVAL_MS = 30_000;

let runPromise: Promise<void> | null = null;

export { defaultBotConfig as defaultConfig, defaultBotState as defaultState };
export type { BotMode, BotStage, BotConfig, BotState };

// ── EVM clients ────────────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: abstractTestnet,
  transport: http(REST_URL),
});

function readBotPrivateKey(): string {
  const file = process.env.BOT_PRIVATE_KEY_FILE;
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  return (process.env.BOT_PRIVATE_KEY ?? "").trim();
}

function getBotAccount() {
  const raw = readBotPrivateKey();
  if (!raw) throw new Error("BOT_PRIVATE_KEY or BOT_PRIVATE_KEY_FILE is not configured");
  const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  return privateKeyToAccount(pk);
}

function getBotWalletClient() {
  const account = getBotAccount();
  return createWalletClient({ account, chain: abstractTestnet, transport: http(REST_URL) });
}

// ── Bot helpers ─────────────────────────────────────────────────────────────

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
    const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
    const account = privateKeyToAccount(pk);
    return { configured: true, address: account.address as string };
  } catch {
    return { configured: false, address: null as string | null };
  }
}

// ── EVM contract calls ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evmTx(label: string, address: `0x${string}`, abi: any, functionName: string, args: unknown[] = []): Promise<`0x${string}`> {
  const walletClient = getBotWalletClient();
  const hash = await walletClient.writeContract({
    address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abi: abi as any,
    functionName,
    args: args as never[],
    account: walletClient.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const state = await readState();
  await writeState({ txHashes: { ...state.txHashes, [label]: hash } });
  await audit("tx", { label, hash });
  return hash;
}

async function getOnChainPendingActions(): Promise<Array<{ actionType: number; executeAfter: number; payloadHash: `0x${string}` }>> {
  try {
    const result = await publicClient.readContract({
      address: runtimeAddresses.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "getPendingActions",
    }) as readonly [readonly number[], readonly bigint[], readonly `0x${string}`[]];
    const [actionTypes, executeAfters, hashes] = result;
    return actionTypes.map((actionType, i) => ({
      actionType: Number(actionType),
      executeAfter: Number(executeAfters[i]),
      payloadHash: hashes[i],
    }));
  } catch {
    return [];
  }
}

async function isOraclePostedOnChain(day: number): Promise<boolean> {
  try {
    return await publicClient.readContract({
      address: runtimeAddresses.oracle as `0x${string}`,
      abi: ORACLE_VIEW_ABI,
      functionName: "isDayPosted",
      args: [BigInt(day)],
    }) as boolean;
  } catch {
    return false;
  }
}

async function actionDelay(actionType: number): Promise<number> {
  try {
    const result = await publicClient.readContract({
      address: runtimeAddresses.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "getActionDelay",
      args: [actionType],
    }) as bigint;
    return Number(result);
  } catch {
    return 0;
  }
}

async function saveOracleHistory(epoch: number, day: number, scores: number[]) {
  try {
    await saveDay(epoch, day, scores, "chain");
  } catch (e) {
    await audit("oracle-history-save-failed", { epoch, day, error: e instanceof Error ? e.message : String(e) });
  }
}

// ── Timelock ────────────────────────────────────────────────────────────────

// actionType constants from AdminControl.sol
const ACTION_TREASURY_WITHDRAW = 4;
const ACTION_SET_CLAIM_LIST    = 6;
const ACTION_START_CLAIM       = 7;
const ACTION_CLOSE_CLAIM       = 8;

const CRITICAL_ACTION_TYPES = [ACTION_TREASURY_WITHDRAW, ACTION_SET_CLAIM_LIST, ACTION_START_CLAIM, ACTION_CLOSE_CLAIM];

async function checkGovernanceConfigured(): Promise<void> {
  const unconfigured: number[] = [];
  for (const actionType of CRITICAL_ACTION_TYPES) {
    const delay = await actionDelay(actionType);
    if (delay === 0) unconfigured.push(actionType);
  }
  if (unconfigured.length > 0) {
    await audit("governance-warning", {
      message: `Timelock delay = 0 for critical action types: ${unconfigured.join(", ")}. Call setActionDelay on-chain before live.`,
      unconfiguredActions: unconfigured,
    });
    await writeState({ message: `WARNING: timelock delays not configured for actions [${unconfigured.join(", ")}] — governance not set up` });
  }
}

type TimelockState = {
  action: string;
  actionType: number;
  executeAfter: number;
  directLabel: string;
  payloadHash?: `0x${string}`;
};

async function runTimelocked(
  actionType: number,
  queueLabel: string,
  directLabel: string,
  computeHash: () => `0x${string}`,
  executeAction: () => Promise<`0x${string}`>,
) {
  const delay = await actionDelay(actionType);
  const pending = (await readState()).pendingTimelock as TimelockState | null | undefined;
  const nowSecs = Math.floor(Date.now() / 1000);
  const payloadHash = computeHash();

  if (delay > 0 && (!pending || pending.directLabel !== directLabel)) {
    const onChainPending = await getOnChainPendingActions();
    const alreadyQueued = onChainPending.find((p) => p.actionType === actionType && p.executeAfter > nowSecs);
    if (!alreadyQueued) {
      await evmTx(queueLabel, runtimeAddresses.adminControl as `0x${string}`, ADMIN_CONTROL_ABI, "queueAction", [actionType, payloadHash]);
    }
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
  await executeAction();
  if (pending?.directLabel === directLabel) await writeState({ pendingTimelock: null });
}

// ── Daily oracle posting ────────────────────────────────────────────────────

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
          message: `Market data incomplete (${status.data.length}/${MARKET_DATA_EXPECTED_COINS}) for ${dateKey}. Retrying (${repairAttempts}/${MARKET_DATA_REPAIR_ATTEMPTS})`,
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

  await evmTx(
    `oracle-post-day-${day}`,
    runtimeAddresses.oracle as `0x${string}`,
    ORACLE_ABI,
    "postDayScores",
    [BigInt(day), pids, points.map(BigInt)],
  );

  const scores = new Array(50).fill(0) as number[];
  sorted.forEach((item, i) => { scores[item.pid] = points[i]; });
  await saveOracleHistory(epoch, day, scores);
  const current = await readState();
  await writeState({
    completedDays: Array.from(new Set([...current.completedDays, day])).sort((a, b) => a - b),
    message: `Posted oracle scores for day ${day}`,
  });
}

// ── Epoch finalize (claim list + prize distribution) ────────────────────────

async function finalizeClaim(epoch: number) {
  const claimResult = await publicClient.readContract({
    address: runtimeAddresses.claim as `0x${string}`,
    abi: CLAIM_ABI,
    functionName: "getClaimState",
  }) as readonly [boolean, bigint, bigint, bigint, bigint];

  const [claimActive, , claimDeadline] = claimResult;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (claimActive) {
    if (claimDeadline > 0n && nowSeconds > Number(claimDeadline)) {
      await writeState({ stage: "done", message: "Closing expired claim window" });
      await runTimelocked(
        ACTION_CLOSE_CLAIM, "queue-close-claim", "close-claim",
        () => keccak256("0x"),
        () => evmTx("close-claim", runtimeAddresses.claim as `0x${string}`, CLAIM_ABI, "closeClaim", []),
      );
      await writeState({ stage: "done", message: "Claim window closed, funds returned", running: false });
      await audit("claim-closed", { epoch, deadline: Number(claimDeadline) });
    } else {
      await writeState({ stage: "done", message: "Claim window already active", running: false });
    }
    return;
  }

  const { addrs, amounts } = await buildClaimListForEpoch(epoch);
  const evmAddrs = addrs as `0x${string}`[];
  const evmAmounts = amounts.map(BigInt);

  await runTimelocked(
    ACTION_SET_CLAIM_LIST, "queue-set-claim-list", "set-claim-list",
    () => keccak256(encodeAbiParameters(
      [{ type: "address[]" }, { type: "uint256[]" }],
      [evmAddrs, evmAmounts],
    )),
    () => evmTx("set-claim-list", runtimeAddresses.claim as `0x${string}`, CLAIM_ABI, "setClaimList", [evmAddrs, evmAmounts]),
  );

  // Check vault balance vs needed
  const [, , , vaultBalance] = claimResult;
  const totalNeeded = evmAmounts.reduce((a, b) => a + b, 0n);
  if (vaultBalance < totalNeeded) {
    const toWithdraw = totalNeeded - vaultBalance;
    const recipient = runtimeAddresses.claimVaultAddress as `0x${string}`;
    await writeState({ stage: "fund-claim", message: `Funding claim vault with ${toWithdraw} wei` });
    await runTimelocked(
      ACTION_TREASURY_WITHDRAW, "queue-withdraw-to-claim", "withdraw-to-claim",
      () => keccak256(encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [recipient, toWithdraw],
      )),
      () => evmTx("withdraw-to-claim", runtimeAddresses.tournament as `0x${string}`, TOURNAMENT_ABI, "withdrawTo", [recipient, toWithdraw]),
    );
  }

  const returnAddr = PRIZE_RETURN_ADDRESS as `0x${string}`;
  await writeState({ stage: "start-claim", message: "Opening claim window" });
  await runTimelocked(
    ACTION_START_CLAIM, "queue-start-claim", "start-claim",
    () => keccak256(encodeAbiParameters([{ type: "address" }], [returnAddr])),
    () => evmTx("start-claim", runtimeAddresses.claim as `0x${string}`, CLAIM_ABI, "startClaim", [returnAddr]),
  );
  await writeState({ stage: "done", message: "Claim window started", running: false });
}

// ── Main bot loop ───────────────────────────────────────────────────────────

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

      // Read tournament state via EVM
      const state = await publicClient.readContract({
        address: runtimeAddresses.tournament as `0x${string}`,
        abi: TOURNAMENT_VIEW_ABI,
        functionName: "getState",
      }) as readonly [boolean, bigint, bigint, boolean, bigint, bigint, bigint, bigint];

      const active = state[0];
      const epoch = Number(state[1]);
      const startTimestamp = Number(state[4]);
      const rawDay = Number(state[2]);
      const currentDay = Math.min(Math.max(rawDay, 0), TOTAL_DAYS);

      const nowSeconds = Math.floor(Date.now() / 1000);
      // In EVM, startTimestamp is direct epoch start (no weekly cycling)
      const epochStartTs = startTimestamp;
      const elapsedAfterBuffer = epochStartTs > 0 ? (nowSeconds - epochStartTs) - ORACLE_POST_BUFFER_SECS : -1;
      const closedDay = epochStartTs > 0 && elapsedAfterBuffer >= 86400
        ? Math.min(Math.floor(elapsedAfterBuffer / 86400), TOTAL_DAYS)
        : 0;

      const savedState = await readState();
      if (savedState.epoch !== null && savedState.epoch !== epoch) {
        await writeState({ completedDays: [], pendingTimelock: null });
        await audit("epoch-change", { from: savedState.epoch, to: epoch });
        // Reset oracle posted flags for new epoch
        for (let day = 1; day <= TOTAL_DAYS; day++) {
          try {
            await evmTx(
              `reset-oracle-day-${day}-ep${epoch}`,
              runtimeAddresses.oracle as `0x${string}`,
              ORACLE_ABI,
              "setPosted",
              [BigInt(day), false],
            );
          } catch { /* best effort */ }
        }
      }

      await writeState({ epoch, currentDay });
      if (!active) throw new Error("tournament is not active");
      if (closedDay < 1) {
        await writeState({
          stage: "daily",
          message: `Waiting for day 1 to close plus ${Math.round(ORACLE_POST_BUFFER_SECS / 60)} min CoinGecko buffer.`,
          running: false,
        });
        return;
      }

      for (let day = 1; day <= closedDay; day++) {
        const current = await readState();
        if (current.stopRequested) throw new Error("stopped by admin");
        const postedOnChain = await isOraclePostedOnChain(day);
        if (!postedOnChain) await postDay(day, epoch, epochStartTs);
      }

      if (closedDay >= TOTAL_DAYS) await finalizeClaim(epoch);
      else await writeState({ stage: "daily", message: `Waiting for day ${closedDay + 1} to close`, running: false });
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
