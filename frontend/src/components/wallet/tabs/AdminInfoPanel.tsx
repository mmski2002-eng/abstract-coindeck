"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ROLE_FULL, ROLE_NAMES } from "../types";
import type { AdminRoleEntry, BaseUris, GovernancePolicy, PendingAdminAction, TournamentStateData } from "../types";

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
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtEth(wei: number) {
  return (wei / 1e18).toFixed(4);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function panelStyle(background = "var(--card)") {
  return {
    background,
    border: "2px solid var(--outline)",
    boxShadow: "var(--shadow-sticker-sm)",
  };
}

function StatusBadge({ ok, label, pulse }: { ok: boolean; label: string; pulse?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={panelStyle(ok ? "var(--mint-soft)" : "var(--down-soft)")}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pulse && ok ? "animate-pulse" : ""}`} style={{ background: ok ? "var(--up)" : "var(--down)" }} />
      <span style={{ color: ok ? "var(--ink)" : "var(--down)" }}>{label}</span>
    </span>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="card-sticker flex h-full flex-col rounded-2xl p-4" style={{ background: "var(--card)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, badge }: { icon: string; title: string; badge?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="truncate text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>{title}</span>
      </div>
      {badge}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-lg font-black leading-none" style={{ color: "var(--panel-text)" }}>{value}</div>
      <div className="text-[10px]" style={{ color: "var(--ink-3)" }}>{label}</div>
      {sub && <div className="text-[9px]" style={{ color: "var(--nft-muted)" }}>{sub}</div>}
    </div>
  );
}

function MiniChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "down" }) {
  const bg = tone === "ok" ? "var(--mint-soft)" : tone === "warn" ? "var(--warn-soft)" : tone === "down" ? "var(--down-soft)" : "var(--sunken)";
  const color = tone === "down" ? "var(--down)" : "var(--ink)";
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ ...panelStyle(bg), color, boxShadow: "none" }}>
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

  if (left <= 0) return <span className="font-mono font-bold" style={{ color: "var(--up)" }}>готово</span>;

  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return (
    <span className="font-mono font-bold" style={{ color: "var(--warn)" }}>
      {h > 0 ? `${h}ч ` : ""}{m > 0 ? `${m}м ` : ""}{s}с
    </span>
  );
}

export function AdminInfoPanel({
  lang,
  botStatus,
  tnState,
  epochRange,
  claimState,
  governancePolicy,
  pendingAdminActions,
  baseUris,
  adminAddresses,
  adminRoles,
  adminDirectory,
  tierMults,
  chestPrices,
  lbRows,
}: Props) {
  const ru = lang === "ru";

  const botRunning = botStatus?.state.running ?? false;
  const botEnabled = botStatus?.config.enabled ?? false;
  const pendingTL = botStatus?.state.pendingTimelock;
  const completedDays = botStatus?.state.completedDays ?? [];
  const lastActions = [...completedDays].reverse().slice(0, 5);
  const claimActive = claimState?.active ?? false;
  const tnActive = tnState?.active ?? false;
  const tnEnded = tnState?.ended ?? false;
  const epochNum = tnState ? tnState.epoch - epochRange[0] + 1 : null;

  const roleLabel = (roles: number) => {
    if (roles === ROLE_FULL) return "FULL";
    return ROLE_NAMES.filter((role) => (roles & role.bit) !== 0).map((role) => role.label).join(" · ") || "—";
  };

  const botStatusLabel = botRunning
    ? (ru ? "Работает" : "Running")
    : botEnabled ? (ru ? "Ожидает" : "Idle")
      : (ru ? "Отключён" : "Disabled");

  return (
    <div className="card-sticker mb-4 space-y-3 rounded-2xl p-4" style={{ background: "var(--paper-2)" }}>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: "var(--divider)" }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>
          {ru ? "Информационная панель" : "Status dashboard"}
        </span>
        <div className="h-px flex-1" style={{ background: "var(--divider)" }} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <CardShell>
          <CardHeader icon="🤖" title={ru ? "Автобот" : "Bot"} badge={<StatusBadge ok={botRunning} label={botStatusLabel} pulse />} />

          <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={ru ? "Стадия" : "Stage"} value={<span className="font-mono text-sm">{botStatus?.state.stage ?? "—"}</span>} />
            <Stat label={ru ? "Режим" : "Mode"} value={<span className="font-mono text-sm">{botStatus?.config.mode?.toUpperCase() ?? "—"}</span>} />
            <Stat label={ru ? "День" : "Day"} value={botStatus?.state.currentDay ?? "—"} />
            <Stat label={ru ? "Кошелёк" : "Wallet"} value={botStatus?.wallet.configured ? (ru ? "Готов" : "Ready") : (ru ? "Нет ключа" : "No key")} />
          </div>

          {botStatus?.state.message && (
            <div className="mb-3 rounded-xl px-3 py-2 text-[11px]" style={{ ...panelStyle("var(--sunken)"), color: "var(--panel-text-muted)" }}>
              {botStatus.state.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lastActions.length > 0 && (
              <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
                <div className="mb-2 text-[10px] font-semibold" style={{ color: "var(--ink-3)" }}>{ru ? "Последние дни" : "Recent days"}</div>
                <div className="flex flex-wrap gap-1">
                  {lastActions.map((day) => <MiniChip key={day} tone="ok">{ru ? "д" : "d"}{day}</MiniChip>)}
                </div>
                {botStatus?.state.lastRunAt && (
                  <div className="mt-2 text-[9px]" style={{ color: "var(--nft-muted)" }}>
                    {ru ? "Последний запуск" : "Last run"}: {fmt(botStatus.state.lastRunAt)}
                  </div>
                )}
              </div>
            )}

            {pendingTL ? (
              <div className="rounded-xl p-3" style={panelStyle("var(--warn-soft)")}>
                <div className="mb-1 text-[10px] font-semibold" style={{ color: "var(--warn)" }}>⏳ {ru ? "Ожидает timelock" : "Pending timelock"}</div>
                <div className="text-sm font-bold" style={{ color: "var(--panel-text)" }}>{pendingTL.directLabel || pendingTL.action}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                  {ru ? "Через" : "In"}: <TimerUntil ts={pendingTL.executeAfter} />
                </div>
                <div className="mt-1 text-[9px]" style={{ color: "var(--nft-muted)" }}>{fmt(pendingTL.executeAfter)}</div>
              </div>
            ) : botStatus ? (
              <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
                <div className="mb-1 text-[10px] font-semibold" style={{ color: "var(--ink-3)" }}>{ru ? "Следующий шаг" : "Next step"}</div>
                <div className="text-[11px]" style={{ color: "var(--panel-text-muted)" }}>{botStatus.state.message || "—"}</div>
              </div>
            ) : null}
          </div>

          {botStatus?.state.lastError && (
            <div className="mt-3 rounded-xl p-3 text-[11px] break-all" style={{ ...panelStyle("var(--down-soft)"), color: "var(--down)" }}>
              ⚠ {botStatus.state.lastError}
            </div>
          )}
        </CardShell>

        <CardShell>
          <CardHeader icon="🛡️" title={ru ? "Governance и защита" : "Governance"} />

          {!governancePolicy.initialized ? (
            <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{ru ? "Не инициализирована" : "Not initialized"}</div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <MiniChip tone={governancePolicy.epochActive ? "ok" : "neutral"}>{ru ? "Эпоха" : "Epoch"}: {governancePolicy.epochActive ? (ru ? "активна" : "active") : (ru ? "нет" : "off")}</MiniChip>
                <MiniChip tone={governancePolicy.withdrawEnabled ? "ok" : "down"}>{ru ? "Вывод" : "Withdraw"}: {governancePolicy.withdrawEnabled ? (ru ? "открыт" : "open") : (ru ? "закрыт" : "locked")}</MiniChip>
                <MiniChip tone={governancePolicy.freezeDuringEpoch ? "warn" : "neutral"}>{ru ? "Заморозка" : "Freeze"}: {governancePolicy.freezeDuringEpoch ? (ru ? "вкл" : "on") : (ru ? "выкл" : "off")}</MiniChip>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={panelStyle("var(--sunken)")}>
                  <div className="font-mono text-base font-black" style={{ color: "var(--panel-text)" }}>{fmtEth(governancePolicy.perTxLimit)}</div>
                  <div className="mt-0.5 text-[9px]" style={{ color: "var(--ink-3)" }}>{ru ? "лимит / tx" : "limit / tx"} ETH</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={panelStyle("var(--sunken)")}>
                  <div className="font-mono text-base font-black" style={{ color: "var(--panel-text)" }}>{fmtEth(governancePolicy.dailyLimit)}</div>
                  <div className="mt-0.5 text-[9px]" style={{ color: "var(--ink-3)" }}>{ru ? "лимит / день" : "limit / day"} ETH</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={panelStyle("var(--warn-soft)")}>
                  <div className="font-mono text-base font-black" style={{ color: "var(--warn)" }}>{fmtEth(governancePolicy.spentToday)}</div>
                  <div className="mt-0.5 text-[9px]" style={{ color: "var(--ink-3)" }}>{ru ? "потрачено сегодня" : "spent today"} ETH</div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-3">
            <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
              <div className="mb-2 text-[10px] font-semibold" style={{ color: "var(--ink-3)" }}>
                {ru ? "Кошельки-админы" : "Admin wallets"} ({adminDirectory.length || adminAddresses.length || adminRoles.length})
              </div>
              {adminDirectory.length === 0 ? (
                <div className="text-[10px]" style={{ color: "var(--nft-muted)" }}>{ru ? "Загрузка…" : "Loading…"}</div>
              ) : (
                <div className="space-y-2">
                  {adminDirectory.map((entry) => (
                    <div key={entry.addr} className="rounded-lg px-3 py-2" style={panelStyle("var(--paper-3)")}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-mono text-[10px] break-all" style={{ color: "var(--panel-text-muted)" }}>{shortAddr(entry.addr)}</span>
                        {entry.fullAccess && <MiniChip tone="warn">FULL</MiniChip>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_NAMES.map((role) => (
                          <MiniChip key={role.key} tone={(entry.roles & role.bit) ? "ok" : "neutral"}>{role.label}</MiniChip>
                        ))}
                      </div>
                      <div className="mt-1 text-[9px]" style={{ color: "var(--nft-muted)" }}>{roleLabel(entry.roles)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pendingAdminActions.length > 0 && (
              <div className="rounded-xl p-3" style={panelStyle("var(--warn-soft)")}>
                <div className="mb-2 text-[10px] font-semibold" style={{ color: "var(--warn)" }}>⏳ {ru ? "Очередь timelock" : "Timelock queue"} ({pendingAdminActions.length})</div>
                <div className="space-y-1.5">
                  {pendingAdminActions.map((action, index) => (
                    <div key={`${action.actionType}-${action.payloadHashHex}-${index}`} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px]" style={{ color: "var(--ink)" }}>#{action.actionType}</span>
                      <span className="font-mono text-[9px]" style={{ color: "var(--ink-3)" }}>{fmt(action.executeAfter)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardShell>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <CardShell>
          <CardHeader
            icon="💰"
            title={ru ? "Клейм" : "Claim"}
            badge={<StatusBadge ok={claimActive} label={claimState == null ? "—" : claimActive ? (ru ? "Запущен" : "Active") : (ru ? "Не запущен" : "Inactive")} />}
          />

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl p-3" style={panelStyle("var(--mint-soft)")}>
              <div className="mb-1 text-[10px]" style={{ color: "var(--ink-3)" }}>{ru ? "Баланс клейм-кошелька" : "Vault balance"}</div>
              <span className="text-2xl font-black" style={{ color: "var(--up)" }}>{claimState ? fmtEth(claimState.vaultBalance) : "—"}</span>
              <span className="ml-1 text-sm" style={{ color: "var(--ink-3)" }}>ETH</span>
            </div>

            <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
              <div className="mb-1 text-[10px]" style={{ color: "var(--ink-3)" }}>{ru ? "Запущен" : "Started"}</div>
              <div className="font-mono text-[11px]" style={{ color: "var(--panel-text-muted)" }}>{claimState?.startTs ? fmt(claimState.startTs) : "—"}</div>
              <div className="mt-2 text-[10px]" style={{ color: "var(--ink-3)" }}>{ru ? "Дедлайн" : "Deadline"}</div>
              <div className="font-mono text-[11px]" style={{ color: "var(--warn)" }}>{claimState?.deadline ? fmt(claimState.deadline) : "—"}</div>
            </div>

            <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>{ru ? "Лидерборд" : "Leaderboard"}</span>
                <span className="text-lg font-black" style={{ color: "var(--panel-text)" }}>{lbRows.length}</span>
              </div>
              <div className="my-2 h-px" style={{ background: "var(--divider)" }} />
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>{ru ? "К клейму" : "Eligible"}</span>
                <span className="text-lg font-black" style={{ color: "var(--up)" }}>{botStatus?.state.lastClaimList?.entries ?? "—"}</span>
              </div>
            </div>
          </div>

          {botStatus?.state.lastClaimList && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]" style={{ color: "var(--ink-3)" }}>
              <span>{ru ? "Сумма" : "Total"}: <span className="font-mono" style={{ color: "var(--panel-text-muted)" }}>{fmtEth(botStatus.state.lastClaimList.totalOctas)} ETH</span></span>
              <span>{ru ? "Создан" : "Generated"}: <span className="font-mono" style={{ color: "var(--panel-text-muted)" }}>{fmt(botStatus.state.lastClaimList.generatedAt)}</span></span>
              <span>{ru ? "Дней" : "Days"}: <span className="font-mono" style={{ color: "var(--panel-text-muted)" }}>{claimState?.claimDays ?? "—"}</span></span>
            </div>
          )}
        </CardShell>

        <CardShell>
          <CardHeader
            icon="🏆"
            title={ru ? "Турнир" : "Tournament"}
            badge={<StatusBadge ok={tnActive && !tnEnded} label={tnState == null ? "—" : tnEnded ? (ru ? "Завершён" : "Ended") : tnActive ? (ru ? "Активен" : "Active") : (ru ? "Не начат" : "Inactive")} />}
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={ru ? "День" : "Day"} value={tnState?.currentDay ?? "—"} sub={tnState ? `/ ${tnState.totalDays}` : ""} />
            <Stat label={ru ? "Эпоха" : "Epoch"} value={epochNum ?? "—"} />
            <Stat label={ru ? "Призовой пул" : "Prize pool"} value={tnState ? fmtEth(tnState.prizePool) : "—"} sub="ETH" />
            <Stat label={ru ? "Игроки" : "Players"} value={lbRows.length} />
          </div>
        </CardShell>
      </div>

      <CardShell>
        <CardHeader icon="⚙️" title={ru ? "URI · Цены · Тиры" : "URIs · Prices · Tiers"} />

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
            <div className="mb-1.5 text-[9px] font-semibold" style={{ color: "var(--ink-3)" }}>CARD URI</div>
            <div className="font-mono text-[10px] break-all leading-relaxed" style={{ color: "var(--panel-text-muted)" }}>{baseUris.card || "—"}</div>
          </div>
          <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
            <div className="mb-1.5 text-[9px] font-semibold" style={{ color: "var(--ink-3)" }}>CHEST URI</div>
            <div className="font-mono text-[10px] break-all leading-relaxed" style={{ color: "var(--panel-text-muted)" }}>{baseUris.chest || "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
            <div className="mb-2 text-[9px] font-semibold" style={{ color: "var(--ink-3)" }}>{ru ? "Цены сундуков" : "Chest prices"}</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { icon: "🐹", label: ru ? "Хомяк" : "Hamster", val: chestPrices.wooden },
                { icon: "🐻", label: ru ? "Медведь" : "Bear", val: chestPrices.iron },
                { icon: "🐂", label: ru ? "Бык" : "Bull", val: chestPrices.silver },
              ] as const).map(({ icon, label, val }) => (
                <div key={label} className="rounded-lg p-2 text-center" style={panelStyle("var(--paper-3)")}>
                  <div className="text-lg leading-none">{icon}</div>
                  <div className="mt-1 font-mono text-[11px] font-bold" style={{ color: "var(--panel-text)" }}>{(val / 1e18).toFixed(4)}</div>
                  <div className="text-[9px]" style={{ color: "var(--ink-3)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {tierMults.length > 0 && (
            <div className="rounded-xl p-3" style={panelStyle("var(--sunken)")}>
              <div className="mb-2 text-[9px] font-semibold" style={{ color: "var(--ink-3)" }}>{ru ? "Множители тиров" : "Tier multipliers"}</div>
              <div className="flex flex-wrap gap-1.5">
                {tierMults.map((multiplier, index) => (
                  <div key={index} className="min-w-[44px] rounded-lg px-2.5 py-1.5 text-center" style={panelStyle("var(--paper-3)")}>
                    <div className="font-mono text-sm font-black" style={{ color: "var(--panel-text)" }}>{multiplier}<span className="text-[10px]" style={{ color: "var(--nft-muted)" }}>×</span></div>
                    <div className="text-[9px]" style={{ color: "var(--ink-3)" }}>T{index + 1}</div>
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
