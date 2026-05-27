"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { ModalKeyframes } from "@/components/ui";
import {
  HEROES, COIN_TICKERS,
  PLAYER_TEAMS,
  ADMIN_ADDRESS, MODULE_ADDRESS, REST_URL,
} from "./wallet/constants";
import { OnboardingModal } from "./wallet/overlays/OnboardingModal";
import { MergeAnimation } from "./wallet/overlays/MergeAnimation";
import { ChestOpeningOverlay } from "./wallet/overlays/ChestOpeningOverlay";
import { ChestReveal, ChestRevealMulti } from "./wallet/overlays/ChestReveal";
import { ConnectPortals } from "./wallet/overlays/ConnectPortals"
import { LineupConfirmModal } from "./wallet/overlays/LineupConfirmModal";
import { ChestBuyModal } from "./wallet/overlays/ChestBuyModal";
import { ChestOpenModal } from "./wallet/overlays/ChestOpenModal";
import { QuickBuyMergeModal } from "./wallet/overlays/QuickBuyMergeModal";
import { SellModal } from "./wallet/overlays/SellModal";
import { TransferModal } from "./wallet/overlays/TransferModal";
import { RankingsTab } from "./wallet/tabs/RankingsTab";
import { MarketplaceTab } from "./wallet/tabs/MarketplaceTab";
import { RosterTab } from "./wallet/tabs/RosterTab";
import { TournamentTab } from "./wallet/tabs/TournamentTab";
import { AdminTab } from "./wallet/tabs/AdminTab"
import { useRankingsLogic } from "./wallet/hooks/useRankingsLogic"
import { useMarketplaceLogic } from "./wallet/hooks/useMarketplaceLogic"
import { useTournamentLogic } from "./wallet/hooks/useTournamentLogic"
import { useRosterLogic } from "./wallet/hooks/useRosterLogic"
import { useAdminLogic } from "./wallet/hooks/useAdminLogic"
import { getErrorMessage } from "./wallet/utils";
import type { Listing, QuickBuyMergeData, RankRow, TxOptions } from "./wallet/types";

type RazorKit = typeof import("@razorlabs/razorkit");

type TransactionPayload = {
  function: string;
  typeArguments: unknown[];
  functionArguments: unknown[];
};

type WalletNetwork = { chainId?: number; name?: string };
type WalletWithAdapter = { adapter?: { network?: () => Promise<WalletNetwork | null> } };
type WalletTxResponse = { hash?: string; transaction_hash?: string };
type TxProvider = { waitForTransaction?: (args: { transactionHash: string }) => Promise<unknown> };
type WalletOption = { name?: string; label?: string; adapter?: { name?: string; providerName?: string }; iconUrl?: string; downloadUrl?: unknown };
type CardData = { playerId: number; tier: number; cardAddr: string };
type CardGroup = { playerId: number; tier: number; count: number };
type ChainHelpers = {
  useSwitchChain?: () => { switchChain: (chainId: number) => unknown };
  useChainId?: () => number;
};

const RAZORKIT_LAST_CONNECT_WALLET_KEY = "WK__LAST_CONNECT_WALLET_NAME";

