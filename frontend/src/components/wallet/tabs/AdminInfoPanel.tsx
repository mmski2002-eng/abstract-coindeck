"use client";

import { useEffect, useState } from "react";
import { ROLE_NAMES, ROLE_FULL } from "../types";
import type { TournamentStateData, GovernancePolicy, PendingAdminAction, BaseUris, AdminRoleEntry } from "../types";
import { CLAIM_VAULT_ADDRESS } from "../constants";

type ClaimState = { active: boolean; startTs: number; deadline: number; vaultBalance: number; claimDays: number } | null;

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

type AdminDirEntry = { addr: string; fullAccess: boolean; roles: number };

type Props = {
  lang: string;
  botStatus: BotStatus | null;
  tnState: TournamentStateData;
  epochRange: [number, number];
  claimState: ClaimState;
  governancePolicy: GovernancePolicy;
  pendingAdminActions: PendingAdminAction[];
  baseUris: BaseUris;
  adminAddresses: string[];
  adminRoles: AdminRoleEntry[];
  adminDirectory: AdminDirEntry[];
  tierMults: number[];
  chestPrices: { wooden: number; iron: number; silver: number };
  lbRows: { addr: string }[];
};

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function fmtMove(wei: number) {
  return (wei / 1e18).toFixed(4);
}

