"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useRef, useState, useEffect } from "react";
import type { Connector } from "wagmi";
import { useConnect, useDisconnect, useAccount, useChainId, useSwitchChain, useBalance } from "wagmi";
import { abstractTestnet } from "viem/chains";

function nicknameStorageKey(addr: string) {
  return `player_nickname:${addr.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticker penguin mascot
// ─────────────────────────────────────────────────────────────────────────────
function PenguinMascot({ mood = "happy", size = 72 }: {
  mood?: "happy" | "waiting" | "celebrating" | "sad";
  size?: number;
}) {
  const isSad = mood === "sad";
  const isCelebrating = mood === "celebrating";

  return (
    <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 80 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="84" rx="20" ry="4" fill="var(--ink)" opacity="0.12"/>

      {/* Body */}
      <ellipse cx="40" cy="56" rx="26" ry="24" fill="#1C2030" stroke="var(--ink)" strokeWidth="2.5"/>
      {/* Belly */}
      <ellipse cx="40" cy="60" rx="14" ry="16" fill="#F4EFE2" stroke="var(--ink)" strokeWidth="2"/>

      {/* Left wing */}
      <path d="M16 52 Q7 61 11 71 Q17 76 22 67 Q20 58 16 52Z" fill="#1C2030" stroke="var(--ink)" strokeWidth="2"/>
      {/* Right wing — raised when celebrating */}
      {isCelebrating
        ? <path d="M64 42 Q74 34 72 24 Q66 20 60 28 Q60 38 64 42Z" fill="#1C2030" stroke="var(--ink)" strokeWidth="2"/>
        : <path d="M64 52 Q73 61 69 71 Q63 76 58 67 Q60 58 64 52Z" fill="#1C2030" stroke="var(--ink)" strokeWidth="2"/>
      }

      {/* Eyes */}
      {isSad ? (
        <>
          <path d="M31 48 Q34 46 37 48" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M43 48 Q46 46 49 48" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"/>
          <ellipse cx="32" cy="52" rx="1.5" ry="2.5" fill="#7AC7E8" opacity="0.7"/>
        </>
      ) : isCelebrating ? (
        <>
          <path d="M31 48 Q34 50 37 48" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M43 48 Q46 50 49 48" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="34" cy="48" r="3.5" fill="white" stroke="var(--ink)" strokeWidth="1.5"/>
          <circle cx="46" cy="48" r="3.5" fill="white" stroke="var(--ink)" strokeWidth="1.5"/>
          <circle cx="35" cy="48.5" r="2" fill="var(--ink)"/>
          <circle cx="47" cy="48.5" r="2" fill="var(--ink)"/>
          <circle cx="35.8" cy="47.5" r="0.8" fill="white"/>
          <circle cx="47.8" cy="47.5" r="0.8" fill="white"/>
        </>
      )}

      {/* Beak */}
      <path d="M37 53 L43 53 L40 58 Z" fill="#F2B73A" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>

      {/* Feet */}
      <path d="M30 79 Q26 75 23 79 Q27 83 34 81 Q33 79 30 79Z" fill="#F2B73A" stroke="var(--ink)" strokeWidth="1.5"/>
      <path d="M50 79 Q54 75 57 79 Q53 83 46 81 Q47 79 50 79Z" fill="#F2B73A" stroke="var(--ink)" strokeWidth="1.5"/>

      {/* Blush */}
      {(mood === "happy" || mood === "celebrating") && (
        <>
          <ellipse cx="28" cy="54" rx="4" ry="2.5" fill="#E25C5C" opacity="0.3"/>
          <ellipse cx="52" cy="54" rx="4" ry="2.5" fill="#E25C5C" opacity="0.3"/>
        </>
      )}

      {/* Golden egg for celebrating */}
      {isCelebrating && (
        <g transform="translate(54,10)">
          <ellipse cx="10" cy="13" rx="10" ry="13" fill="#F2B73A" stroke="var(--ink)" strokeWidth="2"/>
          <ellipse cx="7" cy="8" rx="3" ry="4.5" fill="white" opacity="0.3" transform="rotate(-15 7 8)"/>
        </g>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connector icon — sticker style
// ─────────────────────────────────────────────────────────────────────────────
function ConnectorIcon({ id, name }: { id: string; name: string }) {
  const lower = (id + name).toLowerCase();

  if (lower.includes("abstract")) return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "#26C6A8", border: "2px solid var(--ink)" }}>
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M5 19L12 5L19 19" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.5 14.5H16.5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  );

  if (lower.includes("metamask")) return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "#F6851B", border: "2px solid var(--ink)" }}>
      <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
        <path d="M28 4L17.6 11.6L19.5 7L28 4Z" fill="white" opacity="0.9"/>
        <path d="M4 4L14.3 11.7L12.5 7L4 4Z" fill="white" opacity="0.9"/>
        <path d="M10.4 14.4L8.7 17L14.8 17.3L14.6 10.7L10.4 14.4Z" fill="white" opacity="0.9"/>
        <path d="M21.6 14.4L17.3 10.6L17.2 17.3L23.3 17L21.6 14.4Z" fill="white" opacity="0.9"/>
        <path d="M14.8 17.3L14.2 20.6L15 24.3L15.2 19L14.8 17.3Z" fill="white"/>
        <path d="M17.2 17.3L16.8 19L17 24.3L17.8 20.6L17.2 17.3Z" fill="white"/>
      </svg>
    </div>
  );

  if (lower.includes("coinbase")) return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "#0052FF", border: "2px solid var(--ink)" }}>
      <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
        <circle cx="16" cy="16" r="11" fill="white"/>
        <rect x="11.5" y="13.5" width="9" height="5" rx="2.5" fill="#0052FF"/>
      </svg>
    </div>
  );

  if (lower.includes("walletconnect") || lower.includes("wallet connect")) return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "#3B99FC", border: "2px solid var(--ink)" }}>
      <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
        <path d="M9.5 12.5C13 9 19 9 22.5 12.5L23 13C23.5 13.5 23.5 14.5 23 15L21.5 16.5C21.25 16.75 20.75 16.75 20.5 16.5L19.5 15.5C17.5 13.5 14.5 13.5 12.5 15.5L11.3 16.7C11.05 16.95 10.55 16.95 10.3 16.7L8.8 15.2C8.3 14.7 8.3 13.7 8.8 13.2L9.5 12.5Z" fill="white"/>
        <path d="M13.5 17.5L15 19C15.5 19.5 16.5 19.5 17 19L18.5 17.5C18.75 17.25 19.25 17.25 19.5 17.5L21 19C21.5 19.5 21.5 20.5 21 21L17.5 24.5C17 25 16 25 15.5 24.5L12 21C11.5 20.5 11.5 19.5 12 19L13.5 17.5C13.75 17.25 13.25 17.25 13.5 17.5Z" fill="white"/>
      </svg>
    </div>
  );

  if (lower.includes("rabby")) return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 text-xl" style={{ background: "#8697FF", border: "2px solid var(--ink)" }}>
      🐰
    </div>
  );

  if (lower.includes("phantom")) return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "#AB9FF2", border: "2px solid var(--ink)" }}>
      <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
        <ellipse cx="16" cy="15" rx="9" ry="11" fill="white" opacity="0.9"/>
        <circle cx="13" cy="14" r="2" fill="#AB9FF2"/>
        <circle cx="19" cy="14" r="2" fill="#AB9FF2"/>
        <path d="M13 19.5 Q16 22 19 19.5" stroke="#AB9FF2" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 text-xs font-black" style={{ background: "var(--sunken)", border: "2px solid var(--ink)", color: "var(--ink-2)" }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Abstract network pill
// ─────────────────────────────────────────────────────────────────────────────
function AbstractPill() {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "var(--paper-3)", border: "2px solid var(--ink)", fontSize: 10, fontWeight: 800, letterSpacing: "0.09em", color: "var(--ink-2)", textTransform: "uppercase" }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#22C55E" }}/>
      Abstract
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticker button helper
// ─────────────────────────────────────────────────────────────────────────────
function SBtn({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  className?: string;
  disabled?: boolean;
}) {
  const base = variant === "primary"
    ? { background: "var(--mint)", color: "var(--ink)", border: "2.5px solid var(--ink)", boxShadow: "4px 4px 0 var(--shadow-sticker-color)" }
    : { background: "var(--paper-3)", color: "var(--ink-2)", border: "2px solid var(--ink)", boxShadow: "2px 2px 0 var(--shadow-sticker-color)" };
  const hoverShadow = variant === "primary" ? "2px 2px 0 var(--shadow-sticker-color)" : "1px 1px 0 var(--shadow-sticker-color)";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 rounded-2xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={base}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = hoverShadow; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = base.boxShadow; }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet dropdown (connected state)
// ─────────────────────────────────────────────────────────────────────────────
const ICON_WALLET = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 11a1 1 0 0 1 0 2"/>
    <path d="M2 10V7a2 2 0 0 1 2-2h16"/>
  </svg>
);

function WalletButton({ lang }: { lang: string }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [menuOpen, setMenuOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const wrongNetwork = isConnected && chainId !== abstractTestnet.id;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!isConnected || !menuOpen || !address) return;
    try {
      const scoped = localStorage.getItem(nicknameStorageKey(address))?.trim();
      const legacy = localStorage.getItem("player_nickname")?.trim();
      setNickname(scoped || legacy || "");
    } catch { setNickname(""); }
  }, [isConnected, menuOpen, address]);

  const shortAddr = address ? address.slice(0, 6) + "…" + address.slice(-4) : "";

  if (!isConnected) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="btn-sticker-outline flex items-center gap-1.5 px-3 py-2"
        style={wrongNetwork ? { borderColor: "var(--down)", boxShadow: "4px 4px 0 var(--down)" } : undefined}
      >
        {wrongNetwork ? (
          <>
            {ICON_WALLET}
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--down)" }}>
              {lang === "ru" ? "Сеть!" : "Net!"}
            </span>
          </>
        ) : (
          <>
            {ICON_WALLET}
            <span className="text-xs font-bold uppercase tracking-widest">{shortAddr}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50 transition-transform duration-200" style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </>
        )}
      </button>

      {menuOpen && (
        <div className="absolute top-full right-0 mt-3 w-56 z-[60]" style={{ background: "var(--paper-2)", border: "2.5px solid var(--ink)", borderRadius: 14, boxShadow: "4px 4px 0 var(--shadow-sticker-color)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.12)" }}>
            {wrongNetwork ? (
              <>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "var(--down)" }}/>
                <span className="text-xs font-bold flex-1" style={{ color: "var(--down)" }}>
                  {lang === "ru" ? "Не та сеть" : "Wrong network"}
                </span>
                <button
                  onClick={() => { switchChain({ chainId: abstractTestnet.id }); setMenuOpen(false); }}
                  className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{ background: "var(--down)", color: "#0F1115", border: "1.5px solid var(--ink)" }}
                >
                  {lang === "ru" ? "Сменить" : "Switch"}
                </button>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ background: "var(--mint)" }}/>
                <span className="text-xs font-bold" style={{ color: "var(--ink-2)" }}>Abstract Testnet</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.12)" }}>
            <svg className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <span className="text-xs font-semibold truncate flex-1" style={{ color: "var(--ink-2)" }}>{nickname || shortAddr}</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.12)" }}>
            <svg className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <button
              className="text-xs font-mono truncate flex-1 text-left transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-3)" }}
              onClick={() => { navigator.clipboard.writeText(address ?? "").catch(() => {}); setMenuOpen(false); }}
            >
              {address?.slice(0, 10)}…{address?.slice(-8)}
            </button>
          </div>

          <button
            onClick={() => { disconnect(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold transition-colors rounded-b-[11px]"
            style={{ color: "var(--down)", background: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(226,92,92,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            {lang === "ru" ? "Отключить" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect modal — 4 states: select / connecting / success / error
// ─────────────────────────────────────────────────────────────────────────────
type ModalState = "select" | "connecting" | "success" | "error";

export type ConnectModalProps = {
  lang: string;
  open: boolean;
  onClose: () => void;
};

function ConnectModal({ lang, open, onClose }: ConnectModalProps) {
  const { connect, connectors } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address });

  const [modalState, setModalState] = useState<ModalState>("select");
  const [selConnector, setSelConnector] = useState<Connector | null>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (isConnected && open && modalState === "connecting") setModalState("success");
  }, [isConnected, open, modalState]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setModalState("select"); setError(""); setCountdown(60); }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (modalState !== "connecting") { setCountdown(60); return; }
    const timer = setInterval(() => setCountdown(n => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [modalState]);

  if (!open) return null;

  const shortAddr = address ? address.slice(0, 6) + "…" + address.slice(-4) : "";
  const balanceStr = balanceData
    ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
    : "—";

  function handleConnect(connector: Connector) {
    setSelConnector(connector);
    setModalState("connecting");
    setError("");
    connect({ connector }, {
      onError: (e) => { setError(e.message); setModalState("error"); },
    });
  }

  function handleRetry() {
    if (!selConnector) return;
    setModalState("connecting");
    setError("");
    connect({ connector: selConnector }, {
      onError: (e) => { setError(e.message); setModalState("error"); },
    });
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  const selectContent = (
    <>
      <div className="px-6 pt-4 pb-2 text-center">
        <h2 className="text-2xl font-black uppercase" style={{ color: "var(--ink)", letterSpacing: -0.5 }}>
          {lang === "ru" ? "Выбери кошелёк" : "Choose Wallet"}
        </h2>
        <p className="mt-1.5 text-sm leading-snug" style={{ color: "var(--ink-3)" }}>
          {lang === "ru"
            ? "Подключись к сети Abstract, чтобы начать высиживать яйца"
            : "Connect to Abstract to start hatching eggs"}
        </p>
      </div>

      <div className="px-4 py-3 space-y-2">
        {connectors.map((connector) => {
          const isAGW = (connector.id + connector.name).toLowerCase().includes("abstract");
          return (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
              style={{
                background: isAGW ? "#E8F9F3" : "var(--paper-3)",
                border: isAGW ? "2.5px solid #5BD3B6" : "2px solid var(--ink)",
                boxShadow: isAGW ? "3px 3px 0 #3BB89A" : "2px 2px 0 var(--shadow-sticker-color)",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(1px,1px)"; e.currentTarget.style.boxShadow = isAGW ? "1px 1px 0 var(--mint-deep)" : "1px 1px 0 var(--shadow-sticker-color)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = isAGW ? "3px 3px 0 var(--mint-deep)" : "2px 2px 0 var(--shadow-sticker-color)"; }}
            >
              <ConnectorIcon id={connector.id} name={connector.name}/>
              <span className="flex-1 text-left text-sm font-bold" style={{ color: "var(--ink-2)" }}>
                {connector.name}
              </span>
              {isAGW && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--mint)", color: "var(--ink)", border: "1.5px solid var(--ink)" }}>
                  {lang === "ru" ? "Рекомендуем" : "Recommended"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-6 pb-5 text-center">
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {lang === "ru" ? "Нет кошелька? " : "No wallet? "}
          <a href="https://abs.xyz" target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: "var(--ink-2)" }}>
            {lang === "ru" ? "Создай Abstract Global Wallet за 30 секунд →" : "Create Abstract Global Wallet in 30 seconds →"}
          </a>
        </p>
      </div>
    </>
  );

  // ── Connecting ─────────────────────────────────────────────────────────────
  const connectingContent = (
    <>
      <div className="px-4 pt-3">
        <button onClick={() => setModalState("select")} className="flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-60" style={{ color: "var(--ink-3)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          {lang === "ru" ? "Назад" : "Back"}
        </button>
      </div>

      <div className="px-6 pt-2 pb-5 text-center">
        <h2 className="text-xl font-black uppercase" style={{ color: "var(--ink)", letterSpacing: -0.5 }}>
          {lang === "ru" ? "Подтверди в кошельке" : "Confirm in Wallet"}
        </h2>

        {/* Countdown timer */}
        <div className="flex justify-end px-2 mb-1">
          <span className="text-xs font-mono font-bold tabular-nums" style={{ color: countdown <= 10 ? "#FF7A6A" : "var(--ink-3)" }}>
            0:{countdown.toString().padStart(2, "0")}
          </span>
        </div>

        {/* Egg with animated dashed ring */}
        <div className="relative flex items-center justify-center my-5" style={{ height: 150 }}>
          <svg className="absolute" width="150" height="150" viewBox="0 0 150 150" fill="none">
            <circle cx="75" cy="75" r="64" stroke="var(--mint)" strokeWidth="3" strokeDasharray="12 8" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 75 75" to="360 75 75" dur="4s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <div className="absolute rounded-full" style={{ width: 120, height: 120, background: "radial-gradient(circle, rgba(38,198,168,0.18) 0%, transparent 70%)" }}/>
          <div className="egg-shake relative z-10">
            <svg width="80" height="96" viewBox="0 0 80 96" fill="none">
              <ellipse cx="40" cy="90" rx="20" ry="4" fill="var(--ink)" opacity="0.1"/>
              <path d="M40 4 C18 4 8 28 8 50 C8 72 22 88 40 88 C58 88 72 72 72 50 C72 28 62 4 40 4Z" fill="#D9D3C2" stroke="var(--ink)" strokeWidth="2.5"/>
              <ellipse cx="28" cy="26" rx="5" ry="8" fill="white" opacity="0.22" transform="rotate(-20 28 26)"/>
              <path className="crack-line" d="M40 12 L45 28 L37 36 L43 54" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-4 whitespace-pre-line" style={{ color: "var(--ink-3)" }}>
          {lang === "ru"
            ? "Открой кошелёк и подтверди подключение.\nЯйцо вот-вот треснет…"
            : "Open your wallet and confirm.\nThe egg is about to crack…"}
        </p>

        <div className="flex items-center justify-center gap-2 mb-5">
          {selConnector && <ConnectorIcon id={selConnector.id} name={selConnector.name}/>}
          <span className="text-sm font-bold" style={{ color: "var(--ink-2)" }}>{selConnector?.name}</span>
          <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: "var(--mint)" }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>

        <SBtn variant="outline" onClick={() => setModalState("select")}>
          {lang === "ru" ? "Отменить" : "Cancel"}
        </SBtn>
      </div>
    </>
  );

  // ── Success ────────────────────────────────────────────────────────────────
  const successContent = (
    <>
      <div className="px-6 pt-4 pb-2 text-center">
        <h2 className="text-2xl font-black uppercase" style={{ color: "var(--ink)", letterSpacing: -0.5 }}>
          {lang === "ru" ? "Кошелёк подключён!" : "Wallet Connected!"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          {lang === "ru" ? "Готов высиживать яйца на сети Abstract" : "Ready to hatch eggs on Abstract network"}
        </p>
      </div>

      <div className="px-4 py-3">
        <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--mint-soft)", border: "2px solid var(--ink)", boxShadow: "2px 2px 0 var(--shadow-sticker-color)" }}>
          <div className="flex items-center gap-3 mb-4">
            {selConnector && <ConnectorIcon id={selConnector.id} name={selConnector.name}/>}
            <div>
              <div className="text-sm font-black" style={{ color: "var(--ink)" }}>{selConnector?.name ?? "Wallet"}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono" style={{ color: "var(--ink-3)" }}>{shortAddr}</span>
                <button onClick={() => navigator.clipboard.writeText(address ?? "").catch(() => {})} className="transition-opacity hover:opacity-60">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ink-3)" }}>
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3" style={{ background: "var(--paper-3)", border: "1.5px solid var(--ink)" }}>
              <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>
                {lang === "ru" ? "Баланс" : "Balance"}
              </div>
              <div className="text-sm font-black" style={{ color: "var(--ink)" }}>{balanceStr}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--paper-3)", border: "1.5px solid var(--ink)" }}>
              <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>
                {lang === "ru" ? "Сеть" : "Network"}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--mint)" }}/>
                <span className="text-xs font-black" style={{ color: "var(--ink)" }}>Abstract</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SBtn variant="primary" onClick={() => { onClose(); setTimeout(() => document.getElementById("app")?.scrollIntoView({ behavior: "smooth" }), 120); }}>
            {lang === "ru" ? "Купить яйцо 🥚" : "Buy an Egg 🥚"}
          </SBtn>
          <SBtn variant="outline" onClick={() => { disconnect(); onClose(); }}>
            {lang === "ru" ? "Отключить" : "Disconnect"}
          </SBtn>
        </div>
      </div>
    </>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  const errorContent = (
    <>
      <div className="px-6 pt-4 pb-2 text-center">
        <h2 className="text-2xl font-black uppercase" style={{ color: "var(--ink)", letterSpacing: -0.5 }}>
          {lang === "ru" ? "Ой, яйцо разбилось" : "Oops, egg cracked"}
        </h2>
        <p className="mt-1 text-sm leading-snug" style={{ color: "var(--ink-3)" }}>
          {lang === "ru"
            ? "Подключение отклонено. Попробуй ещё раз?"
            : "Connection rejected. Try again?"}
        </p>
      </div>

      <div className="px-4 py-3">
        {error && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: "#FFE6E1", border: "2px solid #FF7A6A", boxShadow: "2px 2px 0 #FF7A6A" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0" style={{ background: "#FF7A6A", border: "1.5px solid var(--ink)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold mb-0.5" style={{ color: "var(--ink)" }}>
                  {lang === "ru" ? "Ошибка подключения" : "Connection error"}
                </div>
                <div className="text-xs font-mono leading-relaxed" style={{ color: "var(--ink-3)" }}>
                  {error.slice(0, 100)}{error.length > 100 ? "…" : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        <SBtn variant="primary" onClick={handleRetry} className="mb-3">
          {lang === "ru" ? "Попробовать снова" : "Try again"}
        </SBtn>
        <SBtn variant="outline" onClick={() => { setModalState("select"); setError(""); }}>
          {lang === "ru" ? "Выбрать другой кошелёк" : "Choose another wallet"}
        </SBtn>
      </div>
    </>
  );

  const moodMap: Record<ModalState, "happy" | "waiting" | "celebrating" | "sad"> = {
    select: "happy",
    connecting: "waiting",
    success: "celebrating",
    error: "sad",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      style={{ background: "rgba(20,30,50,0.55)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
        @keyframes crackDraw { from { stroke-dashoffset:70 } to { stroke-dashoffset:0 } }
        .crack-line { stroke-dasharray:70; animation:crackDraw 1.2s ease-in-out 0.4s forwards; }
      `}</style>
      <div className="relative w-full max-w-[460px] mx-4">
        {/* Penguin mascot — peeks above modal */}
        <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ top: -76 }}>
          <PenguinMascot mood={moodMap[modalState]} size={120}/>
        </div>

        {/* Modal card */}
        <div
          className="overflow-hidden rounded-[24px]"
          style={{
            background: "var(--paper)",
            border: "3px solid #1A1A1A",
            boxShadow: "6px 8px 0 #1A1A1A",
            paddingTop: 14,
            animation: "modalIn 240ms ease-out both",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.10)" }}>
            <AbstractPill/>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{ color: "var(--ink-2)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(15,17,21,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {modalState === "select"     && selectContent}
          {modalState === "connecting" && connectingContent}
          {modalState === "success"    && successContent}
          {modalState === "error"      && errorContent}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectButton
// ─────────────────────────────────────────────────────────────────────────────
function ConnectButton({ lang, onOpenConnect }: { lang: string; onOpenConnect: () => void }) {
  return (
    <button onClick={onOpenConnect} className="btn-sticker-primary flex items-center gap-1.5 px-4 py-2">
      {ICON_WALLET}
      <span className="text-xs font-bold uppercase tracking-widest">
        {lang === "ru" ? "Войти" : "Connect"}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
type Props = { lang: string; ctaHost: HTMLElement | null };

export function ConnectPortals({ lang, ctaHost }: Props) {
  const { isConnected } = useAccount();
  const [connectOpen, setConnectOpen] = useState(false);

  const button = isConnected
    ? <WalletButton lang={lang}/>
    : <ConnectButton lang={lang} onOpenConnect={() => setConnectOpen(true)}/>;

  return (
    <>
      {ctaHost ? createPortal(button, ctaHost) : null}
      <ConnectModal lang={lang} open={connectOpen} onClose={() => setConnectOpen(false)}/>
    </>
  );
}

export function WrongNetworkBlocker({ lang }: { lang: string }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected || chainId === abstractTestnet.id) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(3px)" }}>
      <div className="mx-4 w-full max-w-sm">
        {/* Sad penguin above */}
        <div className="flex justify-center mb-[-14px] relative z-10">
          <PenguinMascot mood="sad" size={64}/>
        </div>
        <div className="rounded-3xl overflow-hidden" style={{ background: "var(--paper)", border: "2.5px solid var(--ink)", boxShadow: "6px 6px 0 var(--shadow-sticker-color)" }}>
          <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.10)" }}>
            <AbstractPill/>
          </div>
          <div className="px-6 py-5 text-center">
            <h2 className="text-xl font-black uppercase mb-2" style={{ color: "var(--ink)", letterSpacing: -0.5 }}>
              {lang === "ru" ? "Не та сеть" : "Wrong Network"}
            </h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--ink-3)" }}>
              {lang === "ru"
                ? "Переключи кошелёк на Abstract Testnet, чтобы продолжить."
                : "Switch your wallet to Abstract Testnet to continue."}
            </p>
            <SBtn variant="primary" onClick={() => switchChain({ chainId: abstractTestnet.id })}>
              {lang === "ru" ? "Переключить на Testnet" : "Switch to Testnet"}
            </SBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
