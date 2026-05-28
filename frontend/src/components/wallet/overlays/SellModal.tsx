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
        <div
          className="flex items-center gap-4 rounded-2xl p-4"
          style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }}
        >
          <img src={COIN_ICONS[modal.playerId]} alt={HEROES[modal.playerId]}
            className="h-16 w-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
          <div>
            <div className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold mb-1 ${TIER_COLORS[modal.tier].badge}`}>
              {TIER_NAMES[modal.tier].toUpperCase()}
            </div>
            <div className="text-sm font-semibold" style={{ color: "var(--panel-text)" }}>{HEROES[modal.playerId]}</div>
            <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>{PLAYER_TEAMS[modal.playerId]}</div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--panel-text-muted)" }}>
            {lang === "ru" ? "Цена (ETH)" : "Price (ETH)"}
          </label>
          <input
            type="number" min="0.01" step="0.01" value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              color: "var(--panel-text)",
            }}
          />
          <div className="mt-1 text-xs" style={{ color: "var(--nft-muted)" }}>
            ≈ {(parseFloat(sellPrice || "0") * 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} wei
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--nft-muted)" }}>
            {lang === "ru"
              ? `Вы получите ≈ ${(parseFloat(sellPrice || "0") * 0.95).toFixed(4)} ETH (5% комиссия платформы)`
              : `You receive ≈ ${(parseFloat(sellPrice || "0") * 0.95).toFixed(4)} ETH (5% platform fee)`}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition"
            style={{ border: "1px solid var(--panel-border)", background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)" }}>
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
