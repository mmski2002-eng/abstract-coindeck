"use client";
import { createPortal } from "react-dom";
import { HEROES, COIN_ICONS, TIER_NAMES, TIER_COLORS, PLAYER_ROLE_IDS } from "../constants";
import type { TournamentStateData } from "../types";

const SLOT_ROLES = ["Layer 1", "Layer 2", "DeFi", "Exchange", "Meme/Infra"];
type FlCard = { playerId: number; tier: number; cardAddr: string };

type Props = {
  lang: string;
  tnState: NonNullable<TournamentStateData>;
  epochRange: [number, number] | null;
  roleBonusPct: number;
  tnSelectedCards: (string | null)[];
  flCards: FlCard[];
  busy: string | null;
  setLineupConfirmOpen: (v: boolean) => void;
  onSubmitLineup: () => Promise<void>;
};

export function LineupConfirmModal({ lang, tnState, epochRange, roleBonusPct, tnSelectedCards, flCards, busy, setLineupConfirmOpen, onSubmitLineup }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-zinc-900/95 p-5 space-y-4">
        <div className="text-base font-black">{lang === "ru" ? "Подтвердить состав" : "Confirm lineup"}</div>
        <div className="text-xs text-zinc-500">
          {lang === "ru"
            ? `День ${tnState.currentDay} · Неделя ${epochRange ? tnState.epoch - epochRange[0] + 1 : tnState.epoch}`
            : `Day ${tnState.currentDay} · Week ${epochRange ? tnState.epoch - epochRange[0] + 1 : tnState.epoch}`}
        </div>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200">
          ⚡ {lang === "ru"
            ? `Монета в своей категории даёт +${roleBonusPct}% к очкам слота`
            : `Coin in its category gives +${roleBonusPct}% to slot score`}
        </div>
        <div className="space-y-2">
          {SLOT_ROLES.map((role, si) => {
            const addr = tnSelectedCards[si];
            const card = addr ? flCards.find((c) => c.cardAddr === addr) : null;
            if (!card) return null;
            const isRoleMatch = PLAYER_ROLE_IDS[card.playerId] === si;
            const tc = TIER_COLORS[card.tier];
            return (
              <div key={si} className={`flex items-center gap-3 rounded-xl border p-2.5 ${isRoleMatch ? "border-amber-500/30 bg-amber-500/5" : "border-white/8 bg-white/3"}`}>
                <img src={COIN_ICONS[card.playerId]} alt="" className="h-9 w-9 rounded-lg object-cover opacity-85 shrink-0" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{HEROES[card.playerId]}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] rounded px-1 py-0.5 font-bold ${tc.badge}`}>{TIER_NAMES[card.tier]}</span>
                    <span className="text-[9px] text-zinc-500">{role}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold shrink-0 ${isRoleMatch ? "text-amber-300" : "text-zinc-600"}`}>
                  {isRoleMatch ? `⚡ +${roleBonusPct}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setLineupConfirmOpen(false)}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition">
            {lang === "ru" ? "Назад" : "Back"}
          </button>
          <button
            onClick={async () => { setLineupConfirmOpen(false); await onSubmitLineup(); }}
            disabled={busy !== null}
            className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition">
            {busy === "tn_submit" ? "…" : (lang === "ru" ? "Выставить" : "Submit")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
