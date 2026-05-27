"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useRef, useState, useEffect } from "react";
import { Button, Modal } from "@/components/ui";

type WalletItem = { name: string; label?: string };

type Props = {
  lang: string;
  ctaHost: HTMLElement | null;
  wrongNetwork: boolean;
  walletConnected: boolean;
  walletConnecting: boolean;
  wallets: WalletItem[];
  walletAddress: string | null;
  switchChainToTestnet: () => void;
  onCTAClick: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  connectOpen: boolean;
  setConnectOpen: (v: boolean) => void;
  connectStep: "list" | "connecting";
  connectError: string;
  connectHint: string;
  connectingWalletName: string;
  onSelectWallet: (name: string) => Promise<void>;
  onBackFromConnecting: () => void;
};

function nicknameStorageKey(walletAddress: string) {
  return `player_nickname:${walletAddress.toLowerCase()}`;
}

function getWalletIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("metamask")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M28 4L17.6 11.6L19.5 7L28 4Z" fill="#E2761B"/>
      <path d="M4 4L14.3 11.7L12.5 7L4 4Z" fill="#E4761B"/>
      <path d="M24.1 22.1L21.3 26.5L27.4 28.2L29.2 22.2L24.1 22.1Z" fill="#E4761B"/>
      <path d="M2.8 22.2L4.6 28.2L10.7 26.5L7.9 22.1L2.8 22.2Z" fill="#E4761B"/>
      <path d="M10.4 14.4L8.7 17L14.8 17.3L14.6 10.7L10.4 14.4Z" fill="#E4761B"/>
      <path d="M21.6 14.4L17.3 10.6L17.2 17.3L23.3 17L21.6 14.4Z" fill="#E4761B"/>
      <path d="M10.7 26.5L14.4 24.7L11.2 22.3L10.7 26.5Z" fill="#E4761B"/>
      <path d="M17.6 24.7L21.3 26.5L20.8 22.3L17.6 24.7Z" fill="#E4761B"/>
      <path d="M21.3 26.5L17.6 24.7L17.9 27L17.9 28.1L21.3 26.5Z" fill="#D3BAB5"/>
      <path d="M10.7 26.5L14.1 28.1L14.1 27L14.4 24.7L10.7 26.5Z" fill="#D3BAB5"/>
      <path d="M14.2 20.6L11.1 19.7L13.3 18.7L14.2 20.6Z" fill="#233447"/>
      <path d="M17.8 20.6L18.7 18.7L20.9 19.7L17.8 20.6Z" fill="#233447"/>
      <path d="M10.7 26.5L11.2 22.1L7.9 22.2L10.7 26.5Z" fill="#CD6116"/>
      <path d="M20.8 22.1L21.3 26.5L24.1 22.2L20.8 22.1Z" fill="#CD6116"/>
      <path d="M23.3 17L17.2 17.3L17.8 20.6L18.7 18.7L20.9 19.7L23.3 17Z" fill="#CD6116"/>
      <path d="M11.1 19.7L13.3 18.7L14.2 20.6L14.8 17.3L8.7 17L11.1 19.7Z" fill="#CD6116"/>
      <path d="M8.7 17L11.2 22.1L11.1 19.7L8.7 17Z" fill="#E4751F"/>
      <path d="M20.9 19.7L20.8 22.1L23.3 17L20.9 19.7Z" fill="#E4751F"/>
      <path d="M14.8 17.3L14.2 20.6L15 24.3L15.2 19L14.8 17.3Z" fill="#E4751F"/>
      <path d="M17.2 17.3L16.8 19L17 24.3L17.8 20.6L17.2 17.3Z" fill="#E4751F"/>
      <path d="M17.8 20.6L17 24.3L17.6 24.7L20.8 22.1L20.9 19.7L17.8 20.6Z" fill="#F6851B"/>
      <path d="M14.2 20.6L11.2 22.3L14.4 24.7L15 24.3L14.2 20.6Z" fill="#F6851B"/>
      <path d="M17.9 28.1L17.9 27L17.6 26.8H14.4L14.1 27L14.1 28.1L10.7 26.5L11.9 27.5L14.4 29.2H17.6L20.1 27.5L21.3 26.5L17.9 28.1Z" fill="#C0AD9E"/>
      <path d="M17.6 24.7L17 24.3H15L14.4 24.7L14.1 27L14.4 26.8H17.6L17.9 27L17.6 24.7Z" fill="#161616"/>
      <path d="M28.5 12.2L29.5 7L28 4L17.6 11.3L21.6 14.4L27.3 16.1L28.6 14.6L28 14.1L28.9 13.3L28.2 12.8L29.1 12.1L28.5 12.2Z" fill="#763D16"/>
      <path d="M2.5 7L3.5 12.2L2.9 12.1L3.8 12.8L3.1 13.3L4 14.1L3.4 14.6L4.7 16.1L10.4 14.4L14.4 11.3L4 4L2.5 7Z" fill="#763D16"/>
      <path d="M27.3 16.1L21.6 14.4L23.3 17L20.9 19.7L20.8 22.1L24.1 22.2L29.2 22.2L27.3 16.1Z" fill="#F6851B"/>
      <path d="M10.4 14.4L4.7 16.1L2.8 22.2L7.9 22.2L11.2 22.1L11.1 19.7L8.7 17L10.4 14.4Z" fill="#F6851B"/>
      <path d="M17.2 17.3L17.6 11.3L19.5 7H12.5L14.4 11.3L14.8 17.3L15 19L15 24.3H17L17.2 24.3L17.2 19L17.2 17.3Z" fill="#F6851B"/>
    </svg>
  );
  if (lower.includes("nightly")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#12082A"/>
      <path d="M21 8C16.6 8 13 11.6 13 16C13 20.4 16.6 24 21 24C18.8 24 17 22.2 17 20C17 17.8 18.8 16 21 16C23.2 16 25 14.2 25 12C25 9.8 23.2 8 21 8Z" fill="#C084FC"/>
      <circle cx="10" cy="10.5" r="1.5" fill="#E879F9"/>
      <circle cx="7.5" cy="16" r="1" fill="#A855F7"/>
      <circle cx="11" cy="22" r="1.2" fill="#D946EF"/>
    </svg>
  );
  if (lower.includes("petra") || (lower.includes("aptos") && !lower.includes("wallet"))) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#00C2CB"/>
      <circle cx="16" cy="16" r="7.5" stroke="white" strokeWidth="2"/>
      <path d="M12 16h8M16 12v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  if (lower.includes("razor")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#0a0f1e"/>
      <path d="M13 7l7 9h-5l5 9-9-10h5L13 7Z" fill="#00F0FF"/>
    </svg>
  );
  if (lower.includes("okx")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#000"/>
      <rect x="8" y="13.5" width="5" height="5" rx="1" fill="white"/>
      <rect x="13.5" y="8" width="5" height="5" rx="1" fill="white"/>
      <rect x="13.5" y="19" width="5" height="5" rx="1" fill="white"/>
      <rect x="19" y="13.5" width="5" height="5" rx="1" fill="white"/>
    </svg>
  );
  if (lower.includes("sui")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#4DA2FF"/>
      <path d="M16 7C16 7 11 11 11 17C11 20.9 13.1 24.2 16 25.5C18.9 24.2 21 20.9 21 17C21 11 16 7 16 7Z" fill="white" fillOpacity="0.9"/>
      <path d="M11 14C11 14 8 15.5 8 18.5C8 20.8 9.5 22.8 11.5 23.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
      <path d="M21 14C21 14 24 15.5 24 18.5C24 20.8 22.5 22.8 20.5 23.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <rect x="7" y="12" width="18" height="12" rx="2.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <path d="M7 17h18" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <path d="M12 12V10a4 4 0 018 0v2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.5)"/>
    </svg>
  );
}

