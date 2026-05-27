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
      .sort((a, b) => a.price - b.price || a.id - b.id)
      .slice(0, modal.neededCount);
  }, [accountAddress, modal.neededCount, modal.playerId, modal.tier, mpListings]);

  const maxSelectable = matchingListings.length;
  const defaultQty = Math.min(modal.neededCount, maxSelectable);
  const [manualQty, setManualQty] = useState<number | null>(null);
  const selectedQty = manualQty === null ? defaultQty : Math.min(manualQty, maxSelectable);

  const selectedListings = matchingListings.slice(0, selectedQty);
  const totalPrice = selectedListings.reduce((sum, listing) => sum + listing.price, 0);
  const enoughForMerge = maxSelectable >= modal.neededCount;
  const projectedOwned = modal.ownedCount + selectedQty;
  const canBuy = selectedQty > 0 && busy === null;

  return (
    <Modal
      open
      onClose={onClose}
      title={lang === "ru" ? "Быстрая покупка для MERGE" : "Quick Buy for Merge"}
      dialogClassName="!max-w-xl"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
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
            <div className="text-sm font-semibold truncate">{HEROES[modal.playerId]}</div>
            <div className="text-xs text-zinc-400">{COIN_TICKERS[modal.playerId]}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{lang === "ru" ? "Есть" : "Owned"}</div>
              <div className="mt-0.5 text-base font-black text-white">{modal.ownedCount}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{lang === "ru" ? "Нужно" : "Need"}</div>
              <div className="mt-0.5 text-base font-black text-cyan-300">{modal.neededCount}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{lang === "ru" ? "Доступно" : "Available"}</div>
              <div className="mt-0.5 text-base font-black text-white">{matchingListings.length}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                {lang === "ru" ? "Купить" : "Buy"}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <button
                  onClick={() => setManualQty(Math.max(1, selectedQty - 1))}
                  disabled={selectedQty <= 1 || maxSelectable === 0}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10 disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-[1.5rem] text-center text-base font-black tabular-nums text-white">{selectedQty}</span>
                <button
                  onClick={() => setManualQty(Math.min(maxSelectable, selectedQty + 1))}
                  disabled={selectedQty >= maxSelectable}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 px-0.5 text-[11px] text-zinc-500">
            {lang === "ru"
              ? `После покупки будет ${projectedOwned}/5 карт для этого MERGE`
              : `After purchase you will have ${projectedOwned}/5 cards for this merge`}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {lang === "ru" ? "Лоты для покупки" : "Lots to buy"}
            </div>
            {!enoughForMerge && (
              <div className="text-[11px] text-amber-300">
                {lang === "ru"
                  ? `Не хватает ${modal.neededCount - matchingListings.length} лотов`
                  : `${modal.neededCount - matchingListings.length} more lots needed`}
              </div>
            )}
          </div>

          {mpRefreshing ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-500">
              {lang === "ru" ? "Обновляем лоты маркетплейса…" : "Refreshing marketplace lots…"}
            </div>
          ) : matchingListings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-500">
              {lang === "ru" ? "Подходящих лотов сейчас нет." : "No matching lots are available right now."}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              {matchingListings.map((listing, index) => {
                const active = index < selectedQty;
                return (
                  <div
                    key={listing.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/5 last:border-b-0 transition ${active ? "bg-cyan-500/8" : "bg-transparent opacity-55"}`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {lang === "ru" ? `Лот #${listing.id}` : `Lot #${listing.id}`}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
                        {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-black ${active ? "text-cyan-300" : "text-zinc-400"}`}>
                        {(listing.price / 1e8).toFixed(2)} MOVE
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {lang === "ru" ? "Итого" : "Total"}
            </div>
            <div className="mt-0.5 text-base font-black text-white">
              {(totalPrice / 1e8).toFixed(2)} <span className="text-cyan-300">MOVE</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition"
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
