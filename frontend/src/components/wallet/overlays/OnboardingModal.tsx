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
      title: ru ? "Добро пожаловать в CoinDeck" : "Welcome to CoinDeck",
      body: ru
        ? "Крипто-фэнтези лига на блокчейне Abstract.\nСобирай карточки топ-50 криптовалют, составляй команду и побеждай в ежедневных турнирах."
        : "A crypto fantasy league on the Abstract blockchain.\nCollect cards of top-50 crypto coins, build your team, and win daily tournaments.",
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
        ? "Каждый день выбирай 5 карточек в состав.\nОчки начисляются по реальным данным рынка:\n\n📈 Изменение цены (до ±300 очков)\n📊 Объём торгов (до +100)\n⚡ Волатильность (до +100)\n💻 Активность GitHub (до +100)\n\nТоп инвесторы получают ABS в конце турнира."
        : "Each day pick 5 cards for your lineup.\nPoints are scored from real market data:\n\n📈 Price change (up to ±300 pts)\n📊 Trading volume (up to +100)\n⚡ Volatility (up to +100)\n💻 GitHub activity (up to +100)\n\nTop investors earn ABS at tournament end.",
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-white/5">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-sky-200 transition-all duration-300"
            style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-5xl">{current.icon}</div>
            <div className="text-xl font-black text-white">{current.title}</div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <div className="flex items-center justify-between">
                {err && <div className="text-xs text-red-400">{err}</div>}
                <div className={`ml-auto text-[10px] tabular-nums ${nickBytes >= MAX_NICKNAME_BYTES - 2 ? "text-amber-400" : "text-zinc-600"}`}>
                  {nickBytes}/{MAX_NICKNAME_BYTES}
                </div>
              </div>
              <a
                href="https://faucet.movementnetwork.xyz/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 w-full rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3.5 py-2.5 hover:bg-cyan-500/10 transition group"
              >
                <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-200 group-hover:text-white transition">
                  FAUCET
                </span>
                <span className="text-[11px] text-white/45 group-hover:text-white/65 transition">
                  {ru ? "— нужны тестовые ABS для старта" : "— get test ABS to get started"}
                </span>
              </a>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-cyan-500" : i < step ? "w-1.5 bg-cyan-500/50" : "w-1.5 bg-white/10"}`} />
              ))}
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:text-white transition">
                  {ru ? "Назад" : "Back"}
                </button>
              )}
              {isLast ? (
                <button onClick={handleCreate} disabled={busy}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-200 px-5 py-2 text-sm font-bold text-slate-950 hover:opacity-90 disabled:opacity-50 transition">
                  {busy ? "…" : (ru ? "🚀 Создать аккаунт" : "🚀 Create account")}
                </button>
              ) : (
                <button onClick={() => setStep(s => s + 1)}
                  className="rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20 transition">
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
