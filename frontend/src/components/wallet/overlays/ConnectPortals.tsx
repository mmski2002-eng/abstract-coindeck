"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useRef, useState, useEffect } from "react";
import { useConnect, useDisconnect, useAccount, useChainId, useSwitchChain } from "wagmi";
import { abstractTestnet } from "viem/chains";
import { Button, Modal } from "@/components/ui";

function nicknameStorageKey(addr: string) {
  return `player_nickname:${addr.toLowerCase()}`;
}

function ConnectorIcon({ id, name }: { id: string; name: string }) {
  const lower = (id + name).toLowerCase();
  if (lower.includes("abstract")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#000"/>
      <path d="M8 24L16 8L24 24" stroke="#00F0FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 19.5H21.5" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  if (lower.includes("metamask")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M28 4L17.6 11.6L19.5 7L28 4Z" fill="#E2761B"/>
      <path d="M4 4L14.3 11.7L12.5 7L4 4Z" fill="#E4761B"/>
      <path d="M24.1 22.1L21.3 26.5L27.4 28.2L29.2 22.2L24.1 22.1Z" fill="#E4761B"/>
      <path d="M2.8 22.2L4.6 28.2L10.7 26.5L7.9 22.1L2.8 22.2Z" fill="#E4761B"/>
      <path d="M10.4 14.4L8.7 17L14.8 17.3L14.6 10.7L10.4 14.4Z" fill="#E4761B"/>
      <path d="M21.6 14.4L17.3 10.6L17.2 17.3L23.3 17L21.6 14.4Z" fill="#E4761B"/>
      <path d="M17.2 17.3L16.8 19L17 24.3L17.8 20.6L17.2 17.3Z" fill="#F6851B"/>
      <path d="M14.8 17.3L14.2 20.6L15 24.3L15.2 19L14.8 17.3Z" fill="#F6851B"/>
    </svg>
  );
  if (lower.includes("coinbase")) return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect width="32" height="32" rx="10" fill="#0052FF"/>
      <circle cx="16" cy="16" r="9" fill="#fff"/>
      <rect x="12" y="13.5" width="8" height="5" rx="2.5" fill="#0052FF"/>
    </svg>
  );
  return (
    <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

const ICON_WALLET = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <rect x="2" y="7" width="20" height="14" rx="2" />
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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
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
        style={wrongNetwork ? { borderColor: "#E25C5C", boxShadow: "4px 4px 0 #E25C5C" } : undefined}
      >
        {wrongNetwork ? (
          <>
            {ICON_WALLET}
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#E25C5C" }}>
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
        <div
          className="absolute top-full right-0 mt-3 w-56 z-[60]"
          style={{
            background: "var(--paper-2)",
            border: "2.5px solid var(--ink)",
            borderRadius: 14,
            boxShadow: "4px 4px 0 var(--ink)",
          }}
        >
          {/* network row */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.12)" }}>
            {wrongNetwork ? (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-xs font-bold flex-1" style={{ color: "#E25C5C" }}>
                  {lang === "ru" ? "Не та сеть" : "Wrong network"}
                </span>
                <button
                  onClick={() => { switchChain({ chainId: abstractTestnet.id }); setMenuOpen(false); }}
                  className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{ background: "#E25C5C", color: "#0F1115", border: "1.5px solid #0F1115" }}
                >
                  {lang === "ru" ? "Сменить" : "Switch"}
                </button>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold" style={{ color: "var(--ink-2)" }}>Abstract Testnet</span>
              </>
            )}
          </div>

          {/* nickname row */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.12)" }}>
            <svg className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-semibold truncate flex-1" style={{ color: "var(--ink-2)" }}>{nickname || shortAddr}</span>
          </div>

          {/* address copy row */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1.5px solid rgba(15,17,21,0.12)" }}>
            <svg className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <button
              className="text-xs font-mono truncate flex-1 text-left transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-3)" }}
              onClick={() => { navigator.clipboard.writeText(address ?? "").catch(() => {}); setMenuOpen(false); }}
            >
              {address?.slice(0, 10)}…{address?.slice(-8)}
            </button>
          </div>

          {/* disconnect */}
          <button
            onClick={() => { disconnect(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold transition-colors rounded-b-[11px]"
            style={{ color: "#E25C5C", background: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(226,92,92,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {lang === "ru" ? "Отключить" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}

type ConnectModalProps = {
  lang: string;
  open: boolean;
  onClose: () => void;
};

function ConnectModal({ lang, open, onClose }: ConnectModalProps) {
  const { connect, connectors, isPending, variables } = useConnect();
  const { isConnected } = useAccount();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isConnected && open) onClose();
  }, [isConnected, open, onClose]);

  if (!open) return null;

  const connectingId = isPending ? variables?.connector : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(#0d0f22, #080918) padding-box, linear-gradient(135deg, rgba(0,240,255,0.4), rgba(176,38,255,0.4)) border-box",
          border: "1px solid transparent",
          boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 40px rgba(0,240,255,0.08)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {lang === "ru" ? "Подключить кошелёк" : "Connect Wallet"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-2">
          {connectors.map((connector) => {
            const isConnecting = connectingId === connector;
            return (
              <button
                key={connector.id}
                disabled={isPending}
                onClick={() => {
                  setError("");
                  connect(
                    { connector },
                    { onError: (e) => setError(e.message) }
                  );
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/6 disabled:opacity-50"
                style={{
                  background: isConnecting ? "rgba(0,240,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <ConnectorIcon id={connector.id} name={connector.name} />
                <span className="flex-1 text-left text-sm font-semibold text-white/85">
                  {connector.name}
                </span>
                {isConnecting && (
                  <svg className="h-4 w-4 animate-spin text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="px-4 pb-4">
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        <div className="px-6 py-3 flex justify-center" style={{ borderTop: "1px solid var(--panel-border)" }}>
          <img src="/logo.svg" alt="CoinDeck" className="h-5 w-auto opacity-60" />
        </div>
      </div>
    </div>,
    document.body,
  );
}

type ConnectButtonProps = {
  lang: string;
  onOpenConnect: () => void;
};

function ConnectButton({ lang, onOpenConnect }: ConnectButtonProps) {
  return (
    <button
      onClick={onOpenConnect}
      className="btn-sticker-primary flex items-center gap-1.5 px-4 py-2"
    >
      {ICON_WALLET}
      <span className="text-xs font-bold uppercase tracking-widest">
        {lang === "ru" ? "Войти" : "Connect"}
      </span>
    </button>
  );
}

export type { ConnectModalProps };

type Props = {
  lang: string;
  ctaHost: HTMLElement | null;
};

export function ConnectPortals({ lang, ctaHost }: Props) {
  const { isConnected } = useAccount();
  const [connectOpen, setConnectOpen] = useState(false);

  const button = isConnected
    ? <WalletButton lang={lang} />
    : <ConnectButton lang={lang} onOpenConnect={() => setConnectOpen(true)} />;

  return (
    <>
      {ctaHost ? createPortal(button, ctaHost) : null}
      <ConnectModal lang={lang} open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}

export function WrongNetworkBlocker({ lang }: { lang: string }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected || chainId === abstractTestnet.id) return null;

  return (
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
          onClick={() => switchChain({ chainId: abstractTestnet.id })}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 py-3 text-sm font-bold text-white hover:opacity-90 transition"
        >
          {lang === "ru" ? "Переключить на Testnet" : "Switch to Testnet"}
        </button>
      </div>
    </div>
  );
}