function isMetaMaskWalletOption(walletOption: WalletOption | string | null | undefined): boolean {
  const option = typeof walletOption === "string" ? { name: walletOption } : walletOption;
  if (!option) return false;

  const searchable = [
    option.name,
    option.label,
    option.adapter?.name,
    option.adapter?.providerName,
    option.iconUrl,
    typeof option.downloadUrl === "string" ? option.downloadUrl : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes("metamask") || searchable.includes("nkbihfbeogaeaoehlefnkodbefgpgknn");
}

function useRazorKit() {
  const [kit, setKit] = useState<RazorKit | null>(null);
  useEffect(() => {
    let mounted = true;
    import("@razorlabs/razorkit")
      .then((m) => { if (mounted) setKit(m); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  return kit;
}

type Tab = "roster" | "marketplace" | "tournament" | "rankings" | "admin";

const TOUR_DEMO_CARDS: CardData[] = [
  { playerId: 0, tier: 0, cardAddr: "tour-demo-btc-1" },
  { playerId: 0, tier: 0, cardAddr: "tour-demo-btc-2" },
  { playerId: 1, tier: 1, cardAddr: "tour-demo-eth-1" },
  { playerId: 4, tier: 2, cardAddr: "tour-demo-sol-1" },
  { playerId: 8, tier: 0, cardAddr: "tour-demo-apt-1" },
  { playerId: 10, tier: 3, cardAddr: "tour-demo-uni-1" },
];

const TOUR_DEMO_LISTINGS: Listing[] = [
  { id: 9001, seller: "0x1111111111111111111111111111111111111111111111111111111111111111", playerId: 0, tier: 0, price: 12_000_000 },
  { id: 9002, seller: "0x2222222222222222222222222222222222222222222222222222222222222222", playerId: 1, tier: 1, price: 38_000_000 },
  { id: 9003, seller: "0x3333333333333333333333333333333333333333333333333333333333333333", playerId: 4, tier: 2, price: 95_000_000 },
  { id: 9004, seller: "0x4444444444444444444444444444444444444444444444444444444444444444", playerId: 8, tier: 0, price: 10_500_000 },
  { id: 9005, seller: "0x5555555555555555555555555555555555555555555555555555555555555555", playerId: 10, tier: 3, price: 240_000_000 },
];

const TOUR_DEMO_RANKS: RankRow[] = [
  { addr: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", nickname: "SatoshiPilot", score: 1480, league: 0, days: 3, prevDayPids: [0, 1, 4, 8, 10], prevDayTiers: [0, 0, 0, 0, 0] },
  { addr: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", nickname: "DeckWhale", score: 2360, league: 1, days: 3, prevDayPids: [1, 4, 7, 12, 18], prevDayTiers: [1, 1, 0, 1, 0] },
  { addr: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", nickname: "AlphaStack", score: 3890, league: 2, days: 3, prevDayPids: [4, 10, 16, 21, 29], prevDayTiers: [2, 2, 1, 1, 0] },
];

function Inner({
  kit,
  activeTab,
  setActiveTab,
  onAdminChange,
  tourDemoMode,
  onStartTour,
}: {
  kit: RazorKit;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onAdminChange?: (v: boolean) => void;
  tourDemoMode?: boolean;
  onStartTour?: () => void;
}) {
  const { lang } = useI18n();
  const wallet = kit.useWallet();
  const provider = kit.useProvider(REST_URL);
  const ABSTRACT_TESTNET_CHAIN_ID = 250;
  const chainHelpers = kit as RazorKit & ChainHelpers;
  const { switchChain } = chainHelpers.useSwitchChain?.() ?? { switchChain: () => undefined };
  const currentChainId = chainHelpers.useChainId?.();
  const restUrl = REST_URL;
  const moduleAddress = MODULE_ADDRESS;

  // kit.useChainId() is set once at connect and never updates — poll adapter.network() directly
  const [adapterWrongNetwork, setAdapterWrongNetwork] = useState<boolean | null>(null);
  useEffect(() => {
    if (!wallet.connected) { setAdapterWrongNetwork(null); return; }
    let cancelled = false;
    async function poll() {
      try {
        const net = await (wallet as WalletWithAdapter).adapter?.network?.();
        if (cancelled || !net) return;
        const onTestnet =
          net.chainId === ABSTRACT_TESTNET_CHAIN_ID ||
          (typeof net.name === "string" && net.name.toLowerCase().includes("testnet") && !net.name.toLowerCase().includes("mainnet"));
        setAdapterWrongNetwork(!onTestnet);
      } catch { /* adapter.network() unsupported */ }
    }
    poll();
    const id = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [wallet]);

  const wrongNetwork = wallet.connected && (
    adapterWrongNetwork !== null ? adapterWrongNetwork : currentChainId !== ABSTRACT_TESTNET_CHAIN_ID
  );

  // ── Connect modal ────────────────────────────────────────────────────────────
  const [ctaHost, setCtaHost] = useState<HTMLElement | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectingWalletName, setConnectingWalletName] = useState("");
  const [connectStep, setConnectStep] = useState<"list" | "connecting">("list");
  const [connectHint, setConnectHint] = useState("");
  const [connectStartedAt, setConnectStartedAt] = useState(0);

  useEffect(() => {
    const el = document.getElementById("wallet-cta");
    setCtaHost(el instanceof HTMLElement ? el : null);
  }, []);

  useEffect(() => {
    if (!connectOpen) return;
    if (wallet.connected) {
      setConnectOpen(false); setConnectStep("list"); setConnectHint(""); setConnectStartedAt(0);
      return;
    }
    if (connectStep !== "connecting" || !connectStartedAt) return;
    const t = window.setTimeout(() => {
      setConnectHint(
        lang === "ru"
          ? "Если окно кошелька не появилось: проверь, что расширение не заблокировано всплывающими окнами."
          : "If the wallet window didn't appear: make sure popups aren't blocked.",
      );
    }, 2500);
    return () => window.clearTimeout(t);
  }, [connectOpen, connectStep, connectStartedAt, wallet.connected, lang]);

  // ── shared state ─────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [quickBuyMergeModal, setQuickBuyMergeModal] = useState<QuickBuyMergeData | null>(null);

  // ── roster logic (hook) ──────────────────────────────────────────────────────
  const {
    chestBuyModal, setChestBuyModal, chestBuyQty, setChestBuyQty,
    chestOpenModal, setChestOpenModal, chestOpenQty, setChestOpenQty,
    chestPrices, setChestPrices,
    tierMults, setTierMults, chestCounts,
    flCards,
    flInitialized, flInventoryChecked,
    flError, setFlError,
    openingChest, setOpeningChest, openingChestType,
    chestTxConfirmed, chestBuySuccess,
    chestCardFound,
    revealCard, setRevealCard, revealCards, setRevealCards,
    mergingCard, setMergingCard, mergeTxConfirmed,
    mergeAnimDone, setMergeAnimDone, mergeResultCard, setMergeResultCard,
    newCardKeys,
    ensureInitialized, handleOnboardingCreate,
    onBuyChestTyped, onOpenChestTyped, onMerge, refreshInventory,
  } = useRosterLogic({ submitTx, setBusy, setOnboardingBusy, walletAccount: wallet.account, lang, restUrl, moduleAddress });

  // ── tournament logic (hook) ───────────────────────────────────────────────────
  const {
    tnState, tnLineups, oracleDayCache, setOracleDayCache,
    tnError, tnRefreshing,
    tnSelectedCards, setTnSelectedCards,
    lineupPickerSlot, setLineupPickerSlot, lineupPickerTier, setLineupPickerTier,
    lineupPickerSearch, setLineupPickerSearch, lineupConfirmOpen, setLineupConfirmOpen,
    roleBonusPct, setRoleBonusPct, viewEpoch, setViewEpoch,
    epochRange, epochPageStart, setEpochPageStart,
    resultsMode, setResultsMode, expandedPortfolios, setExpandedPortfolios,
    resultsDay, setResultsDay, resultsEpoch, setResultsEpoch, resultsDaysLoading,
    dayCountdown,
    lockedCardAddrs, cancelFee,
    refreshTournament,
    onSubmitLineup, onCancelLineup, fetchOracleDays, heroScore,
    fetchMarketSnapshot, marketSnapshotCache, fetchLineupStats, lineupStatsCache,
  } = useTournamentLogic({ submitTx, setBusy, flCards, walletAccount: wallet.account, lang, restUrl, moduleAddress });

  // ── filter / sort state ───────────────────────────────────────────────────────
  const [filterTeam, setFilterTeam] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"rarity" | "progress">("progress");
  const [rosterPage, setRosterPage] = useState(0);
  const ROSTER_PAGE_SIZE = 15;

  // ── marketplace logic (hook) ──────────────────────────────────────────────────
  const {
    mpListings, mpError, mpRefreshing,
    sellModal, setSellModal, sellPrice, setSellPrice,
    transferModal, setTransferModal, transferRecipient, setTransferRecipient,
    mpFilterTier, setMpFilterTier, mpFilterTeam, setMpFilterTeam,
    mpSearchTicker, setMpSearchTicker,
    mpPage, setMpPage, MP_PAGE_SIZE,
    myListingsPage, setMyListingsPage,
    refreshListings, onListCard, onTransferCard, onBuyCard, onBuyCards, onCancelListing,
  } = useMarketplaceLogic({ submitTx, setBusy, flCards, lockedCardAddrs, setFlError, refreshInventory,
    walletAccount: wallet.account, ensureInitialized, restUrl, moduleAddress });

  const accountAddress = wallet.account ? String(wallet.account.address) : null;
  const displayFlCards = useMemo(
    () => (tourDemoMode && flCards.length === 0 ? TOUR_DEMO_CARDS : flCards),
    [tourDemoMode, flCards],
  );
  const displayChestCounts = useMemo(
    () => (tourDemoMode && chestCounts.wooden + chestCounts.iron + chestCounts.silver === 0
      ? { wooden: 1, iron: 1, silver: 0 }
      : chestCounts),
    [tourDemoMode, chestCounts],
  );
  useEffect(() => {
    if (mergeAnimDone && mergeResultCard) {
      setRevealCard(mergeResultCard);
      setMergeResultCard(null);
      setMergeAnimDone(false);
      setMergingCard(null);
    }
  }, [mergeAnimDone, mergeResultCard, setMergeAnimDone, setMergeResultCard, setMergingCard, setRevealCard]);

  // ── rankings logic (hook) ─────────────────────────────────────────────────────
  const {
    lbRows, lbLoading, lbError,
    lbLeagueFilter, setLbLeagueFilter,
    fetchRankings,
  } = useRankingsLogic({ tnState, roleBonusPct, epochRange });
  const displayLbRows = tourDemoMode && lbRows.length === 0 ? TOUR_DEMO_RANKS : lbRows;

  // ── admin logic (hook) ────────────────────────────────────────────────────────
  const {
    adminBusy, adminError, setAdminError, adminOk, setAdminOk,
    governancePolicy, pendingAdminActions, baseUris, adminAddresses, adminRoles, fetchGovernanceState,
    prizeConfig, setPrizeConfig, prizeGenLoading, setPrizeGenLoading,
    leagueInfoOpen, setLeagueInfoOpen,
    claimState, userClaimable, setUserClaimable,
    withdrawToClaimAmount, setWithdrawToClaimAmount,
    claimListText, setClaimListText,
    oracleDateInput, setOracleDateInput,
    parseStatus, setParseStatus, parseProgress, parseTotal, parseError, setParseError,
    heroStats, setHeroStats,
    mkStats, calcPts, setHero, getOracleWindow, applyMarketData,
    fetchAllData, pollJobStatus, adminTx, fetchClaimState, buildAdminAuthBody,
  } = useAdminLogic({
    submitTx,
    refreshTournament,
    restUrl,
    moduleAddress,
    walletAccount: wallet.account,
    walletSignMessage: wallet.signMessage,
    tournamentStartTs: tnState?.startTimestamp ?? null,
  });

  const isAdmin = !!accountAddress && (
    accountAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase() ||
    adminAddresses.some((addr) => addr.toLowerCase() === accountAddress.toLowerCase()) ||
    adminRoles.some((entry) => entry.addr.toLowerCase() === accountAddress.toLowerCase() && entry.roles > 0)
  );

  useEffect(() => { onAdminChange?.(isAdmin); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── contract helpers ──────────────────────────────────────────────────────────
  async function submitTx(payload: TransactionPayload, opts?: TxOptions) {
    if (opts?.skipSimulation) {
      const aptosClient = provider as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let rawTx: unknown;
      try {
        rawTx = await aptosClient.transaction.build.simple({
          sender: wallet.address!,
          data: {
            function: payload.function,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments,
          },
          options: { maxGasAmount: opts.maxGasAmount ?? 10000 },
        });
      } catch (e) {
        console.error("[submitTx] build failed:", e);
        throw e;
      }
      let signResult: Awaited<ReturnType<typeof wallet.signTransaction>>;
      try {
        signResult = await wallet.signTransaction(rawTx as Parameters<typeof wallet.signTransaction>[0]);
      } catch (e) {
        console.error("[submitTx] signTransaction failed:", e);
        throw e;
      }
      if (signResult.status !== "Approved") throw new Error("Transaction rejected by user");
      let pending: { hash?: string } | undefined;
      try {
        pending = await aptosClient.transaction.submit.simple({
          transaction: rawTx,
          senderAuthenticator: signResult.args,
        });
      } catch (e) {
        console.error("[submitTx] submit failed:", e);
        throw e;
      }
      const hash = pending?.hash;
      console.log("[submitTx] submitted hash:", hash);
      if (hash) {
        try { await (provider as TxProvider).waitForTransaction?.({ transactionHash: hash }); }
        catch { await new Promise((r) => setTimeout(r, 2000)); }
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
      return;
    }
    const resp = await wallet.signAndSubmitTransaction({ payload, ...opts } as Parameters<typeof wallet.signAndSubmitTransaction>[0]) as WalletTxResponse;
    const hash = resp.hash ?? resp.transaction_hash;
    if (hash) {
      try { await (provider as TxProvider).waitForTransaction?.({ transactionHash: hash }); }
      catch { await new Promise((r) => setTimeout(r, 2000)); }
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }


  useEffect(() => { void refreshInventory(); }, [accountAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === "tournament" || activeTab === "rankings" || activeTab === "roster") void refreshTournament();
  }, [accountAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function pollClaim() {
      void fetchClaimState();
      if (accountAddress) {
        fetch(`${restUrl}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: `${moduleAddress}::claim::get_claimable`, type_arguments: [], arguments: [accountAddress] }),
        }).then((r) => r.ok ? r.json() : null).then((v) => {
          setUserClaimable(typeof v === "string" ? Number(v) : Array.isArray(v) ? Number(v[0]) : 0);
        }).catch(() => {});
      } else {
        setUserClaimable(0);
      }
    }
    pollClaim();
    const id = setInterval(pollClaim, 30_000);
    return () => clearInterval(id);
  }, [accountAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── marketplace functions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "marketplace") void refreshListings();
    if (activeTab === "tournament" || activeTab === "rankings" || activeTab === "roster") void refreshTournament();
    if (activeTab === "admin") {
      void refreshTournament();
      void fetchClaimState();
      void fetchGovernanceState();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== "rankings" && activeTab !== "admin") return;
    if (!tnState) return;
    void fetchRankings("total", epochRange[1] ?? 1);
  }, [activeTab, epochRange, tnState?.currentDay, tnState?.totalDays, roleBonusPct]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!quickBuyMergeModal) return;
    void refreshListings();
  }, [quickBuyMergeModal]); // eslint-disable-line react-hooks/exhaustive-deps


  async function onClaim() {
    if (!wallet.account) return;
    setBusy("claim");
    try {
      await submitTx({
        function: `${moduleAddress}::claim::claim`,
        typeArguments: [],
        functionArguments: [],
      });
      setUserClaimable(0);
      await fetchClaimState();
    } catch (e: unknown) { setFlError(getErrorMessage(e)); }
    finally { setBusy(null); }
  }

  async function onCreateAccountAndStartTour(nickname: string) {
    await handleOnboardingCreate(nickname);
    window.setTimeout(() => onStartTour?.(), 350);
  }

  // ── derived data ──────────────────────────────────────────────────────────────
  const mergeReadyCount = useMemo(() => {
    const map = new Map<string, { count: number; tier: number }>();
    for (const c of displayFlCards) {
      const key = `${c.playerId}_${c.tier}`;
      const ex = map.get(key);
      if (ex) ex.count++;
      else map.set(key, { count: 1, tier: c.tier });
    }
    return Array.from(map.values()).filter((g) => g.count >= 5 && g.tier < 3).length;
  }, [displayFlCards]);

  const flGroups = useMemo(() => {
    const map = new Map<string, CardGroup>();
    for (const c of displayFlCards) {
      const key = `${c.playerId}_${c.tier}`;
      const ex = map.get(key);
      if (ex) ex.count++;
      else map.set(key, { playerId: c.playerId, tier: c.tier, count: 1 });
    }
    let arr = Array.from(map.values());

    if (filterTeam) arr = arr.filter((g) => PLAYER_TEAMS[g.playerId] === filterTeam);
    if (filterTier !== null) arr = arr.filter((g) => g.tier === filterTier);

    if (sortBy === "rarity") arr.sort((a, b) => b.tier - a.tier || a.playerId - b.playerId);
    else arr.sort((a, b) => b.count - a.count || a.playerId - b.playerId);

    return arr;
  }, [displayFlCards, filterTeam, filterTier, sortBy]);

  useEffect(() => { setRosterPage(0); }, [filterTeam, filterTier, sortBy]);

  const mpFiltered = useMemo(
    () => mpListings.filter((l) =>
      (mpFilterTier === null || l.tier === mpFilterTier) &&
      (mpFilterTeam === null || PLAYER_TEAMS[l.playerId] === mpFilterTeam) &&
      (!mpSearchTicker || COIN_TICKERS[l.playerId].toLowerCase().includes(mpSearchTicker.toLowerCase()) || HEROES[l.playerId].toLowerCase().includes(mpSearchTicker.toLowerCase()))
    ).sort((a, b) => a.price - b.price || a.id - b.id),
    [mpListings, mpFilterTier, mpFilterTeam, mpSearchTicker]
  );
  const displayMpListings = tourDemoMode && mpListings.length === 0 ? TOUR_DEMO_LISTINGS : mpListings;
  const displayMpFiltered = tourDemoMode && mpFiltered.length === 0 ? TOUR_DEMO_LISTINGS : mpFiltered;

  useEffect(() => { setMpPage(0); }, [mpFilterTier, mpFilterTeam, mpSearchTicker, setMpPage]);

  const mpFilteredPage = useMemo(
    () => displayMpFiltered.slice(mpPage * MP_PAGE_SIZE, (mpPage + 1) * MP_PAGE_SIZE),
    [displayMpFiltered, mpPage, MP_PAGE_SIZE]
  );

  const availableWallets = useMemo(
    () => wallet.allAvailableWallets.filter((w: WalletOption) => !isMetaMaskWalletOption(w)),
    [wallet.allAvailableWallets],
  );

  const flGroupsPage = useMemo(
    () => flGroups.slice(rosterPage * ROSTER_PAGE_SIZE, (rosterPage + 1) * ROSTER_PAGE_SIZE),
    [flGroups, rosterPage]
  );



  // ── connect portal handlers ──────────────────────────────────────────────────
  function clearWalletLocalStorage(addr: string) {
    try {
      const prefix = `coindeck_`;
      const addrLower = addr.toLowerCase();
      Object.keys(localStorage)
        .filter(k => k.startsWith(prefix) && k.toLowerCase().includes(addrLower))
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem("player_nickname");
    } catch {}
  }

  async function onCTAClick() {
    try {
      setConnectError("");
      if (wallet.connected) {
        if (accountAddress) clearWalletLocalStorage(accountAddress);
        await wallet.disconnect();
        return;
      }
      setConnectOpen(true); setConnectStep("list"); setConnectHint("");
    } catch (e: unknown) { setConnectError(getErrorMessage(e)); }
  }

  async function onSelectWallet(name: string) {
    try {
      setConnectError(""); setConnectingWalletName(name);
      if (isMetaMaskWalletOption(name)) {
        setConnectStep("list");
        setConnectError(lang === "ru"
          ? "MetaMask не поддерживает это Abstract/Aptos подключение. Используйте Nightly, Petra, Razor Wallet или OKX."
          : "MetaMask does not support this Abstract/Aptos connection. Use Nightly, Petra, Razor Wallet, or OKX.");
        return;
      }
      setConnectStep("connecting"); setConnectStartedAt(Date.now());
      await wallet.select(name);
      window.setTimeout(() => {
        if (wallet.status === "disconnected") {
          setConnectStep("list");
          setConnectError(lang === "ru"
            ? `Кошелёк "${name}" не начал подключение.`
            : `Wallet "${name}" did not start connecting.`);
        }
      }, 400);
    } catch (e: unknown) { setConnectError(getErrorMessage(e)); setConnectStep("list"); }
    finally { setConnectingWalletName(""); }
  }

  function onBackFromConnecting() {
    setConnectStep("list"); setConnectHint(""); setConnectingWalletName(""); setConnectStartedAt(0);
  }
  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="text-zinc-50">
      <ModalKeyframes />

      {/* Wrong network blocker — must switch to Abstract Testnet before anything else */}
      {wrongNetwork && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0a0c18] p-8 text-center shadow-2xl">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="mb-2 text-lg font-bold text-white">
              {lang === "ru" ? "Неправильная сеть" : "Wrong Network"}
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              {lang === "ru"
                ? "Подключите кошелёк к сети Abstract Testnet, чтобы продолжить."
                : "Please switch your wallet to Abstract Testnet to continue."}
            </p>
            <button
              onClick={() => switchChain(ABSTRACT_TESTNET_CHAIN_ID)}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 py-3 text-sm font-bold text-white hover:opacity-90 transition">
              {lang === "ru" ? "Переключить на Testnet" : "Switch to Testnet"}
            </button>
          </div>
        </div>
      )}

      {/* Onboarding modal for new users */}
      {wallet.connected && flInventoryChecked && !flInitialized && (
        <OnboardingModal onCreateAccount={onCreateAccountAndStartTour} busy={onboardingBusy} lang={lang} tierMults={tierMults} />
      )}

      {/* Merge animation */}
      {mergingCard && (
        <MergeAnimation
          card={mergingCard}
          txConfirmed={mergeTxConfirmed}
          cardReady={mergeResultCard !== null}
          onComplete={() => setMergeAnimDone(true)}
          lang={lang}
        />
      )}

      {/* Chest opening animation */}
      {openingChest && (
        <ChestOpeningOverlay chestType={openingChestType} txConfirmed={chestTxConfirmed} cardFound={chestCardFound} lang={lang} onSkip={() => setOpeningChest(false)} />
      )}

      {/* Chest reveal overlay */}
      {revealCard && (
        <ChestReveal card={revealCard} onClose={() => setRevealCard(null)} lang={lang} />
      )}

      {/* Batch chest reveal */}
      {revealCards && (
        <ChestRevealMulti cards={revealCards} onClose={() => setRevealCards(null)} lang={lang} />
      )}

      {/* Lineup confirmation modal */}
      {lineupConfirmOpen && tnState && (
        <LineupConfirmModal
          lang={lang}
          tnState={tnState}
          epochRange={epochRange}
          roleBonusPct={roleBonusPct}
          tnSelectedCards={tnSelectedCards}
          flCards={flCards}
          busy={busy}
          setLineupConfirmOpen={setLineupConfirmOpen}
          onSubmitLineup={onSubmitLineup}
        />
      )}

      {chestBuyModal && (
        <ChestBuyModal
          lang={lang}
          modal={chestBuyModal}
          onClose={() => setChestBuyModal(null)}
          chestBuyQty={chestBuyQty}
          setChestBuyQty={setChestBuyQty}
          busy={busy}
          onBuyChestTyped={onBuyChestTyped}
        />
      )}

      {chestOpenModal && (
        <ChestOpenModal
          lang={lang}
          modal={chestOpenModal}
          onClose={() => setChestOpenModal(null)}
          chestOpenQty={chestOpenQty}
          setChestOpenQty={setChestOpenQty}
          busy={busy}
          onOpenChestTyped={onOpenChestTyped}
        />
      )}

      {quickBuyMergeModal && (
        <QuickBuyMergeModal
          lang={lang}
          modal={quickBuyMergeModal}
          mpListings={mpListings}
          accountAddress={accountAddress}
          busy={busy}
          mpRefreshing={mpRefreshing}
          onClose={() => setQuickBuyMergeModal(null)}
          onBuyCards={onBuyCards}
        />
      )}

      <ConnectPortals
        lang={lang}
        ctaHost={ctaHost}
        wrongNetwork={wrongNetwork}
        walletConnected={wallet.connected}
        walletConnecting={!!wallet.connecting}
        wallets={availableWallets}
        walletAddress={accountAddress}
        switchChainToTestnet={() => switchChain(ABSTRACT_TESTNET_CHAIN_ID)}
        onCTAClick={onCTAClick}
        onDisconnect={async () => {
          try { await wallet.disconnect(); } catch (e: unknown) { setConnectError(getErrorMessage(e)); }
        }}
        connectOpen={connectOpen}
        setConnectOpen={setConnectOpen}
        connectStep={connectStep}
        connectError={connectError}
        connectHint={connectHint}
        connectingWalletName={connectingWalletName}
        onSelectWallet={onSelectWallet}
        onBackFromConnecting={onBackFromConnecting}
      />

      <main className="mx-auto w-full max-w-6xl px-6 py-6" data-tour="tour-finish">

        {/* ── Roster tab ── */}
        {activeTab === "roster" && (
          <RosterTab
            lang={lang}
            walletConnected={wallet.connected || !!tourDemoMode}
            hasWalletAccount={!!wallet.account || !!tourDemoMode}
            flCards={displayFlCards}
            flGroups={flGroups}
            flGroupsPage={flGroupsPage}
            chestCounts={displayChestCounts}
            chestPrices={chestPrices}
            mergeReadyCount={mergeReadyCount}
            flError={flError}
            busy={busy}
            newCardKeys={newCardKeys}
            filterTeam={filterTeam}
            filterTier={filterTier}
            sortBy={sortBy}
            rosterPage={rosterPage}
            claimState={claimState}
            userClaimable={userClaimable}
            chestBuySuccess={chestBuySuccess}
            setFilterTeam={setFilterTeam}
            setFilterTier={setFilterTier}
            setSortBy={setSortBy}
            setRosterPage={setRosterPage}
            setActiveTab={setActiveTab}
            setChestBuyModal={setChestBuyModal}
            setChestBuyQty={setChestBuyQty}
            setChestOpenModal={setChestOpenModal}
            setChestOpenQty={setChestOpenQty}
            setSellModal={setSellModal}
            setSellPrice={setSellPrice}
            setTransferModal={setTransferModal}
            setTransferRecipient={setTransferRecipient}
            setQuickBuyMergeModal={setQuickBuyMergeModal}
            onMerge={onMerge}
            lockedCardAddrs={lockedCardAddrs}
          />
        )}

        {/* ── Marketplace tab ── */}
        {activeTab === "marketplace" && (
          <MarketplaceTab
            lang={lang}
            mpError={mpError}
            mpListings={displayMpListings}
            mpFiltered={displayMpFiltered}
            mpFilteredPage={mpFilteredPage}
            mpFilterTier={mpFilterTier}
            setMpFilterTier={setMpFilterTier}
            mpFilterTeam={mpFilterTeam}
            setMpFilterTeam={setMpFilterTeam}
            mpSearchTicker={mpSearchTicker}
            setMpSearchTicker={setMpSearchTicker}
            mpRefreshing={mpRefreshing}
            mpPage={mpPage}
            setMpPage={setMpPage}
            myListingsPage={myListingsPage}
            setMyListingsPage={setMyListingsPage}
            accountAddress={accountAddress}
            hasWalletAccount={!!wallet.account}
            busy={busy}
            onBuyCard={onBuyCard}
            onCancelListing={onCancelListing}
          />
        )}
        {sellModal && (
          <SellModal
            lang={lang}
            modal={sellModal}
            onClose={() => setSellModal(null)}
            sellPrice={sellPrice}
            setSellPrice={setSellPrice}
            busy={busy}
            onListCard={onListCard}
          />
        )}

        {transferModal && (
          <TransferModal
            lang={lang}
            modal={transferModal}
            onClose={() => setTransferModal(null)}
            transferRecipient={transferRecipient}
            setTransferRecipient={setTransferRecipient}
            busy={busy}
            onTransferCard={onTransferCard}
          />
        )}

        {/* ── Tournament tab ── */}
        {activeTab === "tournament" && (
          <TournamentTab
            lang={lang}
            tnError={tnError}
            tnState={tourDemoMode && !tnState ? {
              active: true,
              currentDay: 1,
              startTimestamp: Math.floor(Date.now() / 1000) - 3600,
              prizePool: 1_000_000_000,
              ended: false,
              epoch: epochRange[1] ?? 1,
              totalDays: 6,
            } : tnState}
            epochRange={epochRange}
            epochPageStart={epochPageStart}
            setEpochPageStart={setEpochPageStart}
            viewEpoch={viewEpoch}
            setViewEpoch={setViewEpoch}
            dayCountdown={dayCountdown}
            tnLineups={tnLineups}
            oracleDayCache={oracleDayCache}
            tnSelectedCards={tnSelectedCards}
            setTnSelectedCards={setTnSelectedCards}
            lineupPickerSlot={lineupPickerSlot}
            setLineupPickerSlot={setLineupPickerSlot}
            lineupPickerTier={lineupPickerTier}
            setLineupPickerTier={setLineupPickerTier}
            lineupPickerSearch={lineupPickerSearch}
            setLineupPickerSearch={setLineupPickerSearch}
            setLineupConfirmOpen={setLineupConfirmOpen}
            expandedPortfolios={expandedPortfolios}
            setExpandedPortfolios={setExpandedPortfolios}
            roleBonusPct={roleBonusPct}
            claimState={claimState}
            userClaimable={userClaimable}
            resultsMode={resultsMode}
            setResultsMode={setResultsMode}
            resultsDay={resultsDay}
            setResultsDay={setResultsDay}
            resultsEpoch={resultsEpoch}
            setResultsEpoch={setResultsEpoch}
            tnRefreshing={tnRefreshing}
            resultsDaysLoading={resultsDaysLoading}
            flCards={displayFlCards}
            busy={busy}
            hasWalletAccount={!!wallet.account || !!tourDemoMode}
            heroScore={heroScore}
            fetchOracleDays={fetchOracleDays}
            onClaim={onClaim}
            lockedCardAddrs={lockedCardAddrs}
            cancelFee={cancelFee}
            onCancelLineup={onCancelLineup}
            fetchMarketSnapshot={fetchMarketSnapshot}
            marketSnapshotCache={marketSnapshotCache}
            fetchLineupStats={fetchLineupStats}
            lineupStatsCache={lineupStatsCache}
          />
        )}

        {/* ── Rankings tab ── */}
        {activeTab === "rankings" && (
          <RankingsTab
            lang={lang}
            epochRange={epochRange}
            tnState={tnState}
            lbRows={displayLbRows}
            lbLoading={tourDemoMode && lbRows.length === 0 ? false : lbLoading}
            lbError={lbError}
            lbLeagueFilter={lbLeagueFilter}
            setLbLeagueFilter={setLbLeagueFilter}
            accountAddress={accountAddress}
            leagueInfoOpen={leagueInfoOpen}
            setLeagueInfoOpen={setLeagueInfoOpen}
            tnLineups={tnLineups}
            prizeConfig={prizeConfig}
          />
        )}

        {/* ── Admin tab ── */}
        {activeTab === "admin" && (
          <AdminTab
            lang={lang}
            isAdmin={isAdmin}
              adminError={adminError}
              setAdminError={setAdminError}
              adminOk={adminOk}
              setAdminOk={setAdminOk}
              governancePolicy={governancePolicy}
              pendingAdminActions={pendingAdminActions}
              baseUris={baseUris}
              adminAddresses={adminAddresses}
              adminRoles={adminRoles}
              tnState={tnState}
            tnRefreshing={tnRefreshing}
            epochRange={epochRange}
            claimState={claimState}
            oracleDayCache={oracleDayCache}
            heroStats={heroStats}
            setHeroStats={setHeroStats}
            parseStatus={parseStatus}
            setParseStatus={setParseStatus}
            parseError={parseError}
            setParseError={setParseError}
            parseProgress={parseProgress}
            parseTotal={parseTotal}
            oracleDateInput={oracleDateInput}
            setOracleDateInput={setOracleDateInput}
            adminBusy={adminBusy}
            tierMults={tierMults}
            setTierMults={setTierMults}
            prizeConfig={prizeConfig}
            setPrizeConfig={setPrizeConfig}
            roleBonusPct={roleBonusPct}
            setRoleBonusPct={setRoleBonusPct}
            chestPrices={chestPrices}
            setChestPrices={setChestPrices}
            prizeGenLoading={prizeGenLoading}
            setPrizeGenLoading={setPrizeGenLoading}
            claimListText={claimListText}
            setClaimListText={setClaimListText}
            withdrawToClaimAmount={withdrawToClaimAmount}
            setWithdrawToClaimAmount={setWithdrawToClaimAmount}
            lbRows={lbRows}
            setResultsDay={setResultsDay}
            setResultsEpoch={setResultsEpoch}
            setViewEpoch={setViewEpoch}
            setOracleDayCache={setOracleDayCache}
            refreshTournament={refreshTournament}
            fetchAllData={fetchAllData}
            adminTx={adminTx}
            buildAdminAuthBody={buildAdminAuthBody}
            getOracleWindow={getOracleWindow}
            applyMarketData={applyMarketData}
            pollJobStatus={pollJobStatus}
            setHero={setHero}
            calcPts={calcPts}
            mkStats={mkStats}
              fetchClaimState={fetchClaimState}
              fetchGovernanceState={fetchGovernanceState}
              walletAccount={wallet.account}
              walletSignMessage={wallet.signMessage}
            />
        )}

      </main>
    </div>
  );
}

export function WalletApp({
  activeTab,
  setActiveTab,
  onAdminChange,
  tourDemoMode,
  onStartTour,
}: {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onAdminChange?: (v: boolean) => void;
  tourDemoMode?: boolean;
  onStartTour?: () => void;
}) {
  const kit = useRazorKit();

  const chains = useMemo(() => {
    if (!kit) return [];
    return [kit.MovementBardockTestnetChain];
  }, [kit]);

  // Clear MetaMask before WalletProvider mounts so autoConnect skips it
  useMemo(() => {
    try {
      const last = localStorage.getItem(RAZORKIT_LAST_CONNECT_WALLET_KEY);
      if (isMetaMaskWalletOption(last)) localStorage.removeItem(RAZORKIT_LAST_CONNECT_WALLET_KEY);
    } catch {}
  }, []);

  if (!kit) return null;

  return (
    <kit.WalletProvider chains={chains} autoConnect={true}>
      <Inner
        kit={kit}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdminChange={onAdminChange}
        tourDemoMode={tourDemoMode}
        onStartTour={onStartTour}
      />
    </kit.WalletProvider>
  );
}

