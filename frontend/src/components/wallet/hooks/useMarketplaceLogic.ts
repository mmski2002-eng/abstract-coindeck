import { useState } from "react";
import { parseEther } from "viem";
import type { TransactionPayload, TxOptions, Listing } from "../types";
import { getErrorMessage, parseU8Vec } from "../utils";

interface Deps {
  restUrl: string;
  moduleAddress: string;
  submitTx: (p: TransactionPayload, opts?: TxOptions) => Promise<void>;
  setBusy: (v: string | null) => void;
  flCards: { playerId: number; tier: number; cardAddr: string }[];
  lockedCardAddrs: string[];
  setFlError: (v: string) => void;
  refreshInventory: () => Promise<number>;
  walletAccount: { address: unknown } | null | undefined;
  ensureInitialized: () => Promise<void>;
}

export function useMarketplaceLogic({
  restUrl, moduleAddress, submitTx, setBusy,
  flCards, lockedCardAddrs, setFlError, refreshInventory,
  walletAccount, ensureInitialized,
}: Deps) {
  const [mpListings, setMpListings] = useState<Listing[]>([]);
  const [mpError, setMpError] = useState("");
  const [mpRefreshing, setMpRefreshing] = useState(false);
  const [sellModal, setSellModal] = useState<{ playerId: number; tier: number } | null>(null);
  const [sellPrice, setSellPrice] = useState("0.1");
  const [transferModal, setTransferModal] = useState<{ playerId: number; tier: number; cardAddr: string } | null>(null);
  const [transferRecipient, setTransferRecipient] = useState("");
  const [mpFilterTier, setMpFilterTier] = useState<number | null>(null);
  const [mpFilterTeam, setMpFilterTeam] = useState<string | null>(null);
  const [mpSearchTicker, setMpSearchTicker] = useState("");
  const [mpPage, setMpPage] = useState(0);
  const MP_PAGE_SIZE = 15;
  const [myListingsPage, setMyListingsPage] = useState(0);
  const MY_LISTINGS_PAGE_SIZE = 8;

  async function waitForInventoryIncrease(previousCount: number, expectedIncrease: number) {
    const targetCount = previousCount + expectedIncrease;
    let latestCount = previousCount;
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      latestCount = await refreshInventory();
      if (latestCount >= targetCount) break;
    }
    if (latestCount < targetCount) {
      setTimeout(() => { void refreshInventory(); }, 2500);
      setTimeout(() => { void refreshInventory(); }, 7000);
    }
  }

  async function refreshListings() {
    if (mpRefreshing) return;
    setMpRefreshing(true);
    setMpError("");
    try {
      const resp = await fetch("/api/marketplace");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json() as { listings: Array<{ listing_id: number; seller: string; player_id: number; tier: number; price: string }> };
      setMpListings((json.listings ?? []).map((row) => ({
        id: Number(row.listing_id),
        seller: row.seller,
        playerId: Number(row.player_id),
        tier: Number(row.tier),
        price: String(row.price),
      })));
    } catch (e: unknown) {
      setMpError(getErrorMessage(e));
    } finally {
      setMpRefreshing(false);
    }
  }

  async function triggerMarketplaceSync() {
    await fetch("/api/marketplace", { method: "POST" }).catch(() => {});
  }

  async function onListCard(playerId: number, tier: number, priceMove: number) {
    if (!walletAccount) return;
    setBusy("mp_list");
    try {
      const cardEntry = flCards.find((c) => c.playerId === playerId && c.tier === tier && !lockedCardAddrs.includes(c.cardAddr));
      if (!cardEntry) { setFlError("Card not found in inventory"); setBusy(null); return; }
      const priceWei = parseEther(priceMove.toString());
      await submitTx({
        function: `${moduleAddress}::marketplace::list_card`,
        typeArguments: [],
        functionArguments: [cardEntry.cardAddr, priceWei],
      });
      setSellModal(null);
      const prevCount = flCards.length;
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 700));
        const count = await refreshInventory();
        if (count < prevCount) break;
      }
      await refreshListings();
    } catch (e: unknown) { setFlError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  async function onTransferCard(cardAddr: string, recipient: string) {
    if (!walletAccount) return;
    setBusy("card_transfer");
    setFlError("");
    try {
      await submitTx({
        function: `${moduleAddress}::fantasy_league::transfer_card`,
        typeArguments: [],
        functionArguments: [cardAddr, recipient],
      });
      setTransferModal(null);
      setTransferRecipient("");
      const prevCount = flCards.length;
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 700));
        const count = await refreshInventory();
        if (count < prevCount) break;
      }
    } catch (e: unknown) { setFlError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  async function onBuyCard(listingId: number) {
    if (!walletAccount) return;
    setBusy(`mp_buy_${listingId}`);
    setMpError("");
    try {
      await ensureInitialized();
      await submitTx({
        function: `${moduleAddress}::marketplace::buy_card`,
        typeArguments: [],
        functionArguments: [listingId],
      });
      setTimeout(() => {
        refreshInventory();
        refreshListings();
      }, 2000);
    } catch (e: unknown) { setMpError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  async function onBuyCards(listingIds: number[]) {
    if (!walletAccount || listingIds.length === 0) return false;
    setBusy("mp_buy_batch");
    setMpError("");
    try {
      await ensureInitialized();
      const previousCount = flCards.length;
      await submitTx({
        function: `${moduleAddress}::marketplace::buy_cards_batch`,
        typeArguments: [],
        functionArguments: [listingIds],
      });
      await waitForInventoryIncrease(previousCount, listingIds.length);
      await refreshListings();
      return true;
    } catch (e: unknown) {
      setMpError(getErrorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function onCancelListing(listingId: number) {
    if (!walletAccount) return;
    setBusy(`mp_cancel_${listingId}`);
    setMpError("");
    try {
      await submitTx({
        function: `${moduleAddress}::marketplace::cancel_listing`,
        typeArguments: [],
        functionArguments: [listingId],
      });
      await refreshInventory();
      await refreshListings();
    } catch (e: unknown) { setMpError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  return {
    mpListings, setMpListings,
    mpError, setMpError,
    mpRefreshing, setMpRefreshing,
    sellModal, setSellModal,
    sellPrice, setSellPrice,
    transferModal, setTransferModal,
    transferRecipient, setTransferRecipient,
    mpFilterTier, setMpFilterTier,
    mpFilterTeam, setMpFilterTeam,
    mpSearchTicker, setMpSearchTicker,
    mpPage, setMpPage, MP_PAGE_SIZE,
    myListingsPage, setMyListingsPage, MY_LISTINGS_PAGE_SIZE,
    refreshListings, triggerMarketplaceSync, onListCard, onTransferCard, onBuyCard, onBuyCards, onCancelListing,
  };
}
