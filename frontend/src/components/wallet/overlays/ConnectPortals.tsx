"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useRef, useState, useEffect } from "react";
import type { Connector } from "wagmi";
import { useConnect, useDisconnect, useAccount, useChainId, useSwitchChain, useBalance } from "wagmi";
import { abstractTestnet } from "viem/chains";
import { Sun, Moon } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { readEvmMintedNftCount } from "@/lib/evmContracts";

function _hadPreviousWalletConnection(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("wagmi.store");
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data?.state?.status === "connected" || Boolean(data?.state?.current);
  } catch { return false; }
}

function nicknameStorageKey(addr: string) {
  return `player_nickname:${addr.toLowerCase()}`;
}

const DROPDOWN_DIVIDER = "1.5px solid var(--divider)";

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
function customWalletSrc(id: string, name: string): string | null {
  const lower = (id + name).toLowerCase();
  if (lower.includes("abstract")) return "/wallets/abc.webp";
  if (lower.includes("metamask")) return "/wallets/mm.webp";
  if (lower.includes("okx")) return "/wallets/okx.webp";
  if (lower.includes("rabby")) return "/wallets/rabby.webp";
  return null;
}

function ConnectorIcon({ id, name }: { id: string; name: string }) {
  const lower = (id + name).toLowerCase();
  const custom = customWalletSrc(id, name);

  const sz = { width: 56, height: 56, borderRadius: 14, overflow: "hidden" as const, flexShrink: 0 as const, border: "2px solid var(--outline)" };

  if (custom) return (
    <div style={sz}>
      <img src={custom} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );

  if (lower.includes("coinbase")) return (
    <div style={{ ...sz, background: "#0052FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 32 32" fill="none" style={{ width: 32, height: 32 }}>
        <circle cx="16" cy="16" r="11" fill="white"/>
        <rect x="11.5" y="13.5" width="9" height="5" rx="2.5" fill="#0052FF"/>
      </svg>
    </div>
  );

  if (lower.includes("walletconnect") || lower.includes("wallet connect")) return (
    <div style={{ ...sz, background: "#3B99FC", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 32 32" fill="none" style={{ width: 32, height: 32 }}>
        <path d="M9.5 12.5C13 9 19 9 22.5 12.5L23 13C23.5 13.5 23.5 14.5 23 15L21.5 16.5C21.25 16.75 20.75 16.75 20.5 16.5L19.5 15.5C17.5 13.5 14.5 13.5 12.5 15.5L11.3 16.7C11.05 16.95 10.55 16.95 10.3 16.7L8.8 15.2C8.3 14.7 8.3 13.7 8.8 13.2L9.5 12.5Z" fill="white"/>
        <path d="M13.5 17.5L15 19C15.5 19.5 16.5 19.5 17 19L18.5 17.5C18.75 17.25 19.25 17.25 19.5 17.5L21 19C21.5 19.5 21.5 20.5 21 21L17.5 24.5C17 25 16 25 15.5 24.5L12 21C11.5 20.5 11.5 19.5 12 19L13.5 17.5C13.75 17.25 13.25 17.25 13.5 17.5Z" fill="white"/>
      </svg>
    </div>
  );

  if (lower.includes("phantom")) return (
    <div style={{ ...sz, background: "#AB9FF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 32 32" fill="none" style={{ width: 32, height: 32 }}>
        <ellipse cx="16" cy="15" rx="9" ry="11" fill="white" opacity="0.9"/>
        <circle cx="13" cy="14" r="2" fill="#AB9FF2"/>
        <circle cx="19" cy="14" r="2" fill="#AB9FF2"/>
        <path d="M13 19.5 Q16 22 19 19.5" stroke="#AB9FF2" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );

  return (
    <div style={{ ...sz, background: "var(--sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Abstract network pill
// ─────────────────────────────────────────────────────────────────────────────
function AbstractPill() {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "var(--paper-3)", border: "2px solid var(--outline)", fontSize: 10, fontWeight: 800, letterSpacing: "0.09em", color: "var(--ink-2)", textTransform: "uppercase" }}>
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
    ? { background: "var(--mint)", color: "var(--on-rarity)", border: "2.5px solid var(--outline)", boxShadow: "4px 4px 0 var(--shadow-sticker-color)" }
    : { background: "var(--paper-3)", color: "var(--ink-2)", border: "2px solid var(--outline)", boxShadow: "2px 2px 0 var(--shadow-sticker-color)" };
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

function WalletButton({ theme, setTheme, themeReady }: {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  themeReady: boolean;
}) {
  const { lang, setLang } = useI18n();
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
        <div className="absolute top-full right-0 mt-3 w-56 z-[60]" style={{ background: "var(--paper-2)", border: "2.5px solid var(--outline)", borderRadius: 14, boxShadow: "4px 4px 0 var(--shadow-sticker-color)" }}>
          {/* Settings row — theme + lang */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: DROPDOWN_DIVIDER }}>
            <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--sunken)", border: theme === "dark" ? "1.5px solid rgba(232,238,245,0.7)" : "1.5px solid var(--outline)" }}>
              <button
                onClick={() => setTheme("light")}
                className="flex items-center justify-center rounded-full transition-all"
                style={{ width: 28, height: 28, background: themeReady && theme === "light" ? "var(--paper-3)" : "transparent", border: themeReady && theme === "light" ? "1.5px solid var(--outline)" : "1.5px solid transparent", boxShadow: themeReady && theme === "light" ? "1px 1px 0 var(--shadow-sticker-color)" : "none" }}
              >
                <Sun size={12} />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className="flex items-center justify-center rounded-full transition-all"
                style={{ width: 28, height: 28, background: themeReady && theme === "dark" ? "var(--paper-3)" : "transparent", border: themeReady && theme === "dark" ? "1.5px solid var(--outline)" : "1.5px solid transparent", boxShadow: themeReady && theme === "dark" ? "1px 1px 0 var(--shadow-sticker-color)" : "none" }}
              >
                <Moon size={12} />
              </button>
            </div>
            <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--sunken)", border: theme === "dark" ? "1.5px solid rgba(232,238,245,0.7)" : "1.5px solid var(--outline)" }}>
              <button
                onClick={() => setLang("ru")}
                className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all"
                style={{ background: lang === "ru" ? "var(--paper-3)" : "transparent", border: lang === "ru" ? "1.5px solid var(--outline)" : "1.5px solid transparent", boxShadow: lang === "ru" ? "1px 1px 0 var(--shadow-sticker-color)" : "none", color: "var(--ink)" }}
              >
                RU
              </button>
              <button
                onClick={() => setLang("en")}
                className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all"
                style={{ background: lang === "en" ? "var(--paper-3)" : "transparent", border: lang === "en" ? "1.5px solid var(--outline)" : "1.5px solid transparent", boxShadow: lang === "en" ? "1px 1px 0 var(--shadow-sticker-color)" : "none", color: "var(--ink)" }}
              >
                EN
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: DROPDOWN_DIVIDER }}>
            {wrongNetwork ? (
              <>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "var(--down)" }}/>
                <span className="text-xs font-bold flex-1" style={{ color: "var(--down)" }}>
                  {lang === "ru" ? "Не та сеть" : "Wrong network"}
                </span>
                <button
                  onClick={() => { switchChain({ chainId: abstractTestnet.id }); setMenuOpen(false); }}
                  className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{ background: "var(--down)", color: "var(--on-rarity)", border: "1.5px solid var(--outline)" }}
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

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: DROPDOWN_DIVIDER }}>
            <svg className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <span className="text-xs font-semibold truncate flex-1" style={{ color: "var(--ink-2)" }}>{nickname || shortAddr}</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: DROPDOWN_DIVIDER }}>
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
            onMouseEnter={e => (e.currentTarget.style.background = "var(--down-soft)")}
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
// Connect modal — 5 states: cta / select / connecting / success / error
// ─────────────────────────────────────────────────────────────────────────────
type ModalState = "cta" | "select" | "connecting" | "success" | "error";

