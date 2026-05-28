import { useEffect, useState } from "react";
import type {
  TransactionPayload, TxOptions, HeroStats, ClaimState, PrizeConfig,
  GovernancePolicy, PendingAdminAction, BaseUris, AdminRoleEntry,
} from "../types";
import { getErrorMessage } from "../utils";
import { buildAdminActionMessage, buildWalletFullMessage, stableStringify, MARKET_DATA_PARSE_ACTION } from "@/lib/adminAuth";
import { calcOraclePoints } from "@/lib/oracleScoring";
import { buildMarketDataQuery, resolveOracleWindow } from "@/lib/oracleWindow";

interface Deps {
  submitTx: (p: TransactionPayload, opts?: TxOptions) => Promise<void>;
  refreshTournament: () => Promise<void>;
  restUrl: string;
  moduleAddress: string;
  walletAccount: { publicKey?: unknown } | null | undefined;
  walletSignMessage: (opts: { message: string; nonce: string }) => Promise<unknown>;
  tournamentStartTs?: number | null;
}

export function useAdminLogic({ submitTx, refreshTournament, restUrl, moduleAddress, walletAccount, walletSignMessage, tournamentStartTs }: Deps) {
  function mkStats(): HeroStats { return { priceChg: 0, vol24h: 0, high24h: 0, low24h: 0, tempRatio: 0, hype: false }; }
  function finiteOrZero(value: number): number { return Number.isFinite(value) ? value : 0; }
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
  function unwrapSignedMessage(
    value: unknown,
  ): { signature?: unknown; fullMessage?: unknown } {
    if (!value || typeof value !== "object") return {};
    if ("args" in value && value.args && typeof value.args === "object") {
      return value.args as { signature?: unknown; fullMessage?: unknown };
    }
    return value as { signature?: unknown; fullMessage?: unknown };
  }

  const [adminBusy, setAdminBusy] = useState<string | null>(null);
  const [adminError, setAdminError] = useState("");
  const [adminOk, setAdminOk] = useState("");
  const [governancePolicy, setGovernancePolicy] = useState<GovernancePolicy>({
    initialized: false,
    freezeDuringEpoch: false,
    epochActive: false,
    withdrawEnabled: false,
    perTxLimit: 0,
    dailyLimit: 0,
    spentToday: 0,
    dayIndex: 0,
    actionDelays: Array(11).fill(0),
  });
  const [pendingAdminActions, setPendingAdminActions] = useState<PendingAdminAction[]>([]);
  const [baseUris, setBaseUris] = useState<BaseUris>({ card: "", chest: "" });
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoleEntry[]>([]);
  const [prizeConfig, setPrizeConfig] = useState<PrizeConfig>({
    goldPct: 40, silverPct: 35, bronzePct: 25,
    pos1: 20, pos2: 12, pos3: 8,
    pos4_9: 2, pos10_19: 1.5, pos20_49: 0.8, pos50_99: 0.18,
  });
  const [prizeGenLoading, setPrizeGenLoading] = useState(false);
  const [leagueInfoOpen, setLeagueInfoOpen] = useState(false);
  const [claimState, setClaimState] = useState<ClaimState>(null);
  const [userClaimable, setUserClaimable] = useState<number>(0);
  const [withdrawToClaimAmount, setWithdrawToClaimAmount] = useState("100");
  const [claimListText, setClaimListText] = useState("");
  const [oracleDateInput, setOracleDateInput] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 16);
  });
  const [parseStatus, setParseStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [parseProgress, setParseProgress] = useState(0);
  const [parseTotal, setParseTotal] = useState(50);
  const [parseError, setParseError] = useState("");
  const [heroStats, setHeroStats] = useState<HeroStats[]>(() => Array(50).fill(null).map(mkStats));

  useEffect(() => {
    fetch("/api/leaderboard/config")
      .then(r => r.ok ? r.json() : null)
      .then((v: { prizeConfig?: Partial<PrizeConfig> } | null) => {
        if (v?.prizeConfig) setPrizeConfig(prev => ({ ...prev, ...v.prizeConfig }));
      })
      .catch(() => {});
  }, []);

  async function view<T>(fn: string, args: unknown[] = []): Promise<T | null> {
    try {
      const resp = await fetch(`${restUrl}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: `${moduleAddress}::${fn}`, type_arguments: [], arguments: args }),
      });
      if (!resp.ok) return null;
      const data = await resp.json() as unknown;
      if (data && typeof data === "object" && "value" in data) {
        return (data as { value: T }).value;
      }
      return data as T;
    } catch {
      return null;
    }
  }

  function singleReturnVector(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    if (value.length === 1 && Array.isArray(value[0])) return value[0];
    return value;
  }

  function u8Vector(value: unknown): number[] {
    if (typeof value === "string") {
      const hex = value.startsWith("0x") ? value.slice(2) : value;
      const bytes: number[] = [];
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        if (Number.isFinite(byte)) bytes.push(byte);
      }
      return bytes;
    }
    return singleReturnVector(value).map((item) => Number(item ?? 0));
  }

  function bytesToHex(value: unknown): string {
    if (!Array.isArray(value)) return "";
    return "0x" + value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 0 && item <= 255)
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
  }

  function calcPts(s: HeroStats): number {
    if (!s) return 0;
    return calcOraclePoints({
      priceChg: finiteOrZero(s.priceChg),
      vol24h: finiteOrZero(s.vol24h),
      high24h: finiteOrZero(s.high24h),
      low24h: finiteOrZero(s.low24h),
      tempRatio: finiteOrZero(s.tempRatio),
      hype: s.hype,
    });
  }
  function setHero(pid: number, patch: Partial<HeroStats>) {
    setHeroStats(prev => { const next = [...prev]; next[pid] = { ...next[pid], ...patch }; return next; });
  }
  function getOracleWindow(input: string) {
    return resolveOracleWindow(input, tournamentStartTs);
  }
  function applyMarketData(coins: { pid: number; priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype?: boolean }[]) {
    setHeroStats(prev => {
      const next = [...prev];
      for (const c of coins) next[c.pid] = { ...next[c.pid], priceChg: c.priceChg, vol24h: c.vol24h, high24h: c.high24h, low24h: c.low24h, tempRatio: c.tempRatio, hype: c.hype ?? false };
      return next;
    });
  }

  async function buildAdminAuthBody(): Promise<{ signature: unknown; publicKey: string; fullMessage: unknown }> {
    const timestamp = Date.now();
    const message = `moveinvestor-admin:${timestamp}`;
    const result = await walletSignMessage({ message, nonce: message });
    const publicKey = normalizePublicKey(walletAccount?.publicKey);
    return {
      signature: typeof result === "string" ? result : "",
      publicKey,
      fullMessage: message,
    };
  }

  async function buildSignedAdminAction(action: string, payload: unknown) {
    const nonceResponse = await fetch(`/api/admin/nonce?action=${action}`);
    if (!nonceResponse.ok) throw new Error(`Nonce API ${nonceResponse.status}`);
    const nonceData = await nonceResponse.json() as {
      nonce: string; issuedAt: number; expiresAt: number;
      action: string; domain: string; chainId: number;
    };
    const payloadHashHex = await (async () => {
      const bytes = new TextEncoder().encode(stableStringify(payload));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    })();
    const message = buildAdminActionMessage({
      domain: nonceData.domain, chainId: nonceData.chainId,
      action: nonceData.action, timestamp: nonceData.issuedAt,
      nonce: nonceData.nonce, payloadHash: payloadHashHex,
    });
    const result = await walletSignMessage({ message, nonce: nonceData.nonce });
    return {
      action: nonceData.action, nonce: nonceData.nonce, timestamp: nonceData.issuedAt,
      domain: nonceData.domain, chainId: nonceData.chainId, payloadHash: payloadHashHex,
      signature: typeof result === "string" ? result : "",
      publicKey: normalizePublicKey(walletAccount?.publicKey),
      fullMessage: message,
    };
  }

  async function fetchAllData(dateInput: string) {
    setParseError("");
    const window = getOracleWindow(dateInput);
    const query = buildMarketDataQuery(window);
    try {
      const statusResp = await fetch(`/api/market-data?${query}`);
      if (statusResp.ok) {
        const s = await statusResp.json();
        if (s.state === "done") { applyMarketData(s.data ?? []); setParseStatus("done"); return; }
        if (s.state === "running") {
          setParseStatus("running"); setParseProgress(s.progress ?? 0); setParseTotal(s.total ?? 50);
          void pollJobStatus(window); return;
        }
      }
    } catch {}
    try {
      const auth = await buildSignedAdminAction(MARKET_DATA_PARSE_ACTION, {});
      const startResp = await fetch(`/api/market-data?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth }),
      });
      if (!startResp.ok) {
        const errBody = await startResp.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(`API ${startResp.status}: ${errBody.reason ?? errBody.error ?? ""}`);
      }
      setParseStatus("running"); setParseProgress(0); setParseTotal(50);
      void pollJobStatus(window);
    } catch (e: unknown) { setParseError(getErrorMessage(e)); setParseStatus("error"); }
  }

  async function pollJobStatus(window: ReturnType<typeof getOracleWindow>) {
    const query = buildMarketDataQuery(window);
    for (;;) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const resp = await fetch(`/api/market-data?${query}`);
        if (!resp.ok) continue;
        const s = await resp.json();
        if (s.state === "running") { setParseProgress(s.progress ?? 0); setParseTotal(s.total ?? 50); continue; }
        if (s.state === "done")    { applyMarketData(s.data ?? []); setParseStatus("done"); return; }
        if (s.state === "error")   { setParseError(s.error ?? "unknown error"); setParseStatus("error"); return; }
      } catch {}
    }
  }

  async function adminTx(label: string, payload: TransactionPayload) {
    setAdminBusy(label); setAdminError(""); setAdminOk("");
    try {
      await submitTx(payload);
      setAdminOk(`✓ ${label}`);
      await new Promise(r => setTimeout(r, 600));
      await refreshTournament();
      await fetchClaimState();
      await fetchGovernanceState();
    } catch (e: unknown) { setAdminError(getErrorMessage(e)); }
    finally { setAdminBusy(null); }
  }

  async function fetchClaimState() {
    try {
      const resp = await fetch(`${restUrl}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: `${moduleAddress}::claim::get_claim_state`, type_arguments: [], arguments: [] }),
      });
      if (!resp.ok) return;
      const [rawActive, startTs, deadline, vaultBalance, claimDays] = await resp.json() as [unknown, string, string, string, string];
      const active = rawActive === true || rawActive === "true";
      setClaimState({ active, startTs: Number(startTs), deadline: Number(deadline), vaultBalance: Number(vaultBalance), claimDays: Number(claimDays) });
    } catch {}
  }

  async function fetchGovernanceState() {
    try {
      const [
        initialized,
        actionDelays,
        withdrawPolicy,
        epochGuard,
        pending,
        uris,
        admins,
        roleListRaw,
      ] = await Promise.all([
        view<unknown>("admin_control::is_initialized"),
        view<unknown[]>("admin_control::get_action_delays"),
        view<[unknown, string, string, string, string]>("admin_control::get_withdrawal_policy"),
        view<[unknown, unknown]>("admin_control::get_epoch_guard"),
        view<[unknown, unknown, unknown]>("admin_control::get_pending_actions"),
        view<[string, string]>("fantasy_league::get_base_uris"),
        view<string[]>("fantasy_league::get_admins"),
        view<[string[], string[]]>("admin_control::get_role_list"),
      ]);

      const normalizedActionDelays = singleReturnVector(actionDelays);
      if (normalizedActionDelays.length > 0) {
        setGovernancePolicy((prev) => ({
          ...prev,
          initialized: initialized === true || String(initialized) === "true",
          actionDelays: normalizedActionDelays.map((item) => Number(item ?? 0)),
        }));
      } else {
        setGovernancePolicy((prev) => ({
          ...prev,
          initialized: initialized === true || String(initialized) === "true",
        }));
      }

      if (withdrawPolicy) {
        const [enabled, perTxLimit, dailyLimit, spentToday, dayIndex] = withdrawPolicy;
        setGovernancePolicy((prev) => ({
          ...prev,
          withdrawEnabled: enabled === true || enabled === "true",
          perTxLimit: Number(perTxLimit),
          dailyLimit: Number(dailyLimit),
          spentToday: Number(spentToday),
          dayIndex: Number(dayIndex),
        }));
      }

      if (epochGuard) {
        const [freezeDuringEpoch, epochActive] = epochGuard;
        setGovernancePolicy((prev) => ({
          ...prev,
          freezeDuringEpoch: freezeDuringEpoch === true || freezeDuringEpoch === "true",
          epochActive: epochActive === true || epochActive === "true",
        }));
      }

      if (pending && Array.isArray(pending) && pending.length === 3) {
        const [actionTypes, executeAfters, payloadHashes] = pending;
        const next: PendingAdminAction[] = Array.isArray(actionTypes) && Array.isArray(executeAfters) && Array.isArray(payloadHashes)
          ? actionTypes.map((item, idx) => ({
              actionType: Number(item),
              executeAfter: Number(executeAfters[idx] ?? 0),
              payloadHashHex: bytesToHex(payloadHashes[idx]),
            }))
          : [];
        setPendingAdminActions(next);
      }

      if (Array.isArray(uris) && uris.length >= 2) {
        setBaseUris({ card: String(uris[0] ?? ""), chest: String(uris[1] ?? "") });
      }
      const normalizedAdmins = singleReturnVector(admins)
        .map((item) => String(item))
        .filter((addr) => addr.length > 0);
      if (Array.isArray(admins)) {
        setAdminAddresses(normalizedAdmins);
      }
      if (Array.isArray(roleListRaw) && roleListRaw.length === 2) {
        const [addrs, roles] = roleListRaw;
        const normalizedRoleAddrs = singleReturnVector(addrs)
          .map((item) => String(item))
          .filter((addr) => addr.length > 0);
        const normalizedRoles = u8Vector(roles);
        if (normalizedRoleAddrs.length > 0) {
          setAdminRoles(normalizedRoleAddrs.map((addr, i) => ({ addr, roles: normalizedRoles[i] ?? 0 })));
        } else {
          setAdminRoles([]);
        }
      }
    } catch {
      // ignore view refresh errors in the admin dashboard
    }
  }

  useEffect(() => {
    void fetchGovernanceState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    adminBusy, setAdminBusy, adminError, setAdminError, adminOk, setAdminOk,
    governancePolicy, setGovernancePolicy, pendingAdminActions, baseUris, adminAddresses, adminRoles, fetchGovernanceState,
    prizeConfig, setPrizeConfig, prizeGenLoading, setPrizeGenLoading,
    leagueInfoOpen, setLeagueInfoOpen,
    claimState, setClaimState, userClaimable, setUserClaimable,
    withdrawToClaimAmount, setWithdrawToClaimAmount,
    claimListText, setClaimListText,
    oracleDateInput, setOracleDateInput,
    parseStatus, setParseStatus, parseProgress, parseTotal, parseError, setParseError,
    heroStats, setHeroStats,
    mkStats, calcPts, setHero, getOracleWindow, applyMarketData,
    fetchAllData, pollJobStatus, adminTx, fetchClaimState, buildAdminAuthBody,
  };
}
