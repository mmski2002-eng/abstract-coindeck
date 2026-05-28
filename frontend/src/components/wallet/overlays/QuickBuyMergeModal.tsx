"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { HEROES, COIN_ICONS, COIN_TICKERS, TIER_COLORS, TIER_NAMES } from "../constants";
import type { Listing, QuickBuyMergeData } from "../types";

type Props = {
  lang: string;
  modal: QuickBuyMergeData;
  mpListings: Listing[];
  accountAddress: string | null;
  busy: string | null;
  mpRefreshing: boolean;
  onClose: () => void;
  onBuyCards: (listingIds: number[]) => Promise<boolean>;
};

export function QuickBuyMergeModal({
  lang,
  modal,
  mpListings,
  accountAddress,
  busy,
  mpRefreshing,
  onClose,
  onBuyCards,
}: Props) {
  const matchingListings = useMemo(() => {
    const normalizedAccount = accountAddress?.toLowerCase() ?? null;
    return mpListings
      .filter((listing) =>
        listing.playerId === modal.playerId &&
        listing.tier === modal.tier &&
        (!normalizedAccount || listing.seller.toLowerCase() !== normalizedAccount)
      )
      .sort((a, b) => Number(a.price) - Number(b.price) || a.id - b.id)
      .slice(0, modal.neededCount);
  }, [accountAddress, modal.neededCount, modal.playerId, modal.tier, mpListings]);

  const maxSelectable = matchingListings.length;
  const defaultQty = Math.min(modal.neededCount, maxSelectable);
  const [manualQty, setManualQty] = useState<number | null>(null);
  const selectedQty = manualQty === null ? defaultQty : Math.min(manualQty, maxSelectable);

  const selectedListings = matchingListings.slice(0, selectedQty);
  const totalPrice = selectedListings.reduce((sum, listing) => sum + Number(listing.price), 0);
  const enoughForMerge = maxSelectable >= modal.neededCount;
  const projectedOwned = modal.ownedCount + selectedQty;
  const canBuy = selectedQty > 0 && busy === null;

  const statCell = (label: string, value: React.ReactNode) => (
    <div className="rounded-xl px-2.5 py-2" style={{ border: "1px solid var(--panel-border)", background: "var(--card)" }}>
      <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--nft-muted)" }}>{label}</div>
      <div className="mt-0.5 text-base font-black" style={{ color: "var(--panel-text)" }}>{value}</div>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={lang === "ru" ? "Быстрая покупка для MERGE" : "Quick Buy for Merge"}
      dialogClassName="!max-w-xl"
    >
      <div className="space-y-3">
        {/* Card preview */}
        <div
          className="flex items-center gap-3 rounded-2xl p-2.5"
          style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }}
        >
          <img
            src={COIN_ICONS[modal.playerId]}
            alt={HEROES[modal.playerId]}
            className="h-11 w-11 rounded-xl object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <div className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold mb-0.5 ${TIER_COLORS[modal.tier].badge}`}>
              {TIER_NAMES[modal.tier].toUpperCase()}
            </div>
            <div className="text-sm font-semibold truncate" style={{ color: "var(--panel-text)" }}>{HEROES[modal.playerId]}</div>
            <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>{COIN_TICKERS[modal.playerId]}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="rounded-2xl p-2.5" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }}>
          <div className="grid grid-cols-4 gap-2">
            {statCell(lang === "ru" ? "Есть" : "Owned", modal.ownedCount)}
            {statCell(lang === "ru" ? "Нужно" : "Need", <span className="text-cyan-400">{modal.neededCount}</span>)}
            {statCell(lang === "ru" ? "Доступно" : "Available", matchingListings.length)}
            <div className="rounded-xl px-2.5 py-2" style={{ border: "1px solid var(--panel-border)", background: "var(--card)" }}>
              <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--nft-muted)" }}>
                {lang === "ru" ? "Купить" : "Buy"}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <button
                  onClick={() => setManualQty(Math.max(1, selectedQty - 1))}
                  disabled={selectedQty <= 1 || maxSelectable === 0}
                  className="grid h-7 w-7 place-items-center rounded-lg text-sm transition disabled:opacity-30"
                  style={{ border: "1px solid var(--panel-border)", background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)" }}
                >−</button>
                <span className="min-w-[1.5rem] text-center text-base font-black tabular-nums" style={{ color: "var(--panel-text)" }}>{selectedQty}</span>
                <button
                  onClick={() => setManualQty(Math.min(maxSelectable, selectedQty + 1))}
                  disabled={selectedQty >= maxSelectable}
                  className="grid h-7 w-7 place-items-center rounded-lg text-sm transition disabled:opacity-30"
                  style={{ border: "1px solid var(--panel-border)", background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)" }}
                >+</button>
              </div>
            </div>
          </div>
          <div className="mt-2 px-0.5 text-[11px]" style={{ color: "var(--nft-muted)" }}>
            {lang === "ru"
              ? `После покупки будет ${projectedOwned}/5 карт для этого MERGE`
              : `After purchase you will have ${projectedOwned}/5 cards for this merge`}
          </div>
        </div>

        {/* Listings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--nft-muted)" }}>
              {lang === "ru" ? "Лоты для покупки" : "Lots to buy"}
            </div>
            {!enoughForMerge && (
              <div className="text-[11px] text-amber-400">
                {lang === "ru"
                  ? `Не хватает ${modal.neededCount - matchingListings.length} лотов`
                  : `${modal.neededCount - matchingListings.length} more lots needed`}
              </div>
            )}
          </div>

          {mpRefreshing ? (
            <div className="rounded-2xl px-4 py-4 text-sm" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)", color: "var(--nft-muted)" }}>
              {lang === "ru" ? "Обновляем лоты маркетплейса…" : "Refreshing marketplace lots…"}
            </div>
          ) : matchingListings.length === 0 ? (
            <div className="rounded-2xl px-4 py-4 text-sm" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)", color: "var(--nft-muted)" }}>
              {lang === "ru" ? "Подходящих лотов сейчас нет." : "No matching lots are available right now."}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--panel-border)" }}>
              {matchingListings.map((listing, index) => {
                const active = index < selectedQty;
                return (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition"
                    style={{
                      borderBottom: "1px solid var(--panel-border)",
                      background: active ? "rgba(0,240,255,0.05)" : "var(--panel-bg)",
                      opacity: active ? 1 : 0.55,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold" style={{ color: "var(--panel-text)" }}>
                        {lang === "ru" ? `Лот #${listing.id}` : `Lot #${listing.id}`}
                      </div>
                      <div className="mt-0.5 text-[11px] truncate" style={{ color: "var(--nft-muted)" }}>
                        {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black" style={{ color: active ? "#22d3ee" : "var(--nft-muted)" }}>
                        {(Number(listing.price) / 1e18).toFixed(4)} ETH
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--nft-muted)" }}>
              {lang === "ru" ? "Итого" : "Total"}
            </div>
            <div className="mt-0.5 text-base font-black" style={{ color: "var(--panel-text)" }}>
              {(totalPrice / 1e18).toFixed(4)} <span className="text-cyan-400">ETH</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition"
            style={{ border: "1px solid var(--panel-border)", background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)" }}
          >
            {lang === "ru" ? "Отмена" : "Cancel"}
          </button>
          <button
            onClick={async () => {
              const ok = await onBuyCards(selectedListings.map((listing) => listing.id));
              if (ok) onClose();
            }}
            disabled={!canBuy}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50"
          >
            {busy === "mp_buy_batch"
              ? (lang === "ru" ? "Покупка…" : "Buying…")
              : (lang === "ru" ? `Купить ${selectedQty}` : `Buy ${selectedQty}`)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
