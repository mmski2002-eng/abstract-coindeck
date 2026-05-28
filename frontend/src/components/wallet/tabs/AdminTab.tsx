"use client";

import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { BOT_CONTROL_ACTION, CLAIM_LIST_PREVIEW_ACTION, LEADERBOARD_CONFIG_ACTION, LEADERBOARD_REFRESH_ACTION, MARKET_DATA_PARSE_ACTION, MARKET_SNAPSHOT_SAVE_ACTION, buildAdminActionMessage, stableStringify } from "@/lib/adminAuth";
import { buildMarketDataQuery } from "@/lib/oracleWindow";
import { HEROES, COIN_ICONS, MODULE_ADDRESS, VAULT_ADDRESS, CLAIM_VAULT_ADDRESS } from "../constants";
import type {
  TournamentStateData, RankRow, PrizeConfig,
  GovernancePolicy, PendingAdminAction, BaseUris, AdminRoleEntry,
} from "../types";
import { ROLE_NAMES, ROLE_FULL } from "../types";
import { getErrorMessage } from "../utils";
import { AdminInfoPanel } from "./AdminInfoPanel";

type HeroStats = { priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype: boolean };
type TransactionPayload = { function: string; typeArguments: unknown[]; functionArguments: unknown[] };
type ClaimState = { active: boolean; startTs: number; deadline: number; vaultBalance: number; claimDays: number } | null;
type OracleDay = { scores: number[]; finalized: boolean };
type ChestPrices = { wooden: number; iron: number; silver: number };
type BotStatus = {
  config: { mode: "manual" | "auto"; enabled: boolean; claimDays: number; updatedAt: number };
  state: {
    running: boolean;
    stage: string;
    message: string;
    epoch: number | null;
    currentDay: number | null;
    completedDays: number[];
    lastRunAt: number | null;
    lastError: string | null;
    pendingTimelock: null | { action: string; executeAfter: number; directLabel: string };
    lastClaimList: null | { totalOctas: number; entries: number; generatedAt: number };
  };
  wallet: { configured: boolean; address: string | null };
};

function AdminTip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex shrink-0 self-center">
      <span className="w-4 h-4 rounded-full border border-white/20 bg-white/10 text-white/50 text-[9px] font-bold inline-flex items-center justify-center cursor-default select-none hover:bg-white/20 hover:text-white/80 transition">i</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl p-3 text-[11px] leading-relaxed shadow-2xl z-50 pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-normal" style={{ background: "var(--modal-bg)", border: "1px solid var(--panel-border)", color: "var(--panel-text-muted)" }}>{text}</span>
    </span>
  );
}