const BTN_STYLE = (open: boolean): React.CSSProperties => ({
  background: "var(--ctrl-fill)",
  boxShadow: open ? "var(--control-shadow-active)" : "var(--control-shadow)",
  color: "var(--control-text)",
});

const BTN_WRAP: React.CSSProperties = { background: "var(--ctrl-border)" };

const ICON_WALLET = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
);

function FaucetHint({
  lang,
  onClose,
}: {
  lang: string;
  onClose: () => void;
}) {
  return (
    <div
      className="relative w-[248px] rounded-2xl border border-cyan-400/18 bg-[#090d1d]/92 p-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl"
      style={{
        backgroundImage: "linear-gradient(180deg, rgba(0,240,255,0.05), transparent 44%), linear-gradient(135deg, rgba(176,38,255,0.07), transparent 58%)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-2 right-8 h-4 w-4 rotate-45 rounded-[4px] border-l border-t border-cyan-400/18 bg-[#090d1d]/92" />
      <a
        href="https://faucet.movementnetwork.xyz/"
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 rounded-2xl"
        aria-label={lang === "ru" ? "Открыть Abstract faucet" : "Open Abstract faucet"}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-white/35 transition hover:bg-white/8 hover:text-white/70"
        aria-label={lang === "ru" ? "Закрыть подсказку faucet" : "Close faucet hint"}
      >
        ×
      </button>
      <div className="relative pr-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200 transition hover:text-white animate-[faucetPulse_2.2s_ease-in-out_infinite]">
            FAUCET
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-white/58">
          {lang === "ru"
            ? "Нужны тестовые MOVE для старта. Забери их в faucet и возвращайся в игру."
            : "Need test MOVE to get started. Grab them from the faucet and jump back in."}
        </p>
      </div>
    </div>
  );
}

function WalletButton({
  lang, wrongNetwork, walletConnected, walletAddress,
  switchChainToTestnet, onCTAClick, onDisconnect,
}: {
  lang: string;
  wrongNetwork: boolean;
  walletConnected: boolean;
  walletAddress: string | null;
  switchChainToTestnet: () => void;
  onCTAClick: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!walletConnected || !menuOpen) return;
    try {
      let nextNickname = "";
      if (walletAddress) {
        const scoped = localStorage.getItem(nicknameStorageKey(walletAddress))?.trim();
        const legacy = localStorage.getItem("player_nickname")?.trim();
        nextNickname = scoped || legacy || "";
      } else {
        nextNickname = localStorage.getItem("player_nickname")?.trim() ?? "";
      }
      queueMicrotask(() => setNickname(nextNickname));
    } catch {
      queueMicrotask(() => setNickname(""));
    }
  }, [walletConnected, menuOpen, walletAddress]);

  const shortAddr = walletAddress
    ? walletAddress.slice(0, 6) + "…" + walletAddress.slice(-4)
    : "";

  if (!walletConnected) {
    return (
      <div className="flex flex-col items-end gap-2">
        <span className="inline-flex rounded-xl p-px" style={BTN_WRAP}>
          <button
            onClick={onCTAClick}
            className="group relative flex items-center gap-1.5 px-3 py-2 rounded-[calc(0.75rem-1px)] transition-all active:scale-95"
            style={BTN_STYLE(false)}
          >
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><span aria-hidden className="absolute inset-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#00FF66]" /></span>
            <span className="relative z-10 flex items-center gap-1.5">
              {ICON_WALLET}
              <span className="text-xs font-bold uppercase tracking-widest">
                {lang === "ru" ? "Войти" : "Connect"}
              </span>
            </span>
          </button>
        </span>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <span className="inline-flex rounded-xl p-px" style={BTN_WRAP}>
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="group relative flex items-center gap-1.5 px-3 py-2 rounded-[calc(0.75rem-1px)] transition-all active:scale-95"
        style={BTN_STYLE(menuOpen)}
      >
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><span aria-hidden className="absolute inset-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#00FF66]" /></span>
        {wrongNetwork ? (
          <span className="relative z-10 flex items-center gap-1.5">
            {ICON_WALLET}
            <span className="text-xs font-bold uppercase tracking-widest text-red-400">
              {lang === "ru" ? "Сеть!" : "Net!"}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="transition-transform duration-200 opacity-50" style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        ) : (
          <span className="relative z-10 flex items-center gap-1.5">
            {ICON_WALLET}
            <span className="text-xs font-bold uppercase tracking-widest">
              {shortAddr}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="transition-transform duration-200 opacity-50" style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
      </button>
      </span>

      {menuOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-52 rounded-xl overflow-hidden z-[60]"
          style={{
            background: "linear-gradient(#0d0f22, #08091a) padding-box, linear-gradient(135deg, rgba(0,240,255,0.3), rgba(176,38,255,0.3)) border-box",
            border: "1px solid transparent",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,240,255,0.1)",
          }}
        >
          {/* Network row */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            {wrongNetwork ? (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-400 flex-1">
                  {lang === "ru" ? "Не та сеть" : "Wrong network"}
                </span>
                <button
                  onClick={() => { switchChainToTestnet(); setMenuOpen(false); }}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {lang === "ru" ? "Сменить" : "Switch"}
                </button>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-emerald-300">Testnet</span>
              </>
            )}
          </div>

          {/* Address row */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            <svg className="h-3.5 w-3.5 text-white/35 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-xs text-white/50 font-mono tracking-wide">{shortAddr}</span>
          </div>

          {nickname && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
              <svg className="h-3.5 w-3.5 text-white/35 shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21a8 8 0 1 0-16 0"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span className="text-xs text-white/45">{lang === "ru" ? "Ник:" : "Nickname:"}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{nickname}</span>
            </div>
          )}

          {/* Disconnect */}
          <button
            onClick={() => { void onDisconnect(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
              <line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
            {lang === "ru" ? "Отключить кошелёк" : "Disconnect wallet"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConnectPortals({
  lang, ctaHost, wrongNetwork, walletConnected, walletConnecting,
  wallets, walletAddress, switchChainToTestnet,
  onCTAClick, onDisconnect, connectOpen, setConnectOpen,
  connectStep, connectError, connectHint, connectingWalletName,
  onSelectWallet, onBackFromConnecting,
}: Props) {
  return (
    <>
      {ctaHost ? createPortal(
        <WalletButton
          lang={lang}
          wrongNetwork={wrongNetwork}
          walletConnected={walletConnected}
          walletAddress={walletAddress}
          switchChainToTestnet={switchChainToTestnet}
          onCTAClick={onCTAClick}
          onDisconnect={onDisconnect}
        />,
        ctaHost,
      ) : null}


      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title={lang === "ru" ? "Подключить кошелёк" : "Connect Wallet"}
        dialogClassName="!border-transparent !bg-[#08091a]/95"
        dialogStyle={{
          background: "linear-gradient(#08091a, #0d0f22) padding-box, linear-gradient(135deg, rgba(0,240,255,0.5), rgba(176,38,255,0.5)) border-box",
          border: "1.5px solid transparent",
          boxShadow: "0 0 60px rgba(0,240,255,0.08), 0 0 120px rgba(176,38,255,0.06), 0 25px 50px rgba(0,0,0,0.6)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(ellipse, rgba(0,240,255,0.4) 0%, rgba(176,38,255,0.3) 50%, transparent 80%)" }} />

        {connectError ? (
          <div className="relative mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 p-4">
            <span className="mt-0.5 text-lg text-red-400">⚠</span>
            <div className="text-sm text-red-200 leading-relaxed">{connectError}</div>
          </div>
        ) : null}

        {connectStep === "connecting" ? (
          <div className="relative flex flex-col items-center gap-6 py-10 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl scale-150"
                style={{ background: "radial-gradient(circle, rgba(0,240,255,0.2) 0%, rgba(176,38,255,0.15) 60%, transparent 100%)" }} />
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" style={{ animationDuration: "0.9s" }} />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-b-violet-500 animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
                <div className="absolute inset-3 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(176,38,255,0.15))" }}>
                  <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-cyan-400" stroke="currentColor" strokeWidth="1.5">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <div className="font-display font-bold text-lg text-white mb-1">
                {lang === "ru" ? "Ожидаем подтверждение" : "Waiting for approval"}
              </div>
              <div className="text-sm text-white/50 max-w-xs leading-relaxed">
                {lang === "ru"
                  ? "Открой окно расширения кошелька и подтверди подключение к CoinDeck"
                  : "Open your wallet extension and approve the connection to CoinDeck"}
              </div>
            </div>
            {connectHint ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-5 py-3 text-xs text-amber-200 max-w-xs leading-relaxed">{connectHint}</div>
            ) : null}
            <div className="flex gap-3">
              <Button variant="secondary" className="h-10 px-5" onClick={onBackFromConnecting}>
                {lang === "ru" ? "← Назад" : "← Back"}
              </Button>
              <Button variant="primary" className="h-10 px-5" onClick={() => setConnectOpen(false)}>
                {lang === "ru" ? "Закрыть" : "Close"}
              </Button>
            </div>
          </div>
        ) : wallets.length === 0 ? (
          <div className="relative flex flex-col items-center gap-5 py-10 text-center">
            <div className="h-20 w-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg"
              style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(176,38,255,0.12))", border: "1px solid rgba(255,255,255,0.10)" }}>
              🦊
            </div>
            <div>
              <div className="font-display font-bold text-lg text-white mb-2">
                {lang === "ru" ? "Кошельки не найдены" : "No wallets found"}
              </div>
              <div className="text-sm text-white/50 max-w-xs leading-relaxed">
                {lang === "ru"
                  ? "Установи браузерное расширение кошелька и обнови страницу."
                  : "Install a browser wallet extension and refresh the page."}
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {[
                { name: "Nightly", desc: lang === "ru" ? "Рекомендуем" : "Recommended", badge: true },
                { name: "Petra", desc: lang === "ru" ? "Aptos/Abstract" : "Aptos/Abstract", badge: false },
              ].map(({ name, desc, badge }) => (
                <div key={name} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/80">{name}</span>
                    {badge && <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[9px] font-bold text-cyan-300 uppercase tracking-wide">{lang === "ru" ? "лучший выбор" : "best pick"}</span>}
                  </div>
                  <span className="text-xs text-white/35">{desc}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-white/30">{lang === "ru" ? "После установки — обнови страницу" : "After install — refresh the page"}</div>
          </div>
        ) : (
          <div className="relative grid gap-2.5">
            <div className="relative -mx-5 -mt-5 mb-4 px-5 pt-6 pb-5 text-center overflow-hidden">
              <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-violet-500/3 to-transparent" />
              <div className="relative">
                <div className="mx-auto mb-3 w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-xl select-none"
                  style={{ background: "linear-gradient(135deg, #00F0FF, #B026FF)", boxShadow: "0 0 24px rgba(0,240,255,0.35), 0 0 48px rgba(176,38,255,0.2), inset 0 1px 0 rgba(255,255,255,0.3)" }}>
                  <span className="text-black drop-shadow">CD</span>
                </div>
                <div className="font-display font-bold text-lg text-white tracking-tight mb-1">
                  {lang === "ru" ? "Добро пожаловать!" : "Welcome!"}
                </div>
                <div className="text-sm text-white/50 mb-3 leading-relaxed">
                  {lang === "ru"
                    ? "Подключи кошелёк чтобы начать собирать карточки и соревноваться"
                    : "Connect your wallet to collect cards and compete"}
                </div>
                <div className="flex justify-center gap-2 flex-wrap">
                  {([
                    { icon: "🎴", label: lang === "ru" ? "Карточки" : "NFT Cards" },
                    { icon: "🏆", label: lang === "ru" ? "Турнир" : "Tournament" },
                    { icon: "💰", label: lang === "ru" ? "Призы ABS" : "ABS Prizes" },
                  ] as const).map(({ icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                      <span>{icon}</span>{label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
              {lang === "ru" ? "Доступные кошельки" : "Available wallets"}
            </div>
            {wallets.map((w) => {
              const isConnecting = walletConnecting && connectingWalletName === w.name;
              return (
                <button key={w.name} type="button" disabled={walletConnecting}
                  onClick={() => onSelectWallet(w.name)}
                  className="group relative flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-left transition-all duration-200 hover:border-cyan-500/30 hover:bg-white/[0.04] disabled:opacity-50 overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.04) 0%, transparent 50%, rgba(176,38,255,0.04) 100%)" }} />
                  <div className={`relative shrink-0 h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isConnecting
                      ? "border border-cyan-500/50 bg-cyan-500/12"
                      : "border border-white/8 bg-black/30 group-hover:border-cyan-500/25 group-hover:bg-black/50"
                  }`}>
                    {getWalletIcon(w.label ?? w.name)}
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <div className="font-semibold text-sm text-white/90 truncate group-hover:text-white transition-colors">{w.label ?? w.name}</div>
                    <div className="text-xs text-white/35 mt-0.5">
                      {isConnecting
                        ? <span className="text-cyan-400 font-semibold">{lang === "ru" ? "подключение..." : "connecting..."}</span>
                        : lang === "ru" ? "браузерное расширение" : "browser extension"}
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    {isConnecting ? (
                      <div className="h-4 w-4 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4 text-white/15 group-hover:text-cyan-400/60 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="mt-1 text-center text-xs text-white/25">
              {lang === "ru" ? "Нет расширения? Рекомендуем Nightly" : "No extension? We recommend Nightly"}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}


