import { useEffect, useRef, useState } from "react";
import type { Config } from "@wagmi/core";
import type { TransactionPayload, TxOptions } from "../types";
import { getErrorMessage } from "../utils";
import { readEvmChestPrices, readEvmInventory } from "@/lib/evmContracts";

type Card = { playerId: number; tier: number; cardAddr: string };
const MAX_NICKNAME_BYTES = 14;

function nicknameStorageKey(walletAddress: string) {
  return `player_nickname:${walletAddress.toLowerCase()}`;
}

interface Deps {
  restUrl: string;
  moduleAddress: string;
  wagmiConfig: Config;
  submitTx: (p: TransactionPayload, opts?: TxOptions) => Promise<void>;
  setBusy: (v: string | null) => void;
  setOnboardingBusy: (v: boolean) => void;
  walletAccount: { address: unknown } | null | undefined;
  lang: string;
}

export function useRosterLogic({ restUrl, moduleAddress, wagmiConfig, submitTx, setBusy, setOnboardingBusy, walletAccount, lang }: Deps) {
  const refreshPromiseRef = useRef<Promise<number> | null>(null);
  const latestCardsRef = useRef<Card[]>([]);
  const [chestBuyModal, setChestBuyModal] = useState<{ type: number; label: string; emoji: string; rarity: string; desc: string; price: number; buyBg: string } | null>(null);
  const [chestBuyQty, setChestBuyQty] = useState(1);
  const [chestOpenModal, setChestOpenModal] = useState<{ type: number; label: string; emoji: string; tier: number; available: number; grad: string; ring: string; buyBg: string } | null>(null);
  const [chestOpenQty, setChestOpenQty] = useState(1);
  const [chestPrice, setChestPrice] = useState(1e16);
  const [chestPrices, setChestPrices] = useState({ wooden: 1e16, iron: 3e16, silver: 9e16 });
  const [chestPricesWei, setChestPricesWei] = useState({ wooden: 10000000000000000n, iron: 30000000000000000n, silver: 90000000000000000n });
  const [tierMults, setTierMults] = useState([100, 140, 190, 250]);
  const [chestCounts, setChestCounts] = useState({ wooden: 0, iron: 0, silver: 0 });
  const [chestNftAddrs, setChestNftAddrs] = useState<{ wooden: string[]; iron: string[]; silver: string[] }>({ wooden: [], iron: [], silver: [] });
  const [freeClaimed, setFreeClaimed] = useState(false);
  const [flCards, setFlCards] = useState<Card[]>([]);
  const [flChests, setFlChests] = useState(0);
  const [flInitialized, setFlInitialized] = useState(true);
  const [flInventoryChecked, setFlInventoryChecked] = useState(true);
  const [flError, setFlError] = useState("");
  const [flRefreshing, setFlRefreshing] = useState(false);
  const [openingChest, setOpeningChest] = useState(false);
  const [openingChestType, setOpeningChestType] = useState<number>(0);
  const [chestTxConfirmed, setChestTxConfirmed] = useState(false);
  const [chestBuySuccess, setChestBuySuccess] = useState<number | null>(null);
  const [chestCardFound, setChestCardFound] = useState(false);
  const [revealCard, setRevealCard] = useState<{ playerId: number; tier: number } | null>(null);
  const [revealCards, setRevealCards] = useState<{ playerId: number; tier: number }[] | null>(null);
  const [mergingCard, setMergingCard] = useState<{ playerId: number; tier: number } | null>(null);
  const [mergeTxConfirmed, setMergeTxConfirmed] = useState(false);
  const [mergeAnimDone, setMergeAnimDone] = useState(false);
  const [mergeResultCard, setMergeResultCard] = useState<{ playerId: number; tier: number } | null>(null);
  const [newCardKeys, setNewCardKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    readEvmChestPrices(wagmiConfig).then((p) => {
      setChestPricesWei(p);
      setChestPrices({ wooden: Number(p.wooden), iron: Number(p.iron), silver: Number(p.silver) });
      setChestPrice(Number(p.wooden));
    }).catch(() => {});
    fetch("/api/leaderboard/config").then(r => r.ok ? r.json() : null).then(v => {
      if (v?.tierMults) setTierMults(v.tierMults);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureInitialized(_nickname?: string) {
    // EVM: no inventory initialization needed — ERC-721 native
  }

  async function hasInventoryOnChain(): Promise<boolean> {
    if (!walletAccount) return false;
    try {
      const addr = String(walletAccount.address ?? "").trim();
      if (!addr.startsWith("0x")) return false;
      const inventory = await readEvmInventory(wagmiConfig, addr as `0x${string}`);
      return inventory.cards.length > 0 || inventory.chests.length > 0;
    } catch {
      return false;
    }
  }

  async function handleOnboardingCreate(nickname: string) {
    setOnboardingBusy(true);
    try {
      await ensureInitialized(nickname);
      try {
        localStorage.setItem("player_nickname", nickname);
        const addr = String(walletAccount?.address ?? "").trim();
        if (addr) localStorage.setItem(nicknameStorageKey(addr), nickname);
      } catch {}

      let initialized = false;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1200));
        initialized = await hasInventoryOnChain();
        if (initialized) {
          await refreshInventory();
          initialized = true;
          break;
        }
      }

      if (!initialized) {
        throw new Error(lang === "ru"
          ? "Транзакция отправлена, но аккаунт пока не появился в сети. Попробуй ещё раз через пару секунд."
          : "The transaction was sent, but the account is not visible on-chain yet. Please try again in a few seconds.");
      }

      setFlInitialized(true);
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function refreshInventory(onCards?: (cards: Card[]) => void): Promise<number> {
    if (!walletAccount) return -1;
    if (refreshPromiseRef.current) {
      const result = await refreshPromiseRef.current;
      onCards?.(latestCardsRef.current);
      return result;
    }

    const run = (async () => {
      try {
        setFlRefreshing(true);
        setFlError("");
        const addr = String(walletAccount.address ?? "").trim();
        if (!addr.startsWith("0x")) throw new Error("Wallet address is not available");

        const inventory = await readEvmInventory(wagmiConfig, addr as `0x${string}`);

        setFlInitialized(true);
        setFlInventoryChecked(true);

        const cards = inventory.cards.map((card) => ({
          playerId: card.playerId,
          tier: card.tier,
          cardAddr: card.tokenId.toString(),
        }));
        latestCardsRef.current = cards;
        setFlCards(cards);
        onCards?.(cards);

        const byType: { wooden: string[]; iron: string[]; silver: string[] } = { wooden: [], iron: [], silver: [] };
        for (const chest of inventory.chests) {
          const tokenId = chest.tokenId.toString();
          if (chest.chestType === 0) byType.wooden.push(tokenId);
          else if (chest.chestType === 1) byType.iron.push(tokenId);
          else byType.silver.push(tokenId);
        }
        setChestNftAddrs(byType);
        setChestCounts({ wooden: byType.wooden.length, iron: byType.iron.length, silver: byType.silver.length });
        setFlChests(byType.wooden.length + byType.iron.length + byType.silver.length);
        return cards.length;
      } catch (e: unknown) {
        setFlError(getErrorMessage(e));
        return -1;
      } finally {
        setFlRefreshing(false);
      }
    })();

    refreshPromiseRef.current = run;
    try {
      return await run;
    } finally {
      refreshPromiseRef.current = null;
    }
  }

  function findNewCard(before: Card[], after: Card[]): Card | null {
    const countMap = new Map<string, number>();
    for (const c of before) { const k = `${c.playerId}_${c.tier}`; countMap.set(k, (countMap.get(k) ?? 0) + 1); }
    for (const c of after) {
      const k = `${c.playerId}_${c.tier}`;
      const prev = countMap.get(k) ?? 0;
      if (prev === 0) return c;
      countMap.set(k, prev - 1);
    }
    return null;
  }

  function findAllNewCards(before: Card[], after: Card[]): Card[] {
    const countMap = new Map<string, number>();
    for (const c of before) { const k = `${c.playerId}_${c.tier}`; countMap.set(k, (countMap.get(k) ?? 0) + 1); }
    const result: Card[] = [];
    for (const c of after) {
      const k = `${c.playerId}_${c.tier}`;
      const prev = countMap.get(k) ?? 0;
      if (prev === 0) { result.push(c); } else { countMap.set(k, prev - 1); }
    }
    return result;
  }

  async function onBuyChestTyped(type: number, qty: number = 1) {
    if (!walletAccount) return;
    setChestBuyModal(null);
    setBusy(`fl_buy_${type}`);
    setFlError("");
    try {
      await ensureInitialized();
      const priceKey = type === 0 ? "wooden" : type === 1 ? "iron" : "silver";
      const freshPrices = await readEvmChestPrices(wagmiConfig);
      setChestPricesWei(freshPrices);
      setChestPrices({ wooden: Number(freshPrices.wooden), iron: Number(freshPrices.iron), silver: Number(freshPrices.silver) });
      const unitPrice = freshPrices[priceKey];
      await submitTx({ function: `${moduleAddress}::fantasy_league::buy_chest`, typeArguments: [], functionArguments: [type, qty], value: unitPrice * BigInt(qty) });
      setChestBuySuccess(type);
      setTimeout(() => setChestBuySuccess(null), 2000);
    } catch (e: unknown) { setFlError(getErrorMessage(e)); }
    finally { setBusy(null); }
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 700));
      await refreshInventory();
    }
  }

  async function onOpenChestTyped(type: number, qty: number = 1) {
    if (!walletAccount) return;
    setChestOpenModal(null);
    setOpeningChestType(type);
    setChestTxConfirmed(false);
    setChestCardFound(false);
    setBusy(`fl_open_${type}`);
    setOpeningChest(true);
    setFlError("");
    try {
      await ensureInitialized();
      const prevCards = [...flCards];
      const prevCount = prevCards.length;
      const typeKey = type === 0 ? "wooden" : type === 1 ? "iron" : "silver";
      const availableAddrs = chestNftAddrs[typeKey];
      if (availableAddrs.length < qty) throw new Error(lang === "ru" ? "Недостаточно сундуков" : "Not enough chests");
      const fn = qty === 1
        ? { function: `${moduleAddress}::fantasy_league::open_chest`, functionArguments: [availableAddrs[0]] }
        : { function: `${moduleAddress}::fantasy_league::open_chest_batch`, functionArguments: [availableAddrs.slice(0, qty)] };
      await submitTx({ ...fn, typeArguments: [] });
      setChestTxConfirmed(true);
      let newCards: Card[] = [];
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 900));
        const count = await refreshInventory((cards) => { newCards = cards; });
        if (count > 0 && count >= prevCount + qty) break;
      }
      if (newCards.length > prevCount) {
        if (qty === 1) {
          const found = findNewCard(prevCards, newCards);
          if (found) {
            setNewCardKeys((prev) => new Set([...prev, `${found.playerId}_${found.tier}`]));
            setChestCardFound(true);
            await new Promise(r => setTimeout(r, 750));
            setRevealCard(found);
          } else {
            const fallback = newCards[newCards.length - 1];
            if (fallback) {
              setNewCardKeys((prev) => new Set([...prev, `${fallback.playerId}_${fallback.tier}`]));
              setChestCardFound(true);
              await new Promise(r => setTimeout(r, 750));
              setRevealCard(fallback);
            }
          }
        } else {
          const found = findAllNewCards(prevCards, newCards);
          const toShow = found.length > 0 ? found : newCards.slice(prevCount);
          if (toShow.length > 0) {
            toShow.forEach((c) => setNewCardKeys((prev) => new Set([...prev, `${c.playerId}_${c.tier}`])));
            setChestCardFound(true);
            await new Promise(r => setTimeout(r, 750));
            setRevealCards(toShow);
          }
        }
      }
      // if card not found during animation — tx still succeeded, background refreshes below will sync UI
    } catch (e: unknown) { setFlError(getErrorMessage(e)); }
    finally {
      setBusy(null);
      setOpeningChest(false);
      setChestCardFound(false);
      // catch delayed blockchain updates after animation closes
      setTimeout(() => { void refreshInventory(); }, 2500);
      setTimeout(() => { void refreshInventory(); }, 7000);
      setTimeout(() => { void refreshInventory(); }, 18000);
    }
  }

  async function onOpenChest() {
    if (!walletAccount) return;
    setOpeningChestType(0);
    setChestTxConfirmed(false);
    setChestCardFound(false);
    setBusy("fl_open");
    setOpeningChest(true);
    try {
      await ensureInitialized();
      const prevCount = flCards.length;
      const firstAddr = chestNftAddrs.wooden[0] ?? chestNftAddrs.iron[0] ?? chestNftAddrs.silver[0];
      if (!firstAddr) throw new Error("No chests available");
      await submitTx({ function: `${moduleAddress}::fantasy_league::open_chest`, typeArguments: [], functionArguments: [firstAddr] });
      setChestTxConfirmed(true);
      let newCards: Card[] = [];
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const count = await refreshInventory((cards) => { newCards = cards; });
        if (count > prevCount) break;
      }
      if (newCards.length > prevCount) {
        const found = findNewCard(flCards, newCards);
        if (found) {
          setNewCardKeys((prev) => new Set([...prev, `${found.playerId}_${found.tier}`]));
          setChestCardFound(true);
          await new Promise(r => setTimeout(r, 750));
          setRevealCard(found);
        }
      }
    } catch (e: unknown) { setFlError(getErrorMessage(e)); }
    finally { setBusy(null); setOpeningChest(false); setChestCardFound(false); }
  }

  async function onMerge(playerId: number, tier: number, cardAddrsToBurn: string[]) {
    if (!walletAccount) return;
    if (cardAddrsToBurn.length !== 5) {
      setFlError(lang === "ru"
        ? "Для MERGE нужно выбрать ровно 5 доступных карточек."
        : "MERGE requires exactly 5 available cards.");
      return;
    }
    setMergingCard({ playerId, tier });
    setMergeTxConfirmed(false);
    setMergeAnimDone(false);
    setMergeResultCard(null);
    setBusy(`fl_merge_${playerId}_${tier}`);
    setFlError("");
    try {
      await submitTx({
        function: `${moduleAddress}::fantasy_league::merge_cards`,
        typeArguments: [],
        functionArguments: [playerId, tier, cardAddrsToBurn],
      });
      setMergeTxConfirmed(true);
      await refreshInventory();
      setMergeResultCard({ playerId, tier: tier + 1 });
    } catch (e: unknown) {
      setFlError(getErrorMessage(e));
      setMergingCard(null);
    }
    finally { setBusy(null); }
  }

  return {
    chestBuyModal, setChestBuyModal, chestBuyQty, setChestBuyQty,
    chestOpenModal, setChestOpenModal, chestOpenQty, setChestOpenQty,
    chestPrice, setChestPrice, chestPrices, setChestPrices,
    tierMults, setTierMults, chestCounts, setChestCounts,
    chestNftAddrs, setChestNftAddrs, freeClaimed, setFreeClaimed,
    flCards, setFlCards, flChests, setFlChests,
    flInitialized, setFlInitialized, flInventoryChecked, setFlInventoryChecked,
    flError, setFlError, flRefreshing, setFlRefreshing,
    openingChest, setOpeningChest, openingChestType, setOpeningChestType,
    chestTxConfirmed, setChestTxConfirmed, chestBuySuccess, setChestBuySuccess,
    chestCardFound, setChestCardFound,
    revealCard, setRevealCard, revealCards, setRevealCards,
    mergingCard, setMergingCard, mergeTxConfirmed, setMergeTxConfirmed,
    mergeAnimDone, setMergeAnimDone, mergeResultCard, setMergeResultCard,
    newCardKeys, setNewCardKeys,
    ensureInitialized, handleOnboardingCreate,
    onBuyChestTyped, onOpenChestTyped, onOpenChest, onMerge, refreshInventory,
  };
}