function StatusBadge({ ok, label, pulse }: { ok: boolean; label: string; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold
      ${ok ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
           : "bg-red-500/15 text-red-300 border border-red-500/30"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"} ${pulse && ok ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

function CardShell({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border bg-zinc-900 p-4 h-full flex flex-col ${accent}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, badge }: { icon: string; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{title}</span>
      </div>
      {badge}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className={`text-lg font-black leading-none ${color ?? "text-white"}`}>{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
      {sub && <div className="text-[9px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function MiniChip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${color ?? "bg-white/5 text-zinc-400"}`}>
      {children}
    </span>
  );
}

function TimerUntil({ ts }: { ts: number }) {
  const [left, setLeft] = useState(() => ts - Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setLeft(ts - Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [ts]);
  if (left <= 0) return <span className="text-emerald-400 font-mono font-bold">готово</span>;
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return (
    <span className="font-mono font-bold text-amber-300">
      {h > 0 ? `${h}ч ` : ""}{m > 0 ? `${m}м ` : ""}{s}с
    </span>
  );
}

export function AdminInfoPanel({
  lang, botStatus, tnState, epochRange, claimState,
  governancePolicy, pendingAdminActions, baseUris,
  adminAddresses, adminRoles, adminDirectory, tierMults, chestPrices, lbRows,
}: Props) {
  const ru = lang === "ru";

  const botRunning = botStatus?.state.running ?? false;
  const botEnabled = botStatus?.config.enabled ?? false;
  const pendingTL = botStatus?.state.pendingTimelock;
  const completedDays = botStatus?.state.completedDays ?? [];
  const lastActions = [...completedDays].reverse().slice(0, 5);

  const tnActive = tnState?.active ?? false;
  const tnEnded = tnState?.ended ?? false;
  const epochNum = tnState ? tnState.epoch - epochRange[0] + 1 : null;

  const claimActive = claimState?.active ?? false;

  const govInit = governancePolicy.initialized;

  const roleLabel = (roles: number) => {
    if (roles === ROLE_FULL) return "FULL";
    return ROLE_NAMES.filter(r => (roles & r.bit) !== 0).map(r => r.label).join(" · ") || "—";
  };

  const timelockLabels: Record<number, string> = {
    1: "oracle", 2: "treasury", 3: "nft", 4: "claim",
    5: "set_admin", 6: "remove_admin", 7: "set_roles",
  };

  const botStatusLabel = botRunning
    ? (ru ? "Работает" : "Running")
    : botEnabled ? (ru ? "Ожидает" : "Idle")
    : (ru ? "Отключён" : "Disabled");

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-zinc-900 p-4 space-y-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-indigo-500/20" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/70">
          {ru ? "Информационная панель" : "Status dashboard"}
        </span>
        <div className="h-px flex-1 bg-indigo-500/20" />
      </div>

      {/* Ряд 1: Бот + Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">

      {/* А) БОТ */}
      <CardShell accent="border-indigo-500/25">
        <CardHeader
          icon="🤖"
          title={ru ? "Автобот" : "Bot"}
          badge={<StatusBadge ok={botRunning} label={botStatusLabel} pulse />}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
          <Stat
            label={ru ? "Стадия" : "Stage"}
            value={<span className="text-sm font-mono text-cyan-300">{botStatus?.state.stage ?? "—"}</span>}
          />
          <Stat
            label={ru ? "Режим" : "Mode"}
            value={
              <span className={`text-sm font-mono ${botStatus?.config.mode === "auto" ? "text-violet-300" : "text-zinc-400"}`}>
                {botStatus?.config.mode?.toUpperCase() ?? "—"}
              </span>
            }
          />
          <Stat
            label={ru ? "День бота" : "Bot day"}
            value={botStatus?.state.currentDay ?? "—"}
            color="text-white"
          />
          <Stat
            label={ru ? "Кошелёк" : "Wallet"}
            value={
              botStatus?.wallet.configured
                ? <span className="text-sm text-emerald-300">{ru ? "Готов" : "Ready"}</span>
                : <span className="text-sm text-amber-300">{ru ? "Нет ключа" : "No key"}</span>
            }
          />
        </div>

        {botStatus?.state.message && (
          <div className="mb-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2 text-[11px] text-zinc-400">
            {botStatus.state.message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lastActions.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <div className="text-[10px] font-semibold text-zinc-500 mb-2">
                {ru ? "Последние дни" : "Recent days"}
              </div>
              <div className="flex flex-wrap gap-1">
                {lastActions.map((d) => (
                  <span key={d} className="rounded-md bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                    {ru ? "д" : "d"}{d}
                  </span>
                ))}
              </div>
              {botStatus?.state.lastRunAt && (
                <div className="mt-2 text-[9px] text-zinc-600">
                  {ru ? "Последний запуск" : "Last run"}: {fmt(botStatus.state.lastRunAt)}
                </div>
              )}
            </div>
          )}

          {pendingTL ? (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
              <div className="text-[10px] font-semibold text-amber-400 mb-1">
                ⏳ {ru ? "Ожидает таймлок" : "Pending timelock"}
              </div>
              <div className="text-sm font-bold text-white">{pendingTL.directLabel || pendingTL.action}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                {ru ? "Через" : "In"}: <TimerUntil ts={pendingTL.executeAfter} />
              </div>
              <div className="mt-1 text-[9px] text-zinc-600">{fmt(pendingTL.executeAfter)}</div>
            </div>
          ) : !botRunning && botStatus && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <div className="text-[10px] font-semibold text-zinc-500 mb-1">
                {ru ? "Следующий шаг" : "Next step"}
              </div>
              <div className="text-[11px] text-zinc-300">{botStatus.state.message || "—"}</div>
            </div>
          )}
        </div>

        {botStatus?.state.lastError && (
          <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-[11px] text-red-300 break-all">
            ⚠ {botStatus.state.lastError}
          </div>
        )}
      </CardShell>

      {/* Г) GOVERNANCE */}
      <CardShell accent="border-indigo-500/25">
        <CardHeader icon="🛡️" title={ru ? "Governance & защита" : "Governance"} />

        {!govInit ? (
          <div className="text-[11px] text-zinc-600">{ru ? "Не инициализирована" : "Not initialized"}</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <MiniChip color={governancePolicy.epochActive ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-white/5"}>
                {ru ? "Эпоха" : "Epoch"}: {governancePolicy.epochActive ? (ru ? "активна" : "active") : (ru ? "нет" : "off")}
              </MiniChip>
              <MiniChip color={governancePolicy.withdrawEnabled ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-red-500/15 text-red-300 border border-red-500/20"}>
                {ru ? "Вывод" : "Withdraw"}: {governancePolicy.withdrawEnabled ? (ru ? "открыт" : "open") : (ru ? "закрыт" : "locked")}
              </MiniChip>
              <MiniChip color={governancePolicy.freezeDuringEpoch ? "bg-amber-500/15 text-amber-300 border border-amber-500/20" : "bg-zinc-800 text-zinc-500 border border-white/5"}>
                {ru ? "Заморозка в эпоху" : "Freeze in epoch"}: {governancePolicy.freezeDuringEpoch ? (ru ? "вкл" : "on") : (ru ? "выкл" : "off")}
              </MiniChip>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <div className="text-base font-black text-white font-mono">{fmtMove(governancePolicy.perTxLimit)}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{ru ? "лимит / tx" : "limit / tx"} ETH</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <div className="text-base font-black text-white font-mono">{fmtMove(governancePolicy.dailyLimit)}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{ru ? "лимит / день" : "limit / day"} ETH</div>
              </div>
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 text-center">
                <div className="text-base font-black text-amber-300 font-mono">{fmtMove(governancePolicy.spentToday)}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{ru ? "потрачено сегодня" : "spent today"} ETH</div>
              </div>
            </div>
          </>
        )}

        <div className="space-y-3 mt-1">
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="text-[10px] font-semibold text-zinc-500 mb-2">
              {ru ? "Кошельки-админы" : "Admin wallets"} ({adminDirectory.length})
            </div>
            {adminDirectory.length === 0 ? (
              <div className="text-[10px] text-zinc-600">{ru ? "Загрузка…" : "Loading…"}</div>
            ) : (
              <div className="space-y-2">
                {adminDirectory.map(entry => (
                  <div key={entry.addr} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[10px] text-zinc-300 break-all">{entry.addr}</span>
                      {entry.fullAccess && (
                        <span className="shrink-0 rounded bg-violet-500/20 border border-violet-500/30 px-1.5 py-0.5 text-[9px] font-bold text-violet-300">FULL</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ROLE_NAMES.map(role => (
                        <span key={role.key} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${(entry.roles & role.bit) ? "bg-emerald-700/50 text-emerald-200" : "bg-white/5 text-zinc-600"}`}>
                          {role.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendingAdminActions.length > 0 && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3">
              <div className="text-[10px] font-semibold text-amber-400 mb-2">
                ⏳ {ru ? "Очередь таймлок" : "Timelock queue"} ({pendingAdminActions.length})
              </div>
              <div className="space-y-1.5">
                {pendingAdminActions.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-amber-300">{timelockLabels[a.actionType] ?? `#${a.actionType}`}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{fmt(a.executeAfter)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardShell>

      </div>{/* /Ряд 1 */}

      {/* Ряд 2: Клейм + Турнир */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">

      {/* В) КЛЕЙМ */}
      <CardShell accent="border-indigo-500/25">
        <CardHeader
          icon="💰"
          title={ru ? "Клейм" : "Claim"}
          badge={
            <StatusBadge
              ok={claimActive}
              label={claimState == null ? "—" : claimActive ? (ru ? "Запущен" : "Active") : (ru ? "Не запущен" : "Inactive")}
            />
          }
        />

        {/* Баланс + временные метки */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex flex-col justify-between">
            <div className="text-[10px] text-zinc-500 mb-1">{ru ? "Баланс клейм-кошелька" : "Vault balance"}</div>
            <div>
              <span className="text-2xl font-black text-emerald-300">{claimState ? fmtMove(claimState.vaultBalance) : "—"}</span>
              <span className="text-sm text-zinc-500 ml-1">MOVE</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{ru ? "Запущен" : "Started"}</span>
              {claimState && claimState.startTs > 0 ? (
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-zinc-300">
                    {new Date(claimState.startTs * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {new Date(claimState.startTs * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ) : <span className="text-[11px] text-zinc-600">—</span>}
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{ru ? "Дедлайн" : "Deadline"}</span>
              {claimState && claimState.deadline > 0 ? (
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-amber-300">
                    {new Date(claimState.deadline * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {new Date(claimState.deadline * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ) : <span className="text-[11px] text-zinc-600">—</span>}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{ru ? "Участников в лидерборде" : "Leaderboard"}</span>
              <span className="text-lg font-black text-white">{lbRows.length}</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{ru ? "Допущено к клейму" : "Eligible"}</span>
              <span className="text-lg font-black text-emerald-300">
                {botStatus?.state.lastClaimList ? botStatus.state.lastClaimList.entries : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Клейм-лист инфо */}
        {botStatus?.state.lastClaimList && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500">
            <span>{ru ? "Сумма клейм-листа" : "Total in list"}:
              <span className="ml-1 font-mono text-zinc-300">{fmtMove(botStatus.state.lastClaimList.totalOctas)} ETH</span>
            </span>
            <span>{ru ? "Список создан" : "Generated"}:
              <span className="ml-1 font-mono text-zinc-400">{fmt(botStatus.state.lastClaimList.generatedAt)}</span>
            </span>
            <span>{ru ? "Дней клейма" : "Claim days"}:
              <span className="ml-1 font-mono text-zinc-300">{claimState?.claimDays ?? "—"}</span>
            </span>
          </div>
        )}
      </CardShell>

      {/* Б) ТУРНИР */}
      <CardShell accent="border-indigo-500/25">
        <CardHeader
          icon="🏆"
          title={ru ? "Турнир" : "Tournament"}
          badge={
            <StatusBadge
              ok={tnActive && !tnEnded}
              label={tnState == null ? "—" : tnEnded ? (ru ? "Завершён" : "Ended") : tnActive ? (ru ? "Активен" : "Active") : (ru ? "Не начат" : "Inactive")}
            />
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label={ru ? "День" : "Day"} value={tnState?.currentDay ?? "—"} sub={tnState ? `/ ${tnState.totalDays}` : ""} />
          <Stat label={ru ? "Эпоха" : "Epoch"} value={epochNum ?? "—"} />
          <Stat label={ru ? "Призовой пул" : "Prize pool"} value={tnState ? fmtMove(tnState.prizePool) : "—"} sub="ETH" />
          <Stat label={ru ? "Участники" : "Players"} value={lbRows.length} />
        </div>
      </CardShell>

      </div>{/* /Ряд 2 */}

      {/* Д) URI / ЦЕНЫ / МНОЖИТЕЛИ */}
      <CardShell accent="border-indigo-500/25">
        <CardHeader icon="⚙️" title={ru ? "URI · Цены · Тиры" : "URIs · Prices · Tiers"} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="text-[9px] font-semibold text-zinc-600 mb-1.5">CARD URI</div>
            <div className="font-mono text-[10px] text-zinc-400 break-all leading-relaxed">{baseUris.card || "—"}</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="text-[9px] font-semibold text-zinc-600 mb-1.5">CHEST URI</div>
            <div className="font-mono text-[10px] text-zinc-400 break-all leading-relaxed">{baseUris.chest || "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="text-[9px] font-semibold text-zinc-600 mb-2">{ru ? "Цены сундуков" : "Chest prices"}</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { icon: "🐹", label: ru ? "Хомяк" : "Hamster", val: chestPrices.wooden },
                { icon: "🐻", label: ru ? "Медведь" : "Bear", val: chestPrices.iron },
                { icon: "🐂", label: ru ? "Бык" : "Bull", val: chestPrices.silver },
              ] as const).map(({ icon, label, val }) => (
                <div key={label} className="rounded-lg bg-black/30 border border-white/5 p-2 text-center">
                  <div className="text-lg leading-none">{icon}</div>
                  <div className="mt-1 font-mono text-[11px] font-bold text-white">{(val / 1e18).toFixed(4)}</div>
                  <div className="text-[9px] text-zinc-600">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {tierMults.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <div className="text-[9px] font-semibold text-zinc-600 mb-2">{ru ? "Множители тиров" : "Tier multipliers"}</div>
              <div className="flex flex-wrap gap-1.5">
                {tierMults.map((m, i) => (
                  <div key={i} className="rounded-lg bg-black/30 border border-white/5 px-2.5 py-1.5 text-center min-w-[44px]">
                    <div className="font-mono text-sm font-black text-white">{m}<span className="text-[10px] text-zinc-500">×</span></div>
                    <div className="text-[9px] text-zinc-600">T{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </CardShell>
    </div>
  );
}
