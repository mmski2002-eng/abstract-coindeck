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
        <div className="card-sticker flex items-center gap-4 p-4">
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
            {lang === "ru" ? "Адрес получателя" : "Recipient address"}
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={transferRecipient}
            onChange={(e) => setTransferRecipient(e.target.value)}
            className="input-sticker w-full px-4 py-2.5 font-mono text-sm"
          />
        </div>
        <div
          className="rounded-xl px-4 py-3 text-xs"
          style={{ background: "var(--warn)", border: "2px solid var(--outline)", color: "var(--on-rarity)" }}
        >
          {lang === "ru"
            ? "Карточка будет безвозвратно отправлена на указанный адрес. Отменить нельзя."
            : "The card will be permanently sent to the specified address. This cannot be undone."}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="btn-sticker-outline flex-1 py-2.5">
            {lang === "ru" ? "Отмена" : "Cancel"}
          </button>
          <button
            onClick={() => onTransferCard(modal.cardAddr, transferRecipient)}
            disabled={busy !== null || transferRecipient.length < 10}
            className="btn-sticker-primary flex-1 py-2.5">
            {busy === "card_transfer" ? "…" : (lang === "ru" ? "Отправить" : "Send")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
