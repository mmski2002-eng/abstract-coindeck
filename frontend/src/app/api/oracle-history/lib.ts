import { areAllOracleDaysFromChain, readHistory, readSyncMeta, saveDay, writeSyncMeta, type OracleHistory } from "@/lib/storage/oracleHistory";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

const EPOCH_DAYS = 6;
const runtimeAddresses = getRuntimeProjectAddresses();
const REST_URL = runtimeAddresses.restUrl;
const MODULE = runtimeAddresses.moduleAddress;

export type { OracleHistory };
export { areAllOracleDaysFromChain, readHistory, saveDay };

async function viewChain<T>(fn: string, args: unknown[] = []): Promise<T | null> {
  try {
    const resp = await fetch(`${REST_URL}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: `${MODULE}::${fn}`, type_arguments: [], arguments: args }),
    });
    if (!resp.ok) return null;
    const json = await resp.json() as unknown;
    if (json && typeof json === "object" && "value" in json) {
      return (json as { value: T }).value;
    }
    return json as T;
  } catch {
    return null;
  }
}

function parseU8Vec(raw: unknown): number[] {
  if (Array.isArray(raw)) return (raw as (string | number)[]).map(Number);
  if (typeof raw === "string") {
    const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
    const out: number[] = [];
    for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
    return out;
  }
  return [];
}

export type SyncResult = {
  skipped: number;
  saved: number;
  pending: number;
  errors: number;
  throttled?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runOracleSync(force = false): Promise<SyncResult> {
  const meta = await readSyncMeta();
  if (!force && Date.now() - meta.lastSyncAt < DAY_MS) {
    return { skipped: 0, saved: 0, pending: 0, errors: 0, throttled: true };
  }

  const result: SyncResult = { skipped: 0, saved: 0, pending: 0, errors: 0 };
  const state = await viewChain<unknown[]>("tournament::get_state");
  if (!state) {
    result.errors++;
    return result;
  }

  const running = state[0] === true || state[0] === "true";
  if (!running) return result;

  const currentEpoch = Number(state[1] ?? 1);
  const currentDay = Number(state[2] ?? 0);
  const startTimestamp = Number(state[4] ?? 0);
  const epochRange = await viewChain<[string, string]>("tournament::get_epoch_range");
  const firstEpoch = Number(epochRange?.[0] ?? currentEpoch);
  const history = await readHistory();

  for (let epoch = firstEpoch; epoch <= currentEpoch; epoch++) {
    for (let day = 1; day <= EPOCH_DAYS; day++) {
      if (epoch === currentEpoch) {
        const elapsedDays = startTimestamp > 0 ? Math.floor((Date.now() / 1000 - startTimestamp) / 86400) : 0;
        const weeksPassed = Math.floor(elapsedDays / 7);
        const epochStartTs = startTimestamp + weeksPassed * 7 * 86400;
        const dayEndTs = epochStartTs + day * 86400;
        if (Date.now() / 1000 < dayEndTs) {
          result.pending++;
          continue;
        }
      }

      if (history[epoch]?.[day] !== undefined) {
        result.skipped++;
        continue;
      }

      if (epoch < currentEpoch) {
        if (history[currentEpoch]?.[day] !== undefined) {
          result.skipped++;
          continue;
        }
        if (currentDay > day) {
          result.pending++;
          continue;
        }
      }

      try {
        const scores = await viewChain<[unknown, string[], unknown]>("oracle::get_day_scores", [String(day)]);
        if (!scores) {
          result.errors++;
          continue;
        }
        const [pidRaw, ptsRaw, rawFinalized] = scores;
        const finalized = rawFinalized === true || rawFinalized === "true";
        if (!finalized) {
          result.pending++;
          continue;
        }

        const scoreArr = new Array(50).fill(0) as number[];
        const pids = parseU8Vec(pidRaw);
        pids.forEach((pid, i) => {
          if (pid < 50) scoreArr[pid] = Number(ptsRaw[i] ?? 0);
        });

        await saveDay(epoch, day, scoreArr, "chain");
        if (!history[epoch]) history[epoch] = {};
        history[epoch][day] = scoreArr;
        result.saved++;
      } catch {
        result.errors++;
      }
    }
  }

  await writeSyncMeta({ lastSyncAt: Date.now() });
  return result;
}
