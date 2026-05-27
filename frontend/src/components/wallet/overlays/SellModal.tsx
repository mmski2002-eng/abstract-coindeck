"use client";
import { HEROES, COIN_ICONS, TIER_NAMES, TIER_COLORS, PLAYER_TEAMS } from "../constants";
import { Modal } from "@/components/ui";

type SellData = { playerId: number; tier: number };

type Props = {
  lang: string;
  modal: SellData;
  onClose: () => void;
  sellPrice: string;
  setSellPrice: (v: string) => void;
  busy: string | null;
  onListCard: (playerId: number, tier: number, price: number) => void;
};

export function SellModal({ lang, modal, onClose, sellPrice, setSellPrice, busy, onListCard }: Props) {
  return (
    <Modal open onClose={onClose} title={lang === "ru" ? "Выставить на продажу" : "List for sale"}>
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <img src={COIN_ICONS[modal.playerId]} alt={HEROES[modal.playerId]}
            className="h-16 w-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
          <div>
            <div className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold mb-1 ${TIER_COLORS[modal.tier].badge}`}>
              {TIER_NAMES[modal.tier].toUpperCase()}
            </div>
            <div className="text-sm font-semibold">{HEROES[modal.playerId]}</div>
            <div className="text-xs text-zinc-400">{PLAYER_TEAMS[modal.playerId]}</div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
            {lang === "ru" ? "Цена (ETH)" : "Price (ETH)"}
          </label>
          <input
            type="number" min="0.01" step="0.01" value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <div className="mt-1 text-xs text-zinc-500">
            ≈ {Math.round(parseFloat(sellPrice || "0") * 100_000_000).toLocaleString()} octas
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {lang === "ru"
              ? `Вы получите ≈ ${(parseFloat(sellPrice || "0") * 0.95).toFixed(4)} ETH (5% комиссия платформы)`
              : `You receive ≈ ${(parseFloat(sellPrice || "0") * 0.95).toFixed(4)} ETH (5% platform fee)`}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium hover:bg-white/10 transition">
            {lang === "ru" ? "Отмена" : "Cancel"}
          </button>
          <button
            onClick={() => onListCard(modal.playerId, modal.tier, parseFloat(sellPrice || "0"))}
            disabled={busy !== null || parseFloat(sellPrice || "0") <= 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50">
            {busy === "mp_list" ? (lang === "ru" ? "Выставление…" : "Listing…") : (lang === "ru" ? "Выставить" : "List")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
