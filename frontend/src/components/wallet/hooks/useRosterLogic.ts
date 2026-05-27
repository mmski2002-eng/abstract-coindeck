import { useEffect, useRef, useState } from "react";
import type { TransactionPayload, TxOptions } from "../types";
import { getErrorMessage } from "../utils";

type Card = { playerId: number; tier: number; cardAddr: string };
type UserCardsResource = { type?: string; data?: { card_addrs?: string[] } };
const MAX_NICKNAME_BYTES = 14;

function nicknameStorageKey(walletAddress: string) {
  return `player_nickname:${walletAddress.toLowerCase()}`;
}

interface Deps {
  restUrl: string;
  moduleAddress: string;
  submitTx: (p: TransactionPayload, opts?: TxOptions) => Promise<void>;
  setBusy: (v: string | null) => void;
  setOnboardingBusy: (v: boolean) => void;
  walletAccount: { address: unknown } | null | undefined;
  lang: string;
}

export function useRosterLogic({ restUrl, moduleAddress, submitTx, setBusy, setOnboardingBusy, walletAccount, lang }: Deps) {
  const refreshPromiseRef = useRef<Promise<number> | null>(null);
  const latestCardsRef = useRef<Card[]>([]);
  const [chestBuyModal, setChestBuyModal] = useState<{ type: number; label: string; emoji: string; rarity: string; desc: string; price: number; buyBg: string } | null>(null);
  const [chestBuyQty, setChestBuyQty] = useState(1);
  const [chestOpenModal, setChestOpenModal] = useState<{ type: number; label: string; emoji: string; tier: number; available: number; grad: string; ring: string; buyBg: string } | null>(null);
  const [chestOpenQty, setChestOpenQty] = useState(1);
  const [chestPrice, setChestPrice] = useState(10_000_000);
  const [chestPrices, setChestPrices] = useState({ wooden: 10_000_000, iron: 30_000_000, silver: 90_000_000 });
  const [tierMults, setTierMults] = useState([100, 140, 190, 250]);
  const [chestCounts, setChestCounts] = useState({ wooden: 0, iron: 0, silver: 0 });
  const [chestNftAddrs, setChestNftAddrs] = useState<{ wooden: string[]; iron: string[]; silver: string[] }>({ wooden: [], iron: [], silver: [] });
  const [freeClaimed, setFreeClaimed] = useState(false);
  const [flCards, setFlCards] = useState<Card[]>([]);
  const [flChests, setFlChests] = useState(0);
  const [flInitialized, setFlInitialized] = useState(false);
  const [flInventoryChecked, setFlInventoryChecked] = useState(false);
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
    fetch(`${restUrl}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: `${moduleAddress}::fantasy_league::get_chest_prices`, type_arguments: [], arguments: [] }),
    }).then((r) => r.ok ? r.json() : null).then((v) => {
      if (Array.isArray(v) && v.length === 3) {
        setChestPrices({ wooden: Number(v[0]), iron: Number(v[1]), silver: Number(v[2]) });
        setChestPrice(Number(v[0]));
      }
    }).catch(() => {});
    fetch("/api/leaderboard/config").then(r => r.ok ? r.json() : null).then(v => {
      if (v?.tierMults) setTierMults(v.tierMults);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureInitialized(nickname?: string) {
    if (flInitialized) return;
    let nickBytes = '0x';
    if (nickname) {
      const enc = new TextEncoder();
      // Keep nickname within the byte limit accepted by the contract.
      let byteLen = 0;
      let safeLen = 0;
      for (const ch of nickname) {
        const b = enc.encode(ch).length;
        if (byteLen + b > MAX_NICKNAME_BYTES) break;
        byteLen += b;
        safeLen += ch.length;
      }
      nickBytes = '0x' + Array.from(enc.encode(nickname.slice(0, safeLen)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    }
    await submitTx({
      function: `${moduleAddress}::fantasy_league::create_inventory`,
      typeArguments: [], functionArguments: [nickBytes],
    });
  }

  async function hasInventoryOnChain(): Promise<boolean> {
    if (!walletAccount) return false;
    try {
      const addr = walletAccount.address;
      const resp = await fetch(`${restUrl}/accounts/${addr}/resources?limit=9999`, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return false;
      const resources = (await resp.json()) as { type?: string }[];
      return resources.some((r) => r?.type === `${moduleAddress}::fantasy_league::UserCards`);
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
        const addr = walletAccount.address;
        const resp = await fetch(`${restUrl}/accounts/${addr}/resources?limit=9999`, {
          headers: { Accept: "application/json" },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const resources = (await resp.json()) as UserCardsResource[];

        const ucRes = resources.find((r) => r?.type === `${moduleAddress}::fantasy_league::UserCards`) ?? null;
        setFlInitialized(ucRes !== null);
        setFlInventoryChecked(true);
        const cardAddrs: string[] = ucRes?.data?.card_addrs ?? [];

        const fetchCard = async (a: string) => {
          try {
            const r = await fetch(`${restUrl}/accounts/${a}/resource/${moduleAddress}::fantasy_league::PlayerCard`, {
              headers: { Accept: "application/json" },
            });
            if (!r.ok) return null;
            const data = (await r.json()) as { data?: { player_id?: unknown; tier?: unknown } };
            return { playerId: Number(data?.data?.player_id), tier: Number(data?.data?.tier), cardAddr: a };
          } catch { return null; }
        };
        const cardObjects: (Card | null)[] = [];
        for (let i = 0; i < cardAddrs.length; i += 10) {
          const batch = await Promise.all(cardAddrs.slice(i, i + 10).map(fetchCard));
          cardObjects.push(...batch);
        }
        const cards = cardObjects.filter((c): c is Card => c !== null);
        latestCardsRef.current = cards;
        setFlCards(cards);
        onCards?.(cards);

        try {
          const nftResp = await fetch(`${restUrl}/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ function: `${moduleAddress}::fantasy_league::get_chest_nft_addrs`, type_arguments: [], arguments: [String(addr)] }),
          });
          if (nftResp.ok) {
            const result = await nftResp.json();
            const addrs: string[] = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
            const byType: { wooden: string[]; iron: string[]; silver: string[] } = { wooden: [], iron: [], silver: [] };
            await Promise.all(addrs.map(async (a) => {
              try {
                const tr = await fetch(`${restUrl}/view`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Accept: "application/json" },
                  body: JSON.stringify({ function: `${moduleAddress}::fantasy_league::get_chest_type`, type_arguments: [], arguments: [a] }),
                });
                if (tr.ok) {
                  const tv = await tr.json();
                  const t = Number(Array.isArray(tv) ? tv[0] : tv);
                  if (t === 0) byType.wooden.push(a);
                  else if (t === 1) byType.iron.push(a);
                  else byType.silver.push(a);
                }
              } catch {}
            }));
            setChestNftAddrs(byType);
            setChestCounts({ wooden: byType.wooden.length, iron: byType.iron.length, silver: byType.silver.length });
            setFlChests(byType.wooden.length + byType.iron.length + byType.silver.length);
          }
        } catch {}
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
      await submitTx({ function: `${moduleAddress}::fantasy_league::buy_chest`, typeArguments: [], functionArguments: [type, qty] });
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
