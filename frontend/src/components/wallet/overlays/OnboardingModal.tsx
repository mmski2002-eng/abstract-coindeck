"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { getErrorMessage } from "../utils";

const MAX_NICKNAME_BYTES = 14;

function getNicknameByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export function OnboardingModal({
  onCreateAccount,
  busy,
  lang,
  tierMults,
}: {
  onCreateAccount: (nickname: string) => Promise<void>;
  busy: boolean;
  lang: string;
  tierMults: number[];
}) {
  const [step, setStep] = useState(0);
  const [nick, setNick] = useState("");
  const [err, setErr] = useState("");

  const ru = lang === "ru";
  const mult = (tier: number) => ((tierMults[tier] ?? [100, 140, 190, 250][tier] ?? 100) / 100).toFixed(2).replace(/\.?0+$/, "");
  const STEPS = [
    {
      icon: "🚀",
      title: ru ? "Добро пожаловать в HeavyEggs" : "Welcome to HeavyEggs",
      body: ru
        ? "Крипто-фэнтези лига на блокчейне Movement.\nСобирай карточки топ-50 криптовалют, составляй команду и побеждай в ежедневных турнирах."
        : "A crypto fantasy league on the Movement blockchain.\nCollect cards of top-50 crypto coins, build your team, and win daily tournaments.",
    },
    {
      icon: "🃏",
      title: ru ? "Карточки и тиры" : "Cards & Tiers",
      body: ru
        ? `Каждая карточка — это реальная криптовалюта.\n\n🐹 Common — ×${mult(0)} к очкам\n🐻 Rare — ×${mult(1)} к очкам\n🐂 Epic — ×${mult(2)} к очкам\n🐋 Legendary — ×${mult(3)} к очкам\n\nРедкие карты множат твои очки за турнир.`
        : `Each card is a real cryptocurrency.\n\n🐹 Common — ×${mult(0)} score\n🐻 Rare — ×${mult(1)} score\n🐂 Epic — ×${mult(2)} score\n🐋 Legendary — ×${mult(3)} score\n\nRarer cards multiply your tournament score.`,
    },
    {
      icon: "📦",
      title: ru ? "Сундуки" : "Chests",
      body: ru
        ? "Покупай сундуки за ABS токены и открывай карточки:\n\n🐹 Сундук хомяка — Common карты\n🐻 Сундук медведя — Rare и выше\n🐂 Сундук быка — Epic и выше\n\nНакопи 5 одинаковых карт — объедини их в карту тира выше."
        : "Buy chests with ABS tokens to get cards:\n\n🐹 Hamster Chest — Common cards\n🐻 Bear Chest — Rare and above\n🐂 Bull Chest — Epic and above\n\nCollect 5 identical cards and merge them into the next tier.",
    },
    {
      icon: "🏆",
      title: ru ? "Турниры" : "Tournaments",
      body: ru
        ? "Каждый день выбирай 5 карточек в состав.\nОчки начисляются по реальным данным рынка:\n\n📈 Изменение цены (до ±300 очков)\n📊 Объём торгов (до +100)\n⚡ Волатильность (до +100)\n💻 Активность GitHub (до +100)\n\nТоп инвесторы получают ETH в конце турнира."
        : "Each day pick 5 cards for your lineup.\nPoints are scored from real market data:\n\n📈 Price change (up to ±300 pts)\n📊 Trading volume (up to +100)\n⚡ Volatility (up to +100)\n💻 GitHub activity (up to +100)\n\nTop investors earn ETH at tournament end.",
    },
    {
      icon: "👤",
      title: ru ? "Создай аккаунт" : "Create your account",
      body: ru
        ? "Придумай никнейм и создай аккаунт.\nОн запишется в твой браузер — другие игроки увидят его в лидерборде."
        : "Choose a nickname and create your account.\nIt will be saved in your browser and shown to others on the leaderboard.",
    },
  ];

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;
  const nickBytes = getNicknameByteLength(nick);

  async function handleCreate() {
    if (!nick.trim()) { setErr(ru ? "Введи никнейм" : "Enter a nickname"); return; }
    if (getNicknameByteLength(nick.trim()) > MAX_NICKNAME_BYTES) {
      setErr(ru ? "Никнейм слишком длинный: до 7 русских или 14 латинских букв" : "Nickname is too long: up to 7 Cyrillic or 14 Latin characters");
      return;
    }
    setErr("");
    try {
      await onCreateAccount(nick.trim());
    } catch (e: unknown) { setErr(getErrorMessage(e)); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "var(--overlay-backdrop)" }}>
      <div className="card-sticker relative w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "var(--modal-bg)" }}>
        <div className="h-1 w-full" style={{ background: "var(--sunken)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{ background: "var(--mint)", width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-5xl">{current.icon}</div>
            <div className="text-xl font-black" style={{ color: "var(--panel-text)" }}>{current.title}</div>
          </div>

          <div className="rounded-2xl p-4 text-sm whitespace-pre-line leading-relaxed" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)", color: "var(--panel-text-muted)" }}>
            {current.body}
          </div>

          {isLast && (
            <div className="space-y-2">
              <input
                type="text"
                value={nick}
                onChange={e => {
                  const v = e.target.value;
                  if (getNicknameByteLength(v) <= MAX_NICKNAME_BYTES) { setNick(v); setErr(""); }
                }}
                placeholder={ru ? "Твой никнейм…" : "Your nickname…"}
                maxLength={14}
                className="input-sticker w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <div className="flex items-center justify-between">
                {err && <div className="text-xs" style={{ color: "var(--down)" }}>{err}</div>}
                <div
                  className="ml-auto text-[10px] tabular-nums"
                  style={{ color: nickBytes >= MAX_NICKNAME_BYTES - 2 ? "var(--warn)" : "var(--ink-3)" }}
                >
                  {nickBytes}/{MAX_NICKNAME_BYTES}
                </div>
              </div>
              <a
                href="https://faucet.movementnetwork.xyz/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 w-full rounded-xl px-3.5 py-2.5 transition"
                style={{ background: "var(--mint-soft)", border: "1.5px solid var(--outline)" }}
              >
                <span className="inline-flex h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--mint)", border: "1px solid var(--outline)" }} />
                <span className="text-[11px] font-black uppercase tracking-[0.25em] transition" style={{ color: "var(--ink)" }}>
                  FAUCET
                </span>
                <span className="text-[11px] transition" style={{ color: "var(--ink-3)" }}>
                  {ru ? "— нужны тестовые ABS для старта" : "— get test ABS to get started"}
                </span>
              </a>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-6" : "w-1.5"}`}
                  style={{ background: i <= step ? "var(--mint)" : "var(--sunken)", opacity: i < step ? 0.55 : 1 }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="btn-sticker-outline rounded-xl px-4 py-2 text-sm transition">
                  {ru ? "Назад" : "Back"}
                </button>
              )}
              {isLast ? (
                <button onClick={handleCreate} disabled={busy}
                  className="btn-sticker-primary rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50 transition">
                  {busy ? "…" : (ru ? "🚀 Создать аккаунт" : "🚀 Create account")}
                </button>
              ) : (
                <button onClick={() => setStep(s => s + 1)}
                  className="btn-sticker-secondary rounded-xl px-5 py-2 text-sm font-semibold transition">
                  {ru ? "Далее →" : "Next →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