export type ConnectModalProps = {
  lang: string;
  open: boolean;
  onClose: () => void;
  onEnterApp?: () => void;
};

function AnimatedMintedNumber({ value, lang }: { value: number | null; lang: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayRef = useRef(0);

  function setDisplay(next: number) {
    displayRef.current = next;
    setDisplayValue(next);
  }

  useEffect(() => {
    let frame = 0;

    if (value === null) {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const tick = Math.floor((Date.now() - startedAt) / 90);
        const wave = Math.round(Math.sin(tick / 2) * 9);
        setDisplay(180 + ((tick * 17 + wave) % 720));
      }, 90);

      return () => clearInterval(timer);
    }

    const from = displayRef.current;
    const diff = value - from;
    const duration = 650;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span style={{ minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
      {displayValue.toLocaleString(lang === "ru" ? "ru-RU" : "en-US")}
    </span>
  );
}

export function ConnectModal({ lang, open, onClose, onEnterApp }: ConnectModalProps) {
  const { connect, connectors } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address });

  const [modalState, setModalState] = useState<ModalState>("cta");
  const [displayState, setDisplayState] = useState<ModalState>("cta");
  const [contentOpacity, setContentOpacity] = useState(1);
  const [isClosing, setIsClosing] = useState(false);
  const [selConnector, setSelConnector] = useState<Connector | null>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [mintedNftCount, setMintedNftCount] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.dataset.theme === "dark")
    );
    obs.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setMintedNftCount(null);

    readEvmMintedNftCount()
      .then((count) => {
        if (active) setMintedNftCount(count);
      })
      .catch((e) => {
        console.warn("Не удалось прочитать количество заминченных NFT из блокчейна", e);
        if (active) setMintedNftCount(null);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (isConnected && open && modalState !== "success" && modalState !== "error") setModalState("success");
  }, [isConnected, open, modalState]);

  useEffect(() => {
    if (modalState === displayState) return;
    setContentOpacity(0);
    const t = setTimeout(() => { setDisplayState(modalState); setContentOpacity(1); }, 320);
    return () => clearTimeout(t);
  }, [modalState, displayState]);

  useEffect(() => {
    if (modalState === "success") {
      const t = setTimeout(() => { onEnterApp?.(); onClose(); }, 4000);
      return () => clearTimeout(t);
    }
  }, [modalState, onClose, onEnterApp]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setModalState("cta"); setDisplayState("cta"); setError(""); setCountdown(60); }, 300);
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
  const mintedNftLabel = mintedNftCount === null
    ? (lang === "ru" ? "НФТ пересчитывается" : "NFTs recalculating")
    : (lang === "ru" ? "НФТ заминчено" : "NFTs minted");

  function handleConnect(connector: Connector) {
    setSelConnector(connector);
    setModalState("connecting");
    setError("");
    connect({ connector }, {
      onSuccess: () => setModalState("success"),
      onError: (e) => { setError(e.message); setModalState("error"); },
    });
  }

  function handleRetry() {
    if (!selConnector) return;
    setModalState("connecting");
    setError("");
    connect({ connector: selConnector }, {
      onSuccess: () => setModalState("success"),
      onError: (e) => { setError(e.message); setModalState("error"); },
    });
  }

  // ── CTA ────────────────────────────────────────────────────────────────────
  const ctaContent = (
    <div className="px-6 pt-5 pb-6">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--lime-pop)", border: "2.5px solid var(--outline)", boxShadow: "3px 3px 0 var(--shadow-sticker-color-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <img src="/logo.webp" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 8 }} alt="" />
        </div>
        <img src="/brand/name.png" style={{ height: 32, width: "auto", objectFit: "contain" }} alt="HeavyEggs" />
      </div>
      <p style={{ color: "var(--ink-3)", fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
        {lang === "ru" ? "Подключи кошелёк — начни собирать яйца" : "Connect your wallet to start collecting eggs"}
      </p>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <img src={isDark ? "/wc/dark_mood_1.webp" : "/wc/light_mood_1.webp"} alt="" style={{ width: 140, height: 140, objectFit: "contain" }} />
      </div>
      <button
        onClick={() => setModalState("select")}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--mint)", color: "var(--on-rarity)", border: "2.5px solid var(--outline)", borderRadius: 14, padding: "13px 20px", fontSize: 14, fontWeight: 800, letterSpacing: 0.6, cursor: "pointer", marginBottom: 16, outline: "none" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
        {lang === "ru" ? "Подключить кошелёк" : "Connect Wallet"}
      </button>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", background: "var(--beach-live-bg)", border: "1.5px solid var(--beach-live-border)", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mint)", flexShrink: 0, display: "inline-block", animation: "dotPulse 1.8s ease-in-out infinite" }} />
          <AnimatedMintedNumber value={mintedNftCount} lang={lang} />
          {mintedNftLabel}
        </div>
      </div>
    </div>
  );

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

      <div className="px-5 py-4" style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {connectors.map((connector) => {
          const isAGW = (connector.id + connector.name).toLowerCase().includes("abstract");
          return (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                width: 88, background: "transparent", border: "none", cursor: "pointer",
                padding: "4px 2px", borderRadius: 14,
                transition: "transform 0.15s",
                position: "relative",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: 18, overflow: "hidden",
                border: isAGW ? "2.5px solid var(--mint)" : "2px solid var(--outline)",
                boxShadow: isAGW ? "3px 3px 0 var(--mint)" : "2px 2px 0 var(--shadow-sticker-color-strong)",
                flexShrink: 0,
              }}>
                {(() => {
                  const src = customWalletSrc(connector.id, connector.name) || connector.icon;
                  return src
                    ? <img src={src} alt={connector.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "var(--ink-2)" }}>{connector.name.slice(0, 2).toUpperCase()}</div>;
                })()}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.2, letterSpacing: 0.2 }}>
                {connector.name}
              </span>
              {isAGW && (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "var(--mint)", border: "1.5px solid var(--outline)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, lineHeight: 1,
                }}>★</span>
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


        {/* Egg with ripple waves */}
        <div className="relative my-5" style={{ height: 105, overflow: "visible" }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ overflow: "visible" }}>