function parseChestPriceToWei(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseEther(trimmed);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

type Props = {
  lang: string;
  isAdmin: boolean;
  adminError: string;
  setAdminError: (v: string) => void;
  adminOk: string;
  setAdminOk: (v: string) => void;
  governancePolicy: GovernancePolicy;
  pendingAdminActions: PendingAdminAction[];
  baseUris: BaseUris;
  adminAddresses: string[];
  adminRoles: AdminRoleEntry[];
  tnState: TournamentStateData;
  tnRefreshing: boolean;
  epochRange: [number, number];
  claimState: ClaimState;
  oracleDayCache: Map<number, OracleDay>;
  heroStats: HeroStats[];
  setHeroStats: React.Dispatch<React.SetStateAction<HeroStats[]>>;
  parseStatus: "idle" | "running" | "done" | "error";
  setParseStatus: (v: "idle" | "running" | "done" | "error") => void;
  parseError: string;
  setParseError: (v: string) => void;
  parseProgress: number;
  parseTotal: number;
  oracleDateInput: string;
  setOracleDateInput: (v: string) => void;
  adminBusy: string | null;
  tierMults: number[];
  setTierMults: React.Dispatch<React.SetStateAction<number[]>>;
  prizeConfig: PrizeConfig;
  setPrizeConfig: React.Dispatch<React.SetStateAction<PrizeConfig>>;
  roleBonusPct: number;
  setRoleBonusPct: (v: number) => void;
  chestPrices: ChestPrices;
  setChestPrices: (v: ChestPrices) => void;
  prizeGenLoading: boolean;
  setPrizeGenLoading: (v: boolean) => void;
  claimListText: string;
  setClaimListText: (v: string) => void;
  withdrawToClaimAmount: string;
  setWithdrawToClaimAmount: (v: string) => void;
  lbRows: RankRow[];
  setResultsDay: (v: number) => void;
  setResultsEpoch: (v: number) => void;
  setViewEpoch: (v: number | null) => void;
  setOracleDayCache: React.Dispatch<React.SetStateAction<Map<number, OracleDay>>>;
  refreshTournament: () => void;
  fetchAllData: (dateInput: string) => void;
  adminTx: (label: string, payload: TransactionPayload) => Promise<void>;
  buildAdminAuthBody: () => Promise<{ signature: unknown; publicKey: string; fullMessage: unknown }>;
  getOracleWindow: (input: string) => { dateKey: string; fromTs: number | "today"; toTs?: number; day: number | null };
  applyMarketData: (coins: { pid: number; priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype?: boolean }[]) => void;
  pollJobStatus: (window: { dateKey: string; fromTs: number | "today"; toTs?: number; day: number | null }) => Promise<void>;
  setHero: (pid: number, patch: Partial<HeroStats>) => void;
  calcPts: (s: HeroStats) => number;
  mkStats: () => HeroStats;
  fetchClaimState: () => void;
  fetchGovernanceState: () => void;
  walletAccount: { publicKey?: unknown } | null | undefined;
  walletSignMessage: (opts: { message: string; nonce: string }) => Promise<unknown>;
};

export function AdminTab({
  lang, isAdmin, adminError, setAdminError, adminOk, setAdminOk,
  governancePolicy, pendingAdminActions, baseUris, adminAddresses, adminRoles,
  tnState, tnRefreshing, epochRange, claimState, oracleDayCache,
  heroStats, setHeroStats, parseStatus, setParseStatus, parseError,
  setParseError, parseProgress, parseTotal, oracleDateInput, setOracleDateInput,
  adminBusy, tierMults, setTierMults, prizeConfig, setPrizeConfig,
  roleBonusPct, setRoleBonusPct, chestPrices, setChestPrices,
  prizeGenLoading, setPrizeGenLoading, claimListText, setClaimListText,
  withdrawToClaimAmount, setWithdrawToClaimAmount, lbRows,
  setResultsDay, setResultsEpoch, setViewEpoch, setOracleDayCache,
  refreshTournament, fetchAllData, adminTx, getOracleWindow, applyMarketData,
  pollJobStatus, setHero, calcPts, mkStats, fetchClaimState,
  fetchGovernanceState,
  walletAccount, walletSignMessage,
}: Props) {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botBusy, setBotBusy] = useState<string | null>(null);
  const [snapshotSaveStatus, setSnapshotSaveStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [snapshotSaveError, setSnapshotSaveError] = useState("");
  const [lineupPickCounts, setLineupPickCounts] = useState<number[] | null>(null);

  const hypedPids = (() => {
    if (!lineupPickCounts) return new Set<number>();
    const sorted = [...lineupPickCounts].sort((a, b) => b - a);
    const threshold = sorted[14] ?? 0;
    if (threshold === 0) return new Set<number>();
    const s = new Set<number>();
    lineupPickCounts.forEach((picks, pid) => { if (picks >= threshold) s.add(pid); });
    return s;
  })();

  useEffect(() => {
    if (!tnState?.epoch || !tnState?.startTimestamp) return;
    const w = getOracleWindow(oracleDateInput);
    const absDay = w.day ?? 1;
    const relDay = absDay - (tnState.epoch - 1) * 7;
    if (relDay < 1 || relDay > 6) { setLineupPickCounts(null); return; }
    fetch(`/api/lineup-stats?epoch=${tnState.epoch}&day=${relDay}`)
      .then(r => r.json())
      .then((json: { data: number[] | null }) => { setLineupPickCounts(json.data ?? null); })
      .catch(() => setLineupPickCounts(null));
  }, [oracleDateInput, tnState?.epoch, tnState?.startTimestamp]); // eslint-disable-line

  useEffect(() => {
    if (parseStatus !== "done" || !lineupPickCounts) return;
    const sorted = [...lineupPickCounts].sort((a, b) => b - a);
    const threshold = sorted[14] ?? 0;
    setHeroStats(prev => prev.map((s, pid) => ({
      ...s,
      hype: threshold > 0 && lineupPickCounts[pid] >= threshold,
    })));
  }, [parseStatus, lineupPickCounts]); // eslint-disable-line

  function normalizePublicKey(value: unknown): string {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) {
      return "0x" + Array.from(value).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    if (value && typeof value === "object") {
      if (ArrayBuffer.isView(value)) {
        const bytes = new Uint8Array((value as ArrayBufferView).buffer, (value as ArrayBufferView).byteOffset, (value as ArrayBufferView).byteLength);
        return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
      }
      if ("toString" in value && typeof (value as { toString: unknown }).toString === "function") {
        return (value as { toString: () => string }).toString();
      }
    }
    return "";
  }

  function unwrapSignedMessage(value: unknown): { signature?: unknown; fullMessage?: unknown } {
    if (!value || typeof value !== "object") return {};
    if ("args" in value && value.args && typeof value.args === "object") {
      return value.args as { signature?: unknown; fullMessage?: unknown };
    }
    return value as { signature?: unknown; fullMessage?: unknown };
  }

  async function sha256Hex(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function buildSignedAdminAction(action: string, payload: unknown) {
    const nonceResponse = await fetch(`/api/admin/nonce?action=${action}`);
    if (!nonceResponse.ok) throw new Error(`Nonce API ${nonceResponse.status}`);
    const nonceData = await nonceResponse.json() as {
      nonce: string;
      issuedAt: number;
      expiresAt: number;
      action: string;
      domain: string;
      chainId: number;
    };
    const payloadHash = await sha256Hex(stableStringify(payload));
    const message = buildAdminActionMessage({
      domain: nonceData.domain,
      chainId: nonceData.chainId,
      action: nonceData.action,
      timestamp: nonceData.issuedAt,
      nonce: nonceData.nonce,
      payloadHash,
    });
    const result = await walletSignMessage({ message, nonce: nonceData.nonce });
    return {
      action: nonceData.action,
      nonce: nonceData.nonce,
      timestamp: nonceData.issuedAt,
      domain: nonceData.domain,
      chainId: nonceData.chainId,
      payloadHash,
      signature: typeof result === "string" ? result : "",
      publicKey: normalizePublicKey(walletAccount?.publicKey),
      fullMessage: message,
    };
  }

  async function fetchBotStatus() {
    const res = await fetch("/api/bot");
    if (!res.ok) return;
    setBotStatus(await res.json() as BotStatus);
  }

  async function botAction(action: string, mode?: "manual" | "auto") {
    setBotBusy(action);
    setAdminError("");
    try {
      const payload = { action, mode };
      const auth = await buildSignedAdminAction(BOT_CONTROL_ACTION, payload);
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, auth }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; reason?: string };
        throw new Error(body.reason || body.error || `Bot API ${res.status}`);
      }
      setBotStatus(await res.json() as BotStatus);
      setAdminOk(lang === "ru" ? "Настройки бота обновлены" : "Bot settings updated");
    } catch (error) {
      setAdminError(getErrorMessage(error));
    } finally {
      setBotBusy(null);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void fetchBotStatus();
    const id = window.setInterval(() => { void fetchBotStatus(); }, 5000);
    return () => window.clearInterval(id);
  }, [isAdmin]);

  async function saveLeaderboardConfig() {
    try {
      const payload = {
        tierMults: tierMults.map(Number),
        roleBonusPct: Number(roleBonusPct),
        prizeConfig: {
          goldPct: Number(prizeConfig.goldPct),
          silverPct: Number(prizeConfig.silverPct),
          bronzePct: Number(prizeConfig.bronzePct),
          pos1: Number(prizeConfig.pos1),
          pos2: Number(prizeConfig.pos2),
          pos3: Number(prizeConfig.pos3),
          pos4_9: Number(prizeConfig.pos4_9),
          pos10_19: Number(prizeConfig.pos10_19),
          pos20_49: Number(prizeConfig.pos20_49),
          pos50_99: Number(prizeConfig.pos50_99),
        },
      };
      const auth = await buildSignedAdminAction(LEADERBOARD_CONFIG_ACTION, payload);
      const response = await fetch("/api/leaderboard/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          auth,
        }),
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || `Config API ${response.status}`);
      }
      setAdminOk(lang === "ru" ? "Настройки сохранены" : "Settings saved");
    } catch (e: unknown) {
      setAdminError(getErrorMessage(e));
    }
  }

  function formatMove(value: number): string {
    return (value / 1e18).toFixed(4);
  }

  function actionTypeLabel(actionType: number): string {
    const labels: Record<number, string> = {
      0: lang === "ru" ? "Обновление URI NFT" : "Update NFT base URIs",
      1: lang === "ru" ? "Обновление цен сундуков" : "Update chest prices",
      2: lang === "ru" ? "Админский mint карты" : "Admin mint card",
      3: lang === "ru" ? "Полный сброс oracle-дней" : "Reset all oracle days",
      4: lang === "ru" ? "Вывод из prize vault" : "Withdraw from prize vault",
      5: lang === "ru" ? "Изменение claim window" : "Update claim window",
      6: lang === "ru" ? "Замена claim list" : "Replace claim list",
      7: lang === "ru" ? "Открытие claim" : "Open claim",
      8: lang === "ru" ? "Закрытие claim" : "Close claim",
      9: lang === "ru" ? "Остановка и reset турнира" : "Stop and reset tournament",
      10: lang === "ru" ? "Очистка маркетплейса" : "Clear marketplace listings",
    };
    return labels[actionType] ?? `${lang === "ru" ? "Действие" : "Action"} #${actionType}`;
  }

  async function queueAdminTx(label: string, payload: TransactionPayload) {
    await adminTx(label, payload);
    await fetchGovernanceState();
  }

  async function saveGovernanceSettings() {
    const freeze = (document.getElementById("admin-freeze-during-epoch") as HTMLInputElement | null)?.checked ?? false;
    const withdrawEnabled = (document.getElementById("admin-withdraw-enabled") as HTMLInputElement | null)?.checked ?? false;
    const perTxLimitMove = parseFloat((document.getElementById("admin-withdraw-per-tx") as HTMLInputElement | null)?.value ?? "0");
    const dailyLimitMove = parseFloat((document.getElementById("admin-withdraw-daily") as HTMLInputElement | null)?.value ?? "0");
    const delayIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    if (Number.isNaN(perTxLimitMove) || Number.isNaN(dailyLimitMove) || perTxLimitMove < 0 || dailyLimitMove < 0) {
      setAdminError(lang === "ru" ? "Проверь лимиты вывода" : "Check withdrawal limits");
      return;
    }

    for (const actionType of delayIds) {
      const input = document.getElementById(`admin-delay-${actionType}`) as HTMLInputElement | null;
      const hours = parseFloat(input?.value ?? "0");
      if (Number.isNaN(hours) || hours < 0) {
        setAdminError(lang === "ru" ? "Проверь timelock настройки" : "Check timelock settings");
        return;
      }
    }

    const delaysSecs: string[] = [];
    for (const actionType of delayIds) {
      const input = document.getElementById(`admin-delay-${actionType}`) as HTMLInputElement | null;
      const hours = parseFloat(input?.value ?? "0");
      delaysSecs.push(String(Math.round(hours * 3600)));
    }
    await adminTx("configure_governance", {
      function: `${MODULE_ADDRESS}::admin_control::configure_governance`,
      typeArguments: [],
      functionArguments: [
        freeze,
        withdrawEnabled,
        String(BigInt(Math.round(perTxLimitMove * 1e18))),
        String(BigInt(Math.round(dailyLimitMove * 1e18))),
        delaysSecs,
      ],
    });
    setAdminOk(lang === "ru" ? "Governance-настройки сохранены одной транзакцией" : "Governance settings saved in one transaction");
  }

  const adminDirectory = (() => {
    const map = new Map<string, { addr: string; fullAccess: boolean; roles: number }>();
    map.set(MODULE_ADDRESS.toLowerCase(), { addr: MODULE_ADDRESS, fullAccess: true, roles: ROLE_FULL });
    for (const addr of adminAddresses) {
      const key = addr.toLowerCase();
      const existing = map.get(key);
      map.set(key, { addr, fullAccess: true, roles: existing?.roles ?? ROLE_FULL });
    }
    for (const entry of adminRoles) {
      const key = entry.addr.toLowerCase();
      const existing = map.get(key);
      map.set(key, {
        addr: existing?.addr ?? entry.addr,
        fullAccess: existing?.fullAccess ?? false,
        roles: (existing?.roles ?? 0) | entry.roles,
      });
    }
    return Array.from(map.values());
  })();

  return (
    <div className="mt-2 space-y-4">
      <div className="font-display font-bold text-2xl tracking-tight" style={{ color: "var(--panel-text)" }}>⚙️ {lang === "ru" ? "Панель администратора" : "Admin panel"}</div>

      {!isAdmin && (
        <div className="rounded-2xl border border-red-500/20 bg-red-950 p-4 text-sm text-red-200">
          {lang === "ru" ? "Подключи admin-кошелёк для доступа." : "Connect admin wallet to access."}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-4">
          {adminError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{adminError}</div>}
          {adminOk && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{adminOk}</div>}

          <AdminInfoPanel
            lang={lang}
            botStatus={botStatus}
            tnState={tnState}
            epochRange={epochRange}
            claimState={claimState}
            governancePolicy={governancePolicy}
            pendingAdminActions={pendingAdminActions}
            baseUris={baseUris}
            adminAddresses={adminAddresses}
            adminRoles={adminRoles}
            adminDirectory={adminDirectory}
            tierMults={tierMults}
            chestPrices={chestPrices}
            lbRows={lbRows}
          />


          <div className="rounded-2xl border border-cyan-400/20 p-4 space-y-3" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-cyan-300">{lang === "ru" ? "Автобот турнира" : "Tournament bot"}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-1 shrink-0">
                {(["manual", "auto"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => botAction("set-mode", mode)}
                    disabled={botBusy !== null}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${botStatus?.config.mode === mode ? "bg-cyan-400/20 text-cyan-200" : "text-zinc-500 hover:text-white"}`}
                  >
                    {mode === "manual" ? "MANUAL" : "БОТ АВТО"}
                  </button>
                ))}
              </div>

            {botStatus?.state.pendingTimelock && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                {lang === "ru" ? "Ожидает timelock" : "Waiting for timelock"}: {botStatus.state.pendingTimelock.action} · {new Date(botStatus.state.pendingTimelock.executeAfter * 1000).toLocaleString()}
              </div>
            )}

            {botStatus?.state.lastError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                {botStatus.state.lastError}
              </div>
            )}

              <button
                onClick={() => botAction("run-once")}
                disabled={botBusy !== null || botStatus?.state.running}
                className="rounded-xl bg-cyan-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-600 disabled:opacity-40 transition"
              >
                {botStatus?.state.running || botBusy === "run-once" ? "…" : (lang === "ru" ? "Запустить / продолжить" : "Run / resume")}
              </button>

              <button
                onClick={() => botAction("stop")}
                disabled={botBusy !== null || !botStatus?.state.running}
                className="rounded-xl bg-zinc-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-40 transition"
              >
                {lang === "ru" ? "Остановить после шага" : "Stop after step"}
              </button>

              <button
                onClick={() => botAction("reset-error")}
                disabled={botBusy !== null}
                className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-40 transition"
              >
                {lang === "ru" ? "Сбросить ошибку" : "Reset error"}
              </button>

              <AdminTip text={lang === "ru" ? "Приватный ключ не вводится во фронте. На сервере нужно задать BOT_PRIVATE_KEY или BOT_PRIVATE_KEY_FILE. Кошелеку нужны роли Oracle + Treasury + Claim и ETH на gas." : "The private key never goes through the frontend. Configure BOT_PRIVATE_KEY or BOT_PRIVATE_KEY_FILE on the server. The wallet needs Oracle + Treasury + Claim roles and gas ETH."} />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 p-4 space-y-4" style={{ background: "var(--card)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-amber-300/80">{lang === "ru" ? "Governance и защита админки" : "Governance & admin safeguards"}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {lang === "ru"
                    ? "Все настройки ниже работают в текущем пакете без миграции адреса. Пока timelock = 0 часов, действия исполняются сразу."
                    : "Everything below works in the current package with no address migration. While a timelock is set to 0 hours, actions execute immediately."}
                </div>
              </div>
              {!governancePolicy.initialized && (
                <button
                  onClick={() => adminTx("admin_control_init", { function: `${MODULE_ADDRESS}::admin_control::initialize`, typeArguments: [], functionArguments: [] })}
                  disabled={adminBusy !== null}
                  className="rounded-xl bg-emerald-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition"
                >
                  {adminBusy === "admin_control_init" ? "…" : (lang === "ru" ? "Инициализировать governance" : "Initialize governance")}
                </button>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-zinc-400">{lang === "ru" ? "Параметры защиты" : "Safeguard settings"}</div>
                <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200">
                  <input id="admin-freeze-during-epoch" type="checkbox" defaultChecked={governancePolicy.freezeDuringEpoch} className="h-4 w-4 accent-emerald-500" />
                  <span>{lang === "ru" ? "Запретить менять чувствительные настройки во время активной эпохи" : "Block sensitive config changes while an epoch is active"}</span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200">
                  <input id="admin-withdraw-enabled" type="checkbox" defaultChecked={governancePolicy.withdrawEnabled} className="h-4 w-4 accent-emerald-500" />
                  <span>{lang === "ru" ? "Включить лимиты вывода из prize vault" : "Enable withdrawal limits for the prize vault"}</span>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">{lang === "ru" ? "Лимит на 1 вывод, ETH" : "Per-withdraw limit, ETH"}</label>
                    <input id="admin-withdraw-per-tx" type="number" min="0" step="0.01" defaultValue={formatMove(governancePolicy.perTxLimit)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">{lang === "ru" ? "Суточный лимит, ETH" : "Daily limit, ETH"}</label>
                    <input id="admin-withdraw-daily" type="number" min="0" step="0.01" defaultValue={formatMove(governancePolicy.dailyLimit)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={saveGovernanceSettings} disabled={adminBusy !== null} className="rounded-xl bg-cyan-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-40 transition">
                    {lang === "ru" ? "Сохранить governance" : "Save governance"}
                  </button>
                  <AdminTip text={lang === "ru"
                    ? "Сохраняет timelock, лимиты вывода и epoch-freeze. Timelock указывается в часах; 0 означает мгновенное исполнение без очереди."
                    : "Saves timelocks, withdrawal limits, and the epoch freeze switch. Timelock values are in hours; 0 means instant execution with no queue."} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-zinc-400">{lang === "ru" ? "Timelock по операциям" : "Per-action timelocks"}</div>
                {(() => {
                  const items = [
                    { id: 0, label: lang === "ru" ? "URI NFT" : "NFT URIs" },
                    { id: 1, label: lang === "ru" ? "Цены сундуков" : "Chest prices" },
                    { id: 2, label: lang === "ru" ? "Админ mint" : "Admin mint" },
                    { id: 3, label: lang === "ru" ? "Сброс oracle" : "Oracle reset" },
                    { id: 4, label: lang === "ru" ? "Вывод из vault" : "Vault withdraw" },
                    { id: 5, label: lang === "ru" ? "Claim days" : "Claim days" },
                    { id: 6, label: lang === "ru" ? "Claim list" : "Claim list" },
                    { id: 7, label: lang === "ru" ? "Открытие claim" : "Open claim" },
                    { id: 8, label: lang === "ru" ? "Закрытие claim" : "Close claim" },
                    { id: 9, label: lang === "ru" ? "Stop/reset турнира" : "Stop/reset tournament" },
                    { id: 10, label: lang === "ru" ? "Очистка листингов" : "Clear listings" },
                  ];
                  const col1 = items.slice(0, 6);
                  const col2 = items.slice(6);
                  const renderItem = ({ id, label }: { id: number; label: string }) => (
                    <div key={id} className="flex items-center gap-2">
                      <label className="w-36 shrink-0 text-xs text-zinc-400">{label}</label>
                      <input id={`admin-delay-${id}`} type="number" min="0" step="0.5" defaultValue={((governancePolicy.actionDelays[id] ?? 0) / 3600).toFixed(1)} className="w-20 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                      <span className="text-xs text-zinc-500">{lang === "ru" ? "ч" : "h"}</span>
                    </div>
                  );
                  return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="space-y-2">{col1.map(renderItem)}</div>
                      <div className="space-y-2">{col2.map(renderItem)}</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-400">{lang === "ru" ? "Текущая очередь timelock" : "Current timelock queue"}</div>
              <div className="rounded-xl border border-white/5 bg-black/20 p-3 space-y-2">
                {pendingAdminActions.length === 0 ? (
                  <div className="text-[11px] text-zinc-500">{lang === "ru" ? "Очередь пуста." : "Queue is empty."}</div>
                ) : pendingAdminActions.map((item) => (
                  <div key={`${item.actionType}-${item.payloadHashHex}`} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                    <div className="text-[11px] font-semibold" style={{ color: "var(--panel-text)" }}>{actionTypeLabel(item.actionType)}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      {lang === "ru" ? "Можно исполнить после" : "Ready after"}: {new Date(item.executeAfter * 1000).toLocaleString(lang === "ru" ? "ru-RU" : "en-US")}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-600 break-all">{item.payloadHashHex}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-amber-500/15" />

            <div className="space-y-4">
              <div className="text-xs font-semibold text-amber-300/80">{lang === "ru" ? "Управление доступом" : "Access management"}</div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">{lang === "ru" ? "Полный доступ (admin)" : "Full access (admin)"}</div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input type="text" placeholder="0x..." id="admin-add-addr"
                      className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
                    <button onClick={() => {
                      const addr = (document.getElementById("admin-add-addr") as HTMLInputElement)?.value.trim();
                      if (!addr) return;
                      adminTx("add_admin", { function: `${MODULE_ADDRESS}::fantasy_league::add_admin`, typeArguments: [], functionArguments: [addr] });
                    }} disabled={adminBusy !== null}
                      className="rounded-xl bg-emerald-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition">
                      {adminBusy === "add_admin" ? "…" : "+ " + (lang === "ru" ? "Добавить" : "Add")}
                    </button>
                    <button onClick={() => {
                      const addr = (document.getElementById("admin-add-addr") as HTMLInputElement)?.value.trim();
                      if (!addr) return;
                      adminTx("remove_admin", { function: `${MODULE_ADDRESS}::fantasy_league::remove_admin`, typeArguments: [], functionArguments: [addr] });
                    }} disabled={adminBusy !== null}
                      className="rounded-xl bg-red-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40 transition">
                      {adminBusy === "remove_admin" ? "…" : "− " + (lang === "ru" ? "Удалить" : "Remove")}
                    </button>
                    <AdminTip text={lang === "ru" ? "Выдаёт / отзывает полные права администратора и все роли." : "Grants / revokes full admin rights and all roles."} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">{lang === "ru" ? "Ограниченный доступ (роли)" : "Restricted access (roles)"}</div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input type="text" placeholder="0x..." id="role-addr"
                      className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
                    {ROLE_NAMES.map(r => (
                      <label key={r.key} className="flex items-center gap-1 cursor-pointer select-none">
                        <input type="checkbox" id={`role-check-${r.key}`} className="accent-emerald-500 h-3.5 w-3.5" />
                        <span className="text-[11px] text-zinc-300">{r.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => {
                      const addr = (document.getElementById("role-addr") as HTMLInputElement)?.value.trim();
                      if (!addr) return;
                      let mask = 0;
                      for (const r of ROLE_NAMES) {
                        if ((document.getElementById(`role-check-${r.key}`) as HTMLInputElement)?.checked) mask |= r.bit;
                      }
                      if (mask === 0) return;
                      adminTx("grant_role", { function: `${MODULE_ADDRESS}::admin_control::grant_role`, typeArguments: [], functionArguments: [addr, String(mask)] });
                    }} disabled={adminBusy !== null}
                      className="rounded-xl bg-cyan-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-40 transition">
                      {adminBusy === "grant_role" ? "…" : (lang === "ru" ? "Выдать роли" : "Grant roles")}
                    </button>
                    <button onClick={() => {
                      const addr = (document.getElementById("role-addr") as HTMLInputElement)?.value.trim();
                      if (!addr) return;
                      let mask = 0;
                      for (const r of ROLE_NAMES) {
                        if ((document.getElementById(`role-check-${r.key}`) as HTMLInputElement)?.checked) mask |= r.bit;
                      }
                      if (mask === 0) return;
                      adminTx("revoke_role", { function: `${MODULE_ADDRESS}::admin_control::revoke_role`, typeArguments: [], functionArguments: [addr, String(mask)] });
                    }} disabled={adminBusy !== null}
                      className="rounded-xl bg-red-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40 transition">
                      {adminBusy === "revoke_role" ? "…" : (lang === "ru" ? "Отозвать роли" : "Revoke roles")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Oracle — daily scores */}
          <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: "var(--card)" }}>
            <div className="text-xs font-semibold text-zinc-400">{lang === "ru" ? "Очки оракула (по дням)" : "Oracle day scores"}</div>

            <div className="rounded-xl border border-white/5 bg-black/20 p-3 space-y-2">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{lang === "ru" ? "Источники данных" : "Data sources"}</div>
              <div className="text-[10px] text-zinc-600">{lang === "ru" ? "Данные: CoinGecko Markets + Trending (автоматически)." : "Data: CoinGecko Markets + Trending (automatic)."}</div>
              <div className="flex flex-wrap gap-2 pt-1 items-center">
                <button onClick={() => fetchAllData(oracleDateInput)} disabled={parseStatus === "running"}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition">
                  {parseStatus === "running" ? "⏳ …" : (lang === "ru" ? "▶ Парсить данные" : "▶ Parse data")}
                </button>
                <AdminTip text={lang === "ru" ? "Загружает рыночные данные с CoinGecko (цена, объём, High/Low, температура, хайп) для выбранной даты. Запускай перед «Запостить очки»." : "Fetches market data from CoinGecko (price, volume, High/Low, temperature, hype) for the selected date. Run before «Post scores»."} />
              </div>
              {parseStatus === "running" && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="animate-pulse">{lang === "ru" ? "Получаем данные с CoinGecko…" : "Fetching CoinGecko data…"}</span>
                    <span className="tabular-nums font-mono">{parseProgress}/{parseTotal}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${parseTotal > 0 ? Math.round((parseProgress / parseTotal) * 100) : 0}%` }} />
                  </div>
                  <div className="text-[9px] text-zinc-600">{lang === "ru" ? "Фон: страницу можно закрыть, процесс не прервётся" : "Background: safe to close the page"}</div>
                </div>
              )}
              {parseStatus === "done" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] text-emerald-400">✓ {lang === "ru" ? "Данные обновлены" : "Data updated"}</div>
                  {tnState?.startTimestamp && (() => {
                    const _snapshotWindow = getOracleWindow(oracleDateInput);
                    const _snapshotAbsDay = _snapshotWindow.day ?? 1;
                    const _snapshotEpoch = tnState.epoch;
                    const _snapshotRelDay = _snapshotAbsDay - (_snapshotEpoch - 1) * 7;
                    const _snapshotDayInvalid = _snapshotRelDay < 1 || _snapshotRelDay > 6;
                    return (
                    <button
                      onClick={async () => {
                        setSnapshotSaveStatus("saving");
                        setSnapshotSaveError("");
                        try {
                          const auth = await buildSignedAdminAction(MARKET_SNAPSHOT_SAVE_ACTION, { epoch: _snapshotEpoch, day: _snapshotRelDay });
                          const resp = await fetch("/api/market-snapshot", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ epoch: _snapshotEpoch, day: _snapshotRelDay, startTimestamp: tnState.startTimestamp, auth }),
                          });
                          if (resp.ok) { setSnapshotSaveStatus("done"); }
                          else { const e = await resp.json().catch(() => ({})) as { error?: string }; setSnapshotSaveStatus("error"); setSnapshotSaveError(e.error ?? "error"); }
                        } catch (e) { setSnapshotSaveStatus("error"); setSnapshotSaveError(String(e)); }
                      }}
                      disabled={snapshotSaveStatus === "saving" || _snapshotDayInvalid}
                      title={_snapshotDayInvalid ? `День ${_snapshotRelDay} вне диапазона (1-6)` : undefined}
                      className="rounded-lg bg-cyan-600/20 border border-cyan-500/30 px-3 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-600/30 disabled:opacity-50 transition">
                      {snapshotSaveStatus === "saving" ? "⏳" : "💾"} {lang === "ru" ? "Сохранить снапшот" : "Save snapshot"}
                    </button>
                    );
                  })()}
                  {snapshotSaveStatus === "done" && <span className="text-[10px] text-cyan-400">✓ snapshot сохранён</span>}
                  {snapshotSaveStatus === "error" && <span className="text-[10px] text-red-400">{snapshotSaveError}</span>}
                </div>
              )}
              {parseStatus === "error" && <div className="text-[10px] text-red-400">{parseError}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400">{lang === "ru" ? "Дата" : "Date"}</label>
                <input type="datetime-local" value={oracleDateInput}
                  onChange={async e => {
                    const val = e.target.value;
                    setOracleDateInput(val);
                    setParseStatus("idle"); setParseError("");
                    const window = getOracleWindow(val);
                    const query = buildMarketDataQuery(window);
                    if (window.dateKey !== "today") {
                      try {
                        const s = await fetch(`/api/market-data?${query}`).then(r => r.ok ? r.json() : null);
                        if (s?.state === "done") { applyMarketData(s.data ?? []); setParseStatus("done"); }
                        else if (s?.state === "running") { setParseStatus("running"); void pollJobStatus(window); }
                        else {
                          const auth = await buildSignedAdminAction(MARKET_DATA_PARSE_ACTION, {});
                          await fetch(`/api/market-data?${query}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ auth }),
                          });
                          setParseStatus("running");
                          void pollJobStatus(window);
                        }
                      } catch {}
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                {tnState?.startTimestamp ? (() => {
                  const w = getOracleWindow(oracleDateInput);
                  const absDay = w.day ?? 1;
                  const relDay = absDay - (tnState.epoch - 1) * 7;
                  const fromTs = typeof w.fromTs === "number" ? w.fromTs : null;
                  const toTs = w.toTs ?? (fromTs ? fromTs + 86400 : null);
                  const fmtUtc = (ts: number) => new Date(ts * 1000).toISOString().slice(5, 16).replace("T", " ") + " UTC";
                  return (
                    <span className="text-xs text-zinc-400 flex flex-col gap-0.5">
                      <span>
                        → Epoch <span className="font-black" style={{ color: "var(--panel-text)" }}>{tnState.epoch}</span>{" "}
                        {lang === "ru" ? "День" : "Day"}{" "}
                        <span className={`font-black${relDay < 1 || relDay > 6 ? " text-red-400" : ""}`} style={relDay < 1 || relDay > 6 ? {} : { color: "var(--panel-text)" }}>{relDay}</span>
                      </span>
                      {fromTs && toTs && (
                        <span className="text-[9px] text-zinc-600 font-mono">{fmtUtc(fromTs)} → {fmtUtc(toTs)}</span>
                      )}
                    </span>
                  );
                })() : (
                  <span className="text-[10px] text-zinc-400">{lang === "ru" ? "Установи дату старта" : "Set start date first"}</span>
                )}
              </div>
              <button onClick={() => { setHeroStats(Array(50).fill(null).map(mkStats)); setParseStatus("idle"); }}
                className="rounded-lg bg-white/5 px-3 py-1 text-xs text-zinc-400 hover:text-white transition">
                {lang === "ru" ? "Сбросить" : "Reset"}
              </button>
              <button onClick={() => setHeroStats(Array(50).fill(null).map(() => ({
                priceChg: parseFloat((Math.random() * 30 - 10).toFixed(1)),
                vol24h: Math.random() * 600e6,
                high24h: 100 + Math.random() * 20,
                low24h: 100 - Math.random() * 15,
                tempRatio: parseFloat((Math.random() * 20).toFixed(2)),
                hype: Math.random() > 0.85,
              })))}
                className="rounded-lg bg-white/5 px-3 py-1 text-xs text-zinc-400 hover:text-white transition">
                Mock
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
              <table className="w-full text-[10px] text-zinc-400">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500">
                    <th className="px-2 py-1.5 text-left font-semibold">{lang === "ru" ? "Категория" : "Category"}</th>
                    <th className="px-2 py-1.5 text-left font-semibold">{lang === "ru" ? "Формула" : "Formula"}</th>
                    <th className="px-2 py-1.5 text-center font-semibold w-16">{lang === "ru" ? "Кап" : "Cap"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [lang === "ru" ? "Изменение цены" : "Price change",         lang === "ru" ? "±10 pts за 1%" : "±10 pts per 1%",                                           "±300"],
                    [lang === "ru" ? "Объём торгов" : "Trading volume",          lang === "ru" ? "ступени $10M→$500M+" : "tiers $10M→$500M+",                                  "+100"],
                    [lang === "ru" ? "Волатильность" : "Volatility",             lang === "ru" ? "(high−low)/low×100, ступени 2%→20%" : "(high−low)/low×100, tiers 2%→20%",   "+100"],
                    [lang === "ru" ? "Температура (vol/mcap)" : "Temperature",   lang === "ru" ? "+10 pts за 1% отношения" : "+10 pts per 1% ratio",                           "+150"],
                    [lang === "ru" ? "Выборов игроков" : "Player picks",         lang === "ru" ? "+100 топ-15 по выборам игроков за предыдущий день (при равенстве — все)" : "+100 for top-15 by player picks previous day (ties included)", "+100"],
                  ].map(([cat, formula, cap]) => (
                    <tr key={String(cat)} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-1 font-semibold text-zinc-300">{cat}</td>
                      <td className="px-2 py-1">{formula}</td>
                      <td className="px-2 py-1 text-center font-bold text-zinc-300">{cap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 bg-black/30 text-[10px] text-zinc-500">
                    <th className="px-2 py-1.5 text-left font-semibold min-w-[100px]">{lang === "ru" ? "Монета" : "Coin"}</th>
                    <th className="px-1 py-1.5 text-center w-16 font-semibold">{lang === "ru" ? "Цена%" : "Price%"}</th>
                    <th className="px-1 py-1.5 text-center w-20 font-semibold">{lang === "ru" ? "Объём" : "Vol"}</th>
                    <th className="px-1 py-1.5 text-center w-16 font-semibold">High</th>
                    <th className="px-1 py-1.5 text-center w-16 font-semibold">Low</th>
                    <th className="px-1 py-1.5 text-center w-14 font-semibold">{lang === "ru" ? "Темп%" : "Temp%"}</th>
                    <th className="px-1 py-1.5 text-center w-14 font-semibold">ХАЙП</th>
                    <th className="px-2 py-1.5 text-center w-12 font-semibold text-blue-400">{lang === "ru" ? "Итог" : "Pts"}</th>
                  </tr>
                </thead>
                <tbody>
                  {HEROES.map((name, pid) => {
                    const s = heroStats[pid];
                    const effectiveHype = hypedPids.has(pid);
                    const pts = calcPts({ ...s, hype: effectiveHype });
                    const spread = s.low24h > 0 ? ((s.high24h - s.low24h) / s.low24h) * 100 : 0;
                    const inp = "w-full rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-white focus:outline-none focus:ring-1 focus:ring-white/20";
                    return (
                      <tr key={pid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1.5">
                            <img src={COIN_ICONS[pid]} alt={name} className="h-5 w-5 rounded object-cover opacity-80 shrink-0" referrerPolicy="no-referrer" />
                            <div className="truncate text-zinc-200 leading-none">{name}</div>
                          </div>
                        </td>
                        <td className="px-1 py-1"><input type="number" min="-100" max="1000" step="0.1" value={s.priceChg.toFixed(2)} onChange={e => setHero(pid, { priceChg: +e.target.value || 0 })} className={inp} /></td>
                        <td className="px-1 py-1"><input type="number" min="0" step="1000000" value={Math.round(s.vol24h)} onChange={e => setHero(pid, { vol24h: +e.target.value || 0 })} className={inp} /></td>
                        <td className="px-1 py-1"><input type="number" min="0" step="0.0001" value={s.high24h} onChange={e => setHero(pid, { high24h: +e.target.value || 0 })} className={inp} /></td>
                        <td className="px-1 py-1"><input type="number" min="0" step="0.0001" value={s.low24h} onChange={e => setHero(pid, { low24h: +e.target.value || 0 })} className={inp} /></td>
                        <td className="px-1 py-1"><input type="number" min="0" max="100" step="0.1" value={s.tempRatio.toFixed(2)} onChange={e => setHero(pid, { tempRatio: +e.target.value || 0 })} className={inp} /></td>
                        <td className="px-1 py-1 text-center tabular-nums font-mono text-[11px]">
                          {lineupPickCounts
                            ? (lineupPickCounts[pid] > 0
                              ? <span className={hypedPids.has(pid) ? "text-emerald-400 font-bold" : "text-zinc-400"}>{lineupPickCounts[pid]}</span>
                              : <span className="text-zinc-600">0</span>)
                            : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-2 py-1 text-center font-black tabular-nums">
                          <div className={pts > 0 ? "text-emerald-400" : pts < 0 ? "text-red-400" : "text-zinc-500"}>{pts}</div>
                          <div className="text-[9px] text-zinc-600">{spread > 0 ? `${spread.toFixed(1)}%v` : ""}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={async () => {
                  const day = getOracleWindow(oracleDateInput).day ?? 1;
                  const pids = heroStats.map((_, i) => i);
                  const pts  = heroStats.map((s, pid) => calcPts({ ...s, hype: hypedPids.has(pid) }));
                  await adminTx("oracle_post", {
                    function: `${MODULE_ADDRESS}::oracle::post_day_scores`,
                    typeArguments: [],
                    functionArguments: [String(day), pids, pts],
                  });
                  await refreshTournament();
                }}
                disabled={adminBusy !== null}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50"
              >
                {adminBusy === "oracle_post" ? "…" : (lang === "ru" ? "📊 Запостить очки" : "📊 Post scores")}
              </button>
              <AdminTip text={lang === "ru" ? "Записывает рассчитанные очки за каждую монету на блокчейн для выбранного дня. Запускай после «Парсить данные»." : "Writes calculated scores for each coin on-chain for the selected day. Run after «Parse data»."} />
            </div>
          </div>

          {/* Oracle + Controls + NFT tools — merged block */}
          <div className="rounded-2xl border border-cyan-500/20 p-4 space-y-5" style={{ background: "var(--card)" }}>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-cyan-300/80">{lang === "ru" ? "Инструменты оракула" : "Oracle tools"}</div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-xs text-zinc-400 shrink-0">{lang === "ru" ? "День №" : "Day #"}</label>
              <input type="number" min="1" max="6" defaultValue="1" id="oracle-tool-day"
                className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
              <button onClick={() => {
                const day = parseInt((document.getElementById("oracle-tool-day") as HTMLInputElement)?.value) || 1;
                adminTx("oracle_set_posted", { function: `${MODULE_ADDRESS}::oracle::set_posted`, typeArguments: [], functionArguments: [String(day), true] });
              }} disabled={adminBusy !== null}
                className="rounded-xl bg-blue-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition">
                {adminBusy === "oracle_set_posted" ? "…" : (lang === "ru" ? "✓ Отметить опубликованным" : "✓ Mark posted")}
              </button>
              <AdminTip text={lang === "ru" ? "Вручную помечает день как опубликованный, не перезаписывая очки." : "Manually marks a day as posted without rewriting scores."} />
              <button onClick={() => {
                const day = parseInt((document.getElementById("oracle-tool-day") as HTMLInputElement)?.value) || 1;
                adminTx("oracle_unset_posted", { function: `${MODULE_ADDRESS}::oracle::set_posted`, typeArguments: [], functionArguments: [String(day), false] });
              }} disabled={adminBusy !== null}
                className="rounded-xl bg-zinc-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-40 transition">
                {adminBusy === "oracle_unset_posted" ? "…" : (lang === "ru" ? "✕ Снять отметку" : "✕ Unmark")}
              </button>
              <AdminTip text={lang === "ru" ? "Убирает флаг «опубликовано» с выбранного дня." : "Removes the «posted» flag from a day."} />
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={() => {
                if (!confirm(lang === "ru" ? "Сбросить все данные оракула? Все очки за все дни будут удалены." : "Reset all oracle data? All scores for all days will be deleted.")) return;
                queueAdminTx("oracle_reset_queue", { function: `${MODULE_ADDRESS}::oracle::queue_reset_all_days`, typeArguments: [], functionArguments: [] });
              }} disabled={adminBusy !== null}
                className="rounded-xl bg-red-900/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-900 disabled:opacity-40 transition">
                {adminBusy === "oracle_reset_queue" ? "…" : (lang === "ru" ? "🕒 Поставить сброс в очередь" : "🕒 Queue oracle reset")}
              </button>
              <button onClick={() => {
                if (!confirm(lang === "ru" ? "Исполнить сброс oracle, если timelock уже истёк?" : "Execute oracle reset if the timelock has expired?")) return;
                adminTx("oracle_reset", { function: `${MODULE_ADDRESS}::oracle::reset_all_days`, typeArguments: [], functionArguments: [] })
                  .then(() => { setHeroStats(Array(50).fill(null).map(mkStats)); setParseStatus("idle"); });
              }} disabled={adminBusy !== null}
                className="rounded-xl bg-red-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40 transition">
                {adminBusy === "oracle_reset" ? "…" : (lang === "ru" ? "🗑 Исполнить сброс" : "🗑 Execute reset")}
              </button>
              <AdminTip text={lang === "ru" ? "Удаляет очки оракула за все дни с блокчейна. Составы игроков сохраняются, но очки обнуляются. Необратимо." : "Deletes oracle scores for all days from the blockchain. Player lineups kept but scores reset. Irreversible."} />
            </div>
          </div>

          <div className="h-px bg-cyan-500/10" />

          <div className="space-y-3">
            <div className="text-xs font-semibold text-cyan-300/80">{lang === "ru" ? "Управление" : "Controls"}</div>
            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-xs text-zinc-400 shrink-0">{lang === "ru" ? "Дата старта" : "Start date"}</label>
              <input type="date" id="admin-start-ts-input"
                defaultValue={tnState?.startTimestamp ? new Date(tnState.startTimestamp * 1000).toISOString().slice(0,10) : ""}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => {
                const val = (document.getElementById("admin-start-ts-input") as HTMLInputElement)?.value;
                const ts = val ? Math.floor(new Date(val + "T00:01:00Z").getTime() / 1000) : Math.floor(Date.now() / 1000);
                adminTx("start_tournament", { function: `${MODULE_ADDRESS}::tournament::start_epoch`, typeArguments: [], functionArguments: [String(ts)] });
              }} disabled={adminBusy !== null || tnState?.active}
                className="rounded-xl bg-emerald-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40 transition">
                {adminBusy === "start_tournament" ? "…" : (lang === "ru" ? "▶ Старт" : "▶ Start")}
              </button>
              <AdminTip text={lang === "ru" ? "Запускает новую эпоху турнира с указанной датой старта." : "Starts a new tournament epoch with the specified start date."} />
              <button onClick={() => queueAdminTx("end_tournament_queue", { function: `${MODULE_ADDRESS}::tournament::queue_stop_and_reset`, typeArguments: [], functionArguments: [] })}
                disabled={adminBusy !== null || !tnState?.active}
                className="rounded-xl bg-zinc-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-600 disabled:opacity-40 transition">
                {adminBusy === "end_tournament_queue" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue end")}
              </button>
              <button onClick={() => adminTx("end_tournament", { function: `${MODULE_ADDRESS}::tournament::stop_and_reset`, typeArguments: [], functionArguments: [] })}
                disabled={adminBusy !== null || !tnState?.active}
                className="rounded-xl bg-zinc-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-40 transition">
                {adminBusy === "end_tournament" ? "…" : (lang === "ru" ? "⏹ Исполнить" : "⏹ Execute")}
              </button>
              <AdminTip text={lang === "ru" ? "Завершает активный турнир. Данные оракула и составы игроков сохраняются." : "Ends the active tournament. Oracle data and player lineups preserved."} />
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={() => {
                if (!confirm(lang === "ru" ? "Стереть все эпохи? Старые недели станут невидимы (данные в блокчейне остаются)." : "Clear all epochs? Old weeks become hidden (data stays on-chain).")) return;
                setOracleDayCache(new Map());
                setResultsDay(1);
                setResultsEpoch(1);
                setViewEpoch(null);
                adminTx("admin_clear_epochs", { function: `${MODULE_ADDRESS}::tournament::admin_clear_epochs`, typeArguments: [], functionArguments: [] });
              }} disabled={adminBusy !== null}
                className="rounded-xl bg-zinc-700/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-40 transition">
                {adminBusy === "admin_clear_epochs" ? "…" : (lang === "ru" ? "🧹 Стереть эпохи" : "🧹 Clear epochs")}
              </button>
              <AdminTip text={lang === "ru" ? "Скрывает все прошлые эпохи из UI. Данные остаются на блокчейне." : "Hides all past epochs from UI. Data stays on-chain."} />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-zinc-400 shrink-0">{lang === "ru" ? "Плата за отмену лайнапа" : "Cancel lineup fee"}</label>
              <input type="number" min="0" step="0.01" defaultValue="0.50" id="admin-cancel-fee"
                className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              <span className="text-xs text-zinc-400">MOVE</span>
              <button onClick={() => {
                const val = parseFloat((document.getElementById("admin-cancel-fee") as HTMLInputElement)?.value);
                if (isNaN(val) || val < 0) return;
                adminTx("set_cancel_fee", { function: `${MODULE_ADDRESS}::tournament::set_cancel_fee`, typeArguments: [], functionArguments: [String(BigInt(Math.round(val * 1e18)))] });
              }} disabled={adminBusy !== null}
                className="rounded-xl bg-violet-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40 transition">
                {adminBusy === "set_cancel_fee" ? "…" : (lang === "ru" ? "Установить" : "Set")}
              </button>
              <AdminTip text={lang === "ru" ? "Плата взимается при отмене лайнапа текущего дня. 0 = бесплатно." : "Fee charged when a player cancels their lineup for the current day. 0 = free."} />
            </div>

          </div>

          <div className="h-px bg-cyan-500/10" />

          <div className="space-y-3">
            <div className="text-xs font-semibold text-cyan-300/80">{lang === "ru" ? "URI изображений NFT" : "NFT image URIs"}</div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-zinc-400 w-16 shrink-0">{lang === "ru" ? "Карта" : "Card"}</label>
              <input type="text" placeholder="https://..." id="admin-uri-card" defaultValue={baseUris.card}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-zinc-400 w-16 shrink-0">{lang === "ru" ? "Сундук" : "Chest"}</label>
              <input type="text" placeholder="https://..." id="admin-uri-chest" defaultValue={baseUris.chest}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <div className="flex gap-2 items-center">
            <button onClick={() => {
              const cardUri  = (document.getElementById("admin-uri-card")  as HTMLInputElement)?.value.trim();
              const chestUri = (document.getElementById("admin-uri-chest") as HTMLInputElement)?.value.trim();
              if (!cardUri || !chestUri) return;
              const toBytes = (s: string) => Array.from(new TextEncoder().encode(s));
              queueAdminTx("queue_set_base_uris", { function: `${MODULE_ADDRESS}::fantasy_league::queue_set_base_uris`, typeArguments: [], functionArguments: [toBytes(cardUri), toBytes(chestUri)] });
            }} disabled={adminBusy !== null}
              className="rounded-xl bg-teal-700/70 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 transition">
              {adminBusy === "queue_set_base_uris" ? "…" : (lang === "ru" ? "🕒 Поставить URI в очередь" : "🕒 Queue URI update")}
            </button>
            <button onClick={() => {
              const cardUri  = (document.getElementById("admin-uri-card")  as HTMLInputElement)?.value.trim();
              const chestUri = (document.getElementById("admin-uri-chest") as HTMLInputElement)?.value.trim();
              if (!cardUri || !chestUri) return;
              const toBytes = (s: string) => Array.from(new TextEncoder().encode(s));
              adminTx("set_base_uris", { function: `${MODULE_ADDRESS}::fantasy_league::set_base_uris`, typeArguments: [], functionArguments: [toBytes(cardUri), toBytes(chestUri)] });
            }} disabled={adminBusy !== null}
              className="rounded-xl bg-teal-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-40 transition">
              {adminBusy === "set_base_uris" ? "…" : (lang === "ru" ? "Обновить URI" : "Execute URIs")}
            </button>
            <AdminTip text={lang === "ru" ? "Обновляет базовые URL изображений для карточек и сундуков." : "Updates base image URLs for cards and chests."} />
            </div>
          </div>

          <div className="h-px bg-cyan-500/10" />

          <div className="space-y-3">
            <div className="text-xs font-semibold text-cyan-300/80">{lang === "ru" ? "Переминтовать карту (исправить URI)" : "Reissue card (fix URI)"}</div>
            <div className="flex gap-2 items-center">
              <input type="text" placeholder={lang === "ru" ? "Адрес карты 0x..." : "Card address 0x..."} id="admin-reissue-addr"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <button onClick={() => {
              const addr = (document.getElementById("admin-reissue-addr") as HTMLInputElement)?.value.trim();
              if (!addr) return;
              adminTx("admin_reissue_card", { function: `${MODULE_ADDRESS}::fantasy_league::admin_reissue_card`, typeArguments: [], functionArguments: [addr] });
            }} disabled={adminBusy !== null}
              className="rounded-xl bg-orange-700/70 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-40 transition">
              {adminBusy === "admin_reissue_card" ? "…" : (lang === "ru" ? "🔄 Переминтовать" : "🔄 Reissue")}
            </button>
            <AdminTip text={lang === "ru" ? "Сжигает карту и выдаёт новую с тем же hero/tier и правильным URI." : "Burns the card and re-mints with the same hero/tier but correct URI."} />
          </div>

          <div className="h-px bg-cyan-500/10" />

          <div className="space-y-3">
            <div className="text-xs font-semibold text-cyan-300/80">{lang === "ru" ? "Выдать карту игроку (admin mint)" : "Mint card to player (admin)"}</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="text" placeholder={lang === "ru" ? "Адрес 0x..." : "Address 0x..."} id="admin-mint-addr"
                className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
              <div className="flex gap-2 items-center shrink-0">
                <label className="text-xs text-zinc-400">pid</label>
                <input type="number" min="0" max="49" defaultValue="0" id="admin-mint-pid"
                  className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                <label className="text-xs text-zinc-400">{lang === "ru" ? "уровень" : "tier"}</label>
                <select id="admin-mint-tier" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20">
                  <option value="0">0 — Common</option>
                  <option value="1">1 — Uncommon</option>
                  <option value="2">2 — Rare</option>
                  <option value="3">3 — Legendary</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 items-center">
            <button onClick={() => {
              const addr = (document.getElementById("admin-mint-addr") as HTMLInputElement)?.value.trim();
              const pid  = (document.getElementById("admin-mint-pid")  as HTMLInputElement)?.value.trim();
              const tier = (document.getElementById("admin-mint-tier") as HTMLSelectElement)?.value;
              if (!addr || !pid) return;
              queueAdminTx("queue_admin_mint_to", { function: `${MODULE_ADDRESS}::fantasy_league::queue_admin_mint_to`, typeArguments: [], functionArguments: [addr, pid, tier, "1"] });
            }} disabled={adminBusy !== null}
              className="rounded-xl bg-indigo-700/70 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition">
              {adminBusy === "queue_admin_mint_to" ? "…" : (lang === "ru" ? "🕒 Поставить mint в очередь" : "🕒 Queue mint")}
            </button>
            <button onClick={() => {
              const addr = (document.getElementById("admin-mint-addr") as HTMLInputElement)?.value.trim();
              const pid  = (document.getElementById("admin-mint-pid")  as HTMLInputElement)?.value.trim();
              const tier = (document.getElementById("admin-mint-tier") as HTMLSelectElement)?.value;
              if (!addr || !pid) return;
              adminTx("admin_mint_to", { function: `${MODULE_ADDRESS}::fantasy_league::admin_mint_to`, typeArguments: [], functionArguments: [addr, pid, tier, "1"] });
            }} disabled={adminBusy !== null}
              className="rounded-xl bg-indigo-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-40 transition">
              {adminBusy === "admin_mint_to" ? "…" : (lang === "ru" ? "🎴 Исполнить mint" : "🎴 Execute mint")}
            </button>
            <AdminTip text={lang === "ru" ? "Выдаёт NFT-карточку с указанным героем (pid 0–49) и уровнем на адрес игрока бесплатно." : "Mints an NFT card with the specified hero (pid 0–49) and tier to a player address for free."} />
            </div>
          </div>

          </div>{/* /merged block */}

          {/* Role bonus + Chest prices — merged block */}
          <div className="rounded-2xl border border-violet-500/20 p-4 space-y-5" style={{ background: "var(--card)" }}>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-violet-300/80">⚡ {lang === "ru" ? "Бонус за правильную роль" : "Role bonus"}</div>
            <div className="text-[11px] text-zinc-400">
              {lang === "ru" ? "Если монета стоит в слоте своей категории — её очки умножаются на (100 + бонус)%." : "If a coin is in its category slot, its score is multiplied by (100 + bonus)%."}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-400 shrink-0">{lang === "ru" ? "Бонус %" : "Bonus %"}</label>
              <input type="number" min="0" max="100" step="1" value={roleBonusPct}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                  setRoleBonusPct(v);
                }}
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
              <span className="text-xs text-zinc-500">{lang === "ru" ? `Итого ×${((100 + roleBonusPct) / 100).toFixed(2)}` : `Multiplier ×${((100 + roleBonusPct) / 100).toFixed(2)}`}</span>
              <button onClick={async () => {
                const epoch = tnState?.epoch ?? 1;
                const totalDays = tnState?.totalDays ?? 6;
                const rawDay = tnState?.currentDay ?? 1;
                const currentDay = rawDay < 1 ? totalDays : Math.min(rawDay, totalDays);
                const payload = { epoch, totalDays, currentDay, roleBonusPct };
                const params = new URLSearchParams({ epoch: String(epoch), totalDays: String(totalDays), currentDay: String(currentDay), roleBonusPct: String(roleBonusPct) });
                const auth = await buildSignedAdminAction(LEADERBOARD_REFRESH_ACTION, payload);
                await fetch(`/api/leaderboard?${params}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auth }) }).catch(() => null);
                setAdminOk(lang === "ru" ? "Бонус обновлён, лидерборд пересчитывается" : "Bonus updated, leaderboard recalculating");
                setTimeout(() => setAdminOk(""), 3000);
              }} className="rounded-xl bg-violet-600/70 hover:bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition">
                {lang === "ru" ? "Применить" : "Apply"}
              </button>
              <AdminTip text={lang === "ru" ? "Пересчитывает лидерборд с новым бонусом за правильную роль." : "Recalculates the leaderboard with the new role-match bonus."} />
            </div>
          </div>

          <div className="h-px bg-violet-500/15" />

          <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-violet-300/80">{lang === "ru" ? "Цены сундуков" : "Chest prices"}</div>
                {([
                  { id: "wooden", label: lang === "ru" ? "Хомяк" : "Hamster", icon: "🐹", val: chestPrices.wooden },
                  { id: "iron",   label: lang === "ru" ? "Медведь" : "Bear",   icon: "🐻", val: chestPrices.iron },
                  { id: "silver", label: lang === "ru" ? "Бык" : "Bull",       icon: "🐂", val: chestPrices.silver },
                ] as const).map(({ id, label, icon, val }) => (
                  <div key={id} className="flex gap-2 items-center">
                    <span className="text-sm w-5">{icon}</span>
                    <label className="text-xs text-zinc-400 w-20 shrink-0">{label}</label>
                    <input type="number" min="0.0001" step="0.0001" defaultValue={(val / 1e18).toFixed(4)} id={`admin-chest-price-${id}`}
                      className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                    <span className="text-xs text-zinc-400">ETH</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                <button onClick={() => {
                  const w = parseChestPriceToWei((document.getElementById("admin-chest-price-wooden") as HTMLInputElement)?.value ?? "");
                  const ir = parseChestPriceToWei((document.getElementById("admin-chest-price-iron") as HTMLInputElement)?.value ?? "");
                  const s = parseChestPriceToWei((document.getElementById("admin-chest-price-silver") as HTMLInputElement)?.value ?? "");
                  if (w === null || ir === null || s === null) return;
                  queueAdminTx("queue_set_chest_prices", {
                    function: `${MODULE_ADDRESS}::fantasy_league::queue_set_chest_prices`,
                    typeArguments: [],
                    functionArguments: [w.toString(), ir.toString(), s.toString()],
                  });
                }} disabled={adminBusy !== null}
                  className="rounded-xl bg-teal-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 transition">
                  {adminBusy === "queue_set_chest_prices" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue")}
                </button>
                <button onClick={() => {
                  const w = parseChestPriceToWei((document.getElementById("admin-chest-price-wooden") as HTMLInputElement)?.value ?? "");
                  const ir = parseChestPriceToWei((document.getElementById("admin-chest-price-iron") as HTMLInputElement)?.value ?? "");
                  const s = parseChestPriceToWei((document.getElementById("admin-chest-price-silver") as HTMLInputElement)?.value ?? "");
                  if (w === null || ir === null || s === null) return;
                  adminTx("set_chest_prices", {
                    function: `${MODULE_ADDRESS}::fantasy_league::set_chest_prices`,
                    typeArguments: [],
                    functionArguments: [w.toString(), ir.toString(), s.toString()],
                  }).then(() => setChestPrices({ wooden: Number(w), iron: Number(ir), silver: Number(s) }));
                }} disabled={adminBusy !== null}
                  className="rounded-xl bg-teal-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-40 transition">
                  {adminBusy === "set_chest_prices" ? "…" : (lang === "ru" ? "Установить" : "Set")}
                </button>
                </div>
                <AdminTip text={lang === "ru" ? "Обновляет цены сундуков на блокчейне в ABS токенах." : "Updates chest prices on-chain in ABS tokens."} />
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-violet-300/80">{lang === "ru" ? "Множители тиров (×0.01)" : "Tier multipliers (×0.01)"}</div>
                {([
                  { label: "Common",    color: "text-zinc-300",   idx: 0 },
                  { label: "Rare",      color: "text-blue-300",   idx: 1 },
                  { label: "Epic",      color: "text-purple-300", idx: 2 },
                  { label: "Legendary", color: "text-amber-300",  idx: 3 },
                ] as const).map(({ label, color, idx }) => (
                  <div key={label} className="flex gap-2 items-center">
                    <label className={`text-xs font-semibold w-24 shrink-0 ${color}`}>{label}</label>
                    <input type="number" min="100" max="1000" step="1" value={tierMults[idx]}
                      onChange={e => setTierMults(prev => { const n = [...prev]; n[idx] = Number(e.target.value) || 100; return n; })}
                      className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                    <span className="text-xs text-zinc-500">= ×{(tierMults[idx] / 100).toFixed(2)}</span>
                  </div>
                ))}
                <button onClick={saveLeaderboardConfig} className="rounded-xl bg-teal-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 transition">
                  {lang === "ru" ? "Сохранить" : "Save"}
                </button>
                <AdminTip text={lang === "ru" ? "Множители применяются при расчёте лидерборда. 100 = ×1.0, 250 = ×2.5. Не записывается на блокчейн." : "Multipliers apply when calculating the leaderboard. 100 = ×1.0, 250 = ×2.5. Not written on-chain."} />
              </div>
            </div>

          </div>{/* /role bonus + chest prices block */}

          {/* Claim management */}
          <div className="rounded-2xl border border-violet-500/20 p-4 space-y-4" style={{ background: "var(--card)" }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-violet-300">🏆 {lang === "ru" ? "Выдача призов (Claim)" : "Prize distribution (Claim)"}</div>
              <button onClick={fetchClaimState} className="text-xs transition" style={{ color: "var(--nft-muted)" }}>↻</button>
            </div>

            <div className="text-xs font-semibold text-zinc-300">🏆 {lang === "ru" ? "Распределение призов" : "Prize distribution"}</div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{lang === "ru" ? "Пул лиги (% от общего)" : "League pool (% of total)"}</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "goldPct",   label: "🥇 Gold",   color: "text-violet-300" },
                  { key: "silverPct", label: "🥈 Silver", color: "text-zinc-300" },
                  { key: "bronzePct", label: "🥉 Bronze", color: "text-zinc-400" },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} className="space-y-1">
                    <div className={`text-[10px] font-bold ${color}`}>{label}</div>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" step="1" value={prizeConfig[key]}
                        onChange={e => setPrizeConfig(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                      <span className="text-[10px] text-zinc-500">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{lang === "ru" ? "% от пула лиги по позициям" : "% of league pool by position"}</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "pos1",     label: lang === "ru" ? "1 место" : "1st place" },
                  { key: "pos2",     label: lang === "ru" ? "2 место" : "2nd place" },
                  { key: "pos3",     label: lang === "ru" ? "3 место" : "3rd place" },
                  { key: "pos4_9",   label: lang === "ru" ? "4–9 места (каждый)" : "4–9 (each)" },
                  { key: "pos10_19", label: lang === "ru" ? "10–19 места (каждый)" : "10–19 (each)" },
                  { key: "pos20_49", label: lang === "ru" ? "20–49 места (каждый)" : "20–49 (each)" },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="text-[10px] text-zinc-400 w-32 shrink-0">{label}</div>
                    <input type="number" min="0" max="100" step="0.1" value={prizeConfig[key]}
                      onChange={e => setPrizeConfig(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                      className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                    <span className="text-[10px] text-zinc-500">%</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-zinc-400 w-32 shrink-0">{lang === "ru" ? "50–99 места (каждый)" : "50–99 (each)"}</div>
                  <input type="number" min="0" max="100" step="0.1" value={prizeConfig.pos50_99}
                    onChange={e => setPrizeConfig(p => ({ ...p, pos50_99: parseFloat(e.target.value) || 0 }))}
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                  <span className="text-[10px] text-zinc-500">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={saveLeaderboardConfig} className="rounded-xl bg-teal-600/80 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-600 transition">
                    {lang === "ru" ? "Сохранить" : "Save"}
                  </button>
                  <AdminTip text={lang === "ru" ? "Сохраняет конфигурацию распределения призов (проценты лиг и мест) на сервере." : "Saves the prize distribution config (league and position percentages) to the server."} />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button disabled={prizeGenLoading} onClick={async () => {
                setPrizeGenLoading(true);
                try {
                  const epoch = tnState?.epoch ?? 1;
                  const auth = await buildSignedAdminAction(CLAIM_LIST_PREVIEW_ACTION, { epoch });
                  const response = await fetch("/api/admin/claim-list/preview", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ epoch, auth }),
                  });
                  const body = await response.json().catch(() => ({})) as { error?: string; reason?: string; claimListText?: string };
                  if (!response.ok || !body.claimListText) {
                    throw new Error(body.reason || body.error || "Claim list preview failed");
                  }
                  setClaimListText(body.claimListText);
                } catch (e: unknown) {
                  setAdminError(getErrorMessage(e));
                } finally {
                  setPrizeGenLoading(false);
                }
              }} className="flex-1 rounded-xl bg-violet-600/80 hover:bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 transition">
                {prizeGenLoading ? "…" : (lang === "ru" ? "⚡ Сгенерировать список победителей" : "⚡ Generate winners list")}
              </button>
              <button onClick={() => {
                const LEAGUE = ["Bronze", "Silver", "Gold"];
                const epoch = tnState?.epoch ?? 1;
                const displayEp = epoch - (epochRange?.[0] ?? 1) + 1;
                const csv = ["rank,address,score,league,days", ...lbRows.map((r, i) => `${i + 1},${r.addr},${r.score},${LEAGUE[r.league] ?? r.league},${r.days}`)].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `leaderboard-week${displayEp}.csv`; a.click();
                URL.revokeObjectURL(url);
              }} disabled={lbRows.length === 0}
                className="rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-30 transition">
                ⬇ CSV
              </button>
            </div>

            {claimState && (
              <div className="rounded-xl bg-black/30 px-4 py-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">{lang === "ru" ? "Статус" : "Status"}</span>
                  <span className={claimState.active ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                    {claimState.active ? (lang === "ru" ? "▶ Активен" : "▶ Active") : (lang === "ru" ? "⏸ Неактивен" : "⏸ Inactive")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{lang === "ru" ? "Баланс claim vault" : "Claim vault balance"}</span>
                  <span className="font-bold" style={{ color: "var(--panel-text)" }}>{(claimState.vaultBalance / 1e18).toFixed(4)} ETH</span>
                </div>
                {claimState.active && claimState.deadline > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{lang === "ru" ? "Дедлайн" : "Deadline"}</span>
                    <span className="text-zinc-300">{new Date(claimState.deadline * 1000).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400 font-semibold">0. {lang === "ru" ? "Дней для клейма (окно выдачи)" : "Claim window (days)"}</div>
              <div className="flex gap-2 items-center">
                <input type="number" min="1" max="30" defaultValue={claimState?.claimDays ?? 7} id="admin-claim-days"
                  className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                <span className="text-xs text-zinc-400">{lang === "ru" ? "дней" : "days"}</span>
                <button onClick={() => {
                  const days = parseInt((document.getElementById("admin-claim-days") as HTMLInputElement)?.value) || 7;
                  queueAdminTx("queue_set_claim_days", { function: `${MODULE_ADDRESS}::claim::queue_set_claim_days`, typeArguments: [], functionArguments: [String(days)] });
                }} disabled={adminBusy !== null}
                  className="rounded-xl bg-violet-700/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40 transition">
                  {adminBusy === "queue_set_claim_days" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue")}
                </button>
                <button onClick={() => {
                  const days = parseInt((document.getElementById("admin-claim-days") as HTMLInputElement)?.value) || 7;
                  adminTx("set_claim_days", { function: `${MODULE_ADDRESS}::claim::set_claim_days`, typeArguments: [], functionArguments: [String(days)] });
                }} disabled={adminBusy !== null}
                  className="rounded-xl bg-violet-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-40 transition">
                  {adminBusy === "set_claim_days" ? "…" : (lang === "ru" ? "Сохранить" : "Save")}
                </button>
                <AdminTip text={lang === "ru" ? "Устанавливает количество дней для окна выдачи призов." : "Sets how many days the claim window stays open."} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400 font-semibold">1. {lang === "ru" ? "Перевести из prize vault в claim vault" : "Transfer prize vault → claim vault"}</div>
              <div className="flex gap-2 items-center">
                <input type="number" min="0.01" step="0.01" value={withdrawToClaimAmount}
                  onChange={(e) => setWithdrawToClaimAmount(e.target.value)}
                  className="w-32 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                <span className="text-xs text-zinc-400">ETH</span>
                <button onClick={() => queueAdminTx("queue_withdraw_to_claim", {
                  function: `${MODULE_ADDRESS}::tournament::queue_admin_withdraw_to`,
                  typeArguments: [],
                  functionArguments: [CLAIM_VAULT_ADDRESS, parseEther(withdrawToClaimAmount || "0").toString()],
                })} disabled={adminBusy !== null || parseFloat(withdrawToClaimAmount) <= 0}
                  className="rounded-xl bg-violet-700/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40 transition">
                  {adminBusy === "queue_withdraw_to_claim" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue")}
                </button>
                <button onClick={() => adminTx("withdraw_to_claim", {
                  function: `${MODULE_ADDRESS}::tournament::admin_withdraw_to`,
                  typeArguments: [],
                  functionArguments: [CLAIM_VAULT_ADDRESS, parseEther(withdrawToClaimAmount || "0").toString()],
                })} disabled={adminBusy !== null || parseFloat(withdrawToClaimAmount) <= 0}
                  className="rounded-xl bg-violet-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-40 transition">
                  {adminBusy === "withdraw_to_claim" ? "…" : (lang === "ru" ? "Перевести" : "Transfer")}
                </button>
                <AdminTip text={lang === "ru" ? "Перемещает ETH из prize vault в claim vault перед открытием клейма." : "Moves ETH from prize vault to claim vault before opening claim."} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400 font-semibold">2. {lang === "ru" ? "Список победителей (адрес сумма, по одному на строку)" : "Winners list (address amount, one per line)"}</div>
              <textarea value={claimListText} onChange={(e) => setClaimListText(e.target.value)} rows={5}
                placeholder={"0x123...abc 10.5\n0x456...def 5.0"}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none" />
              <div className="flex gap-2 items-center">
              <button onClick={() => {
                const norm = (a: string) => "0x" + (a.startsWith("0x") ? a.slice(2) : a).padStart(64, "0");
                const merged = new Map<string, bigint>();
                for (const line of claimListText.trim().split("\n")) {
                  const t = line.trim(); if (!t || t.startsWith("#")) continue;
                  const [addr, amt] = t.split(/\s+/); if (!addr || !amt) continue;
                  const key = norm(addr);
                  try { merged.set(key, (merged.get(key) ?? 0n) + parseEther(amt)); } catch { /* skip invalid */ }
                }
                if (merged.size === 0) return;
                queueAdminTx("queue_set_claim_list", { function: `${MODULE_ADDRESS}::claim::queue_set_claim_list`, typeArguments: [], functionArguments: [[...merged.keys()], [...merged.values()].map(String)] });
              }} disabled={adminBusy !== null || !claimListText.trim() || claimState?.active}
                className="rounded-xl bg-violet-700/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40 transition">
                {adminBusy === "queue_set_claim_list" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue")}
              </button>
              <button onClick={() => {
                const norm = (a: string) => "0x" + (a.startsWith("0x") ? a.slice(2) : a).padStart(64, "0");
                const merged = new Map<string, bigint>();
                for (const line of claimListText.trim().split("\n")) {
                  const t = line.trim(); if (!t || t.startsWith("#")) continue;
                  const [addr, amt] = t.split(/\s+/); if (!addr || !amt) continue;
                  const key = norm(addr);
                  try { merged.set(key, (merged.get(key) ?? 0n) + parseEther(amt)); } catch { /* skip invalid */ }
                }
                if (merged.size === 0) return;
                adminTx("set_claim_list", { function: `${MODULE_ADDRESS}::claim::set_claim_list`, typeArguments: [], functionArguments: [[...merged.keys()], [...merged.values()].map(String)] });
              }} disabled={adminBusy !== null || !claimListText.trim() || claimState?.active}
                className="rounded-xl bg-violet-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-40 transition">
                {adminBusy === "set_claim_list" ? "…" : (lang === "ru" ? "Сохранить список" : "Save list")}
              </button>
              </div>
              <AdminTip text={lang === "ru" ? "Загружает список победителей на блокчейн. Формат: адрес пробел сумма_в_MOVE." : "Uploads the winners list to the blockchain. Format: address space amount_in_MOVE."} />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400 font-semibold">3. {lang === "ru" ? "Открыть окно клейма" : "Open claim window"}</div>
              <div className="text-[10px] text-zinc-500">{lang === "ru" ? "Остаток по истечении вернётся в prize vault" : "Unclaimed remainder returns to prize vault"}</div>
              <div className="flex gap-2 items-center">
              <button onClick={() => queueAdminTx("queue_start_claim", { function: `${MODULE_ADDRESS}::claim::queue_start_claim`, typeArguments: [], functionArguments: [VAULT_ADDRESS] })}
                disabled={adminBusy !== null || claimState?.active}
                className="rounded-xl bg-emerald-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition">
                {adminBusy === "queue_start_claim" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue")}
              </button>
              <button onClick={() => adminTx("start_claim", { function: `${MODULE_ADDRESS}::claim::start_claim`, typeArguments: [], functionArguments: [VAULT_ADDRESS] })}
                disabled={adminBusy !== null || claimState?.active}
                className="rounded-xl bg-emerald-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40 transition">
                {adminBusy === "start_claim" ? "…" : (lang === "ru" ? "▶ Открыть клейм" : "▶ Open claim")}
              </button>
              </div>
              <AdminTip text={lang === "ru" ? "Открывает окно получения призов. Убедись что шаги 0–2 выполнены." : "Opens the prize claim window. Ensure steps 0–2 are complete first."} />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400 font-semibold">4. {lang === "ru" ? "Закрыть клейм досрочно" : "Close claim early"}</div>
              <div className="text-[10px] text-zinc-500">{lang === "ru" ? "Остаток немедленно возвращается в prize vault" : "Remaining balance immediately returns to prize vault"}</div>
              <div className="flex gap-2 items-center">
              <button onClick={() => {
                if (!confirm(lang === "ru" ? "Поставить закрытие клейма в очередь?" : "Queue closing the claim window?")) return;
                queueAdminTx("queue_close_claim", { function: `${MODULE_ADDRESS}::claim::queue_close_claim`, typeArguments: [], functionArguments: [] });
              }} disabled={adminBusy !== null || !claimState?.active}
                className="rounded-xl bg-red-800/80 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-40 transition">
                {adminBusy === "queue_close_claim" ? "…" : (lang === "ru" ? "🕒 В очередь" : "🕒 Queue")}
              </button>
              <button onClick={() => {
                if (!confirm(lang === "ru" ? "Закрыть клейм? Остаток вернётся в prize vault." : "Close claim? Remainder returns to prize vault.")) return;
                adminTx("close_claim", { function: `${MODULE_ADDRESS}::claim::close_claim`, typeArguments: [], functionArguments: [] });
              }} disabled={adminBusy !== null || !claimState?.active}
                className="rounded-xl bg-red-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40 transition">
                {adminBusy === "close_claim" ? "…" : (lang === "ru" ? "⏹ Закрыть клейм" : "⏹ Close claim")}
              </button>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-500/30 p-4 space-y-2" style={{ background: "rgba(254,226,226,0.95)" }}>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#991b1b" }}>⚠️ {lang === "ru" ? "Опасная зона" : "Danger zone"}</div>
            <div className="text-[10px] leading-relaxed" style={{ color: "#b91c1c" }}>
              {lang === "ru"
                ? "Сбрасывает турнир: очищает данные оракула, эпоху, скоры и лиги. Карточки игроков сохраняются. Необратимо."
                : "Resets tournament: clears oracle data, epoch, scores and leagues. Player cards are kept. Irreversible."}
            </div>
            <button onClick={async () => {
              if (!confirm(lang === "ru"
                ? "Хард ресет? Все данные оракула, эпоха и скоры будут удалены. Отменить невозможно."
                : "Hard reset? All oracle data, epoch and scores will be deleted. This cannot be undone.")) return;
              await adminTx("hard_reset", { function: `${MODULE_ADDRESS}::oracle::reset_all_days`, typeArguments: [], functionArguments: [] });
              await adminTx("hard_reset", { function: `${MODULE_ADDRESS}::tournament::stop_and_reset`, typeArguments: [], functionArguments: [] });
              setHeroStats(Array(50).fill(null).map(mkStats));
              setParseStatus("idle");
            }} disabled={adminBusy !== null}
              className="rounded-xl bg-red-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-40 transition">
              {adminBusy === "hard_reset" ? "…" : (lang === "ru" ? "🔴 Хард ресет турнира" : "🔴 Hard reset tournament")}
            </button>
            <AdminTip text={lang === "ru" ? "Полный сброс. NFT-карточки и кошельки игроков НЕ затрагиваются. Необратимо." : "Full reset. Player NFT cards and wallets are NOT affected. Irreversible."} />
          </div>
        </div>
      )}
    </div>
  );
}
