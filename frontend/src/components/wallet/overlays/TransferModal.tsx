"use client";
import { HEROES, COIN_ICONS, TIER_NAMES, TIER_COLORS, PLAYER_TEAMS } from "../constants";
import { Modal } from "@/components/ui";

type TransferData = { playerId: number; tier: number; cardAddr: string };

type Props = {
  lang: string;
  modal: TransferData;
  onClose: () => void;
  transferRecipient: string;
  setTransferRecipient: (v: string) => void;
  busy: string | null;
  onTransferCard: (cardAddr: string, recipient: string) => void;
};

export function TransferModal({ lang, modal, onClose, transferRecipient, setTransferRecipient, busy, onTransferCard }: Props) {
  return (
    <Modal open onClose={onClose} title={lang === "ru" ? "Отправить карточку" : "Send card"}>
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
            {lang === "ru" ? "Адрес получателя" : "Recipient address"}
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={transferRecipient}
            onChange={(e) => setTransferRecipient(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {lang === "ru"
            ? "Карточка будет безвозвратно отправлена на указанный адрес. Отменить нельзя."
            : "The card will be permanently sent to the specified address. This cannot be undone."}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium hover:bg-white/10 transition">
            {lang === "ru" ? "Отмена" : "Cancel"}
          </button>
          <button
            onClick={() => onTransferCard(modal.cardAddr, transferRecipient)}
            disabled={busy !== null || transferRecipient.length < 10}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50">
            {busy === "card_transfer" ? "…" : (lang === "ru" ? "Отправить" : "Send")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