<div className="connect-egg-shake relative z-10">
              <img src="/wc/eggwalletopen.webp" alt="" style={{ width: 168, height: "auto", objectFit: "contain" }}/>
            </div>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-4 whitespace-pre-line" style={{ color: "var(--ink-3)" }}>
          {lang === "ru"
            ? "Открой кошелёк и подтверди подключение."
            : "Open your wallet and confirm."}
        </p>

        <div className="flex items-center justify-center gap-2 mb-5">
          {selConnector && <ConnectorIcon id={selConnector.id} name={selConnector.name}/>}
          <span className="text-sm font-bold" style={{ color: "var(--ink-2)" }}>{selConnector?.name}</span>
          <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: "var(--mint)" }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>

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
        <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--paper-2)", border: "2px solid var(--outline)", boxShadow: "2px 2px 0 var(--shadow-sticker-color)" }}>
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
            <div className="rounded-xl p-3" style={{ background: "var(--paper-3)", border: "1.5px solid var(--outline)" }}>
              <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>
                {lang === "ru" ? "Баланс" : "Balance"}
              </div>
              <div className="text-sm font-black" style={{ color: "var(--ink)" }}>{balanceStr}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--paper-3)", border: "1.5px solid var(--outline)" }}>
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
          <SBtn variant="primary" onClick={() => { setIsClosing(true); setTimeout(() => { onEnterApp?.(); onClose(); setIsClosing(false); }, 500); }}>
            {lang === "ru" ? "Вперёд!" : "Let's go!"}
          </SBtn>
          <SBtn variant="outline" onClick={() => { setModalState("cta"); setDisplayState("cta"); disconnect(); }}>
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
          <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--down-soft)", border: "2px solid var(--down)", boxShadow: "2px 2px 0 var(--down)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0" style={{ background: "var(--down)", border: "1.5px solid var(--outline)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                  {lang === "ru" ? "Ошибка подключения" : "Connection error"}
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

  const penguinImg = isDark
    ? { select: "/wc/dark_mood_1.webp", connecting: "/wc/dark_mood_2.webp", success: "/wc/dark_mood_3.webp", error: "/wc/dark_mood_4.webp" }
    : { select: "/wc/light_mood_1.webp", connecting: "/wc/light_mood_2.webp", success: "/wc/light_mood_3.webp", error: "/wc/light_mood_4.webp" };

  return createPortal(
      <div
        className="fixed inset-0 z-[9990] flex items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget && displayState !== "cta") onClose(); }}
      >
        <div style={{ position: "absolute", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(6px)", opacity: (displayState === "cta" || displayState === "success") ? 0 : 1, transition: "opacity 800ms ease", pointerEvents: "none" }} />
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
        @keyframes crackDraw { from { stroke-dashoffset:70 } to { stroke-dashoffset:0 } }
        .crack-line { stroke-dasharray:70; animation:crackDraw 1.2s ease-in-out 0.4s forwards; }
        @keyframes connectRipple { 0% { transform:scale(1); opacity:0.7; } 100% { transform:scale(3.8); opacity:0; } }
        @keyframes connectShake { 0%,78%,100% { transform:translateX(0) rotate(0deg); } 80% { transform:translateX(-6px) rotate(-5deg); } 82% { transform:translateX(6px) rotate(5deg); } 84% { transform:translateX(-5px) rotate(-3deg); } 86% { transform:translateX(4px) rotate(2deg); } 88% { transform:translateX(-2px) rotate(-1deg); } 90% { transform:translateX(1px) rotate(0deg); } }
        .connect-egg-shake { animation:connectShake 3.5s ease-in-out infinite; }
        .connect-ripple { animation:connectRipple 2s ease-out infinite; }
        @keyframes modalContentIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .modal-content-transition { animation:modalContentIn 220ms ease-out both; }
        @keyframes backdropIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalOverlayOut { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(0.96); } }
      `}</style>
      <div className="relative w-full max-w-[480px] mx-4" style={{ animation: isClosing ? "modalOverlayOut 500ms ease-in forwards" : "modalIn 240ms ease-out both" }}>
        {/* Penguin mascot — peeks above modal, hidden for cta */}
        <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ top: -76, width: 120, height: 120, opacity: displayState === "cta" ? 0 : 1, transition: "opacity 800ms ease" }}>
          {(Object.entries(penguinImg) as [ModalState, string][]).map(([state, src]) => (
            <img key={state} src={src} alt="" style={{ position: "absolute", width: 120, height: 120, objectFit: "contain", opacity: displayState === state ? 1 : 0, transition: "opacity 600ms ease" }} />
          ))}
        </div>

        {/* Modal card */}
        <div
          className="overflow-hidden rounded-[24px]"
          style={{
            background: "var(--paper)",
            border: "3px solid var(--outline)",
            boxShadow: "var(--shadow-sticker)",
            paddingTop: 14,
            minHeight: 420,
          }}
        >
          {/* Header — only AbstractPill, no close button, hidden for cta */}
          {displayState !== "cta" && (
            <div className="flex items-center px-5 py-2.5" style={{ borderBottom: "1.5px solid var(--divider)" }}>
              <AbstractPill/>
            </div>
          )}

          <div style={{ opacity: contentOpacity, transition: "opacity 320ms ease", minHeight: 340 }}>
            {displayState === "cta"        && ctaContent}
            {displayState === "select"     && selectContent}
            {displayState === "connecting" && connectingContent}
            {displayState === "success"    && successContent}
            {displayState === "error"      && errorContent}
          </div>
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
type Props = {
  lang: string;
  ctaHost: HTMLElement | null;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  themeReady: boolean;
  onEnterApp?: () => void;
};

export function ConnectPortals({ lang, ctaHost, theme, setTheme, themeReady, onEnterApp }: Props) {
  const { isConnected, status } = useAccount();
  const [connectOpen, setConnectOpen] = useState(false);
  const wasReconnectingRef = useRef(_hadPreviousWalletConnection());
  useEffect(() => {
    if (status === "reconnecting") { wasReconnectingRef.current = true; return; }
    if (status === "disconnected") { wasReconnectingRef.current = false; setConnectOpen(true); }
    if (status === "connected" && !wasReconnectingRef.current) setConnectOpen(true);
    if (status === "connected") wasReconnectingRef.current = false;
  }, [status]);

  const button = isConnected
    ? <WalletButton theme={theme} setTheme={setTheme} themeReady={themeReady}/>
    : <ConnectButton lang={lang} onOpenConnect={() => setConnectOpen(true)}/>;

  return (
    <>
      {ctaHost ? createPortal(button, ctaHost) : null}
      <ConnectModal lang={lang} open={connectOpen} onClose={() => setConnectOpen(false)} onEnterApp={onEnterApp}/>
    </>
  );
}

export function WrongNetworkBlocker({ lang }: { lang: string }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected || chainId === abstractTestnet.id) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "var(--overlay-backdrop)" }}>
      <div className="mx-4 w-full max-w-sm">
        {/* Sad penguin above */}
        <div className="flex justify-center mb-[-14px] relative z-10">
          <PenguinMascot mood="sad" size={64}/>
        </div>
        <div className="rounded-3xl overflow-hidden" style={{ background: "var(--paper)", border: "2.5px solid var(--outline)", boxShadow: "6px 6px 0 var(--shadow-sticker-color)" }}>
          <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: "1.5px solid var(--divider)" }}>
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
