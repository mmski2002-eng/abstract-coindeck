"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { COIN_ICONS } from "../constants";

const CHEST_ASSETS = [
  { closed: "/chests/wooden_closed.webp", open: "/chests/wooden_open.webp", particle: "var(--rarity-common)" },
  { closed: "/chests/iron_closed.webp",   open: "/chests/iron_open.webp",   particle: "var(--rarity-rare)" },
  { closed: "/chests/silver_closed.webp", open: "/chests/silver_open.webp", particle: "var(--rarity-epic)" },
];

// Pre-shuffled static card reel — same order every render to avoid hydration issues
const REEL_PIDS = [0,4,7,37,1,26,16,9,38,2,11,35,5,25,19,41,3,30,8,46,13,22,17,48,6,31,10,44,21,28,15,49,23,36,18,42,24,39,12,45,27,34,20,47,29,33,14,43,32,40];

export function ChestOpeningOverlay({
  chestType,
  txConfirmed,
  cardFound,
  lang,
  onSkip,
}: {
  chestType: number;
  txConfirmed: boolean;
  cardFound: boolean;
  lang: string;
  onSkip?: () => void;
}) {
  const [phase, setPhase] = useState<"waiting" | "shaking" | "burst" | "openWait" | "fadingOut">("waiting");
  const chest = CHEST_ASSETS[chestType] ?? CHEST_ASSETS[0];
  const isOpen = phase === "burst" || phase === "openWait" || phase === "fadingOut";
  const showReel = phase === "openWait" || phase === "fadingOut";
  const t1Ref = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const t2Ref = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!txConfirmed) return;
    queueMicrotask(() => setPhase("shaking"));
    t1Ref.current = setTimeout(() => setPhase("burst"), 2000);
    t2Ref.current = setTimeout(() => setPhase("openWait"), 3000);
    return () => { clearTimeout(t1Ref.current); clearTimeout(t2Ref.current); };
  }, [txConfirmed]);

  useEffect(() => {
    if (cardFound && (phase === "openWait" || phase === "burst")) {
      clearTimeout(t2Ref.current);
      queueMicrotask(() => setPhase("fadingOut"));
    }
  }, [cardFound, phase]);

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center" style={{ background: "var(--overlay-backdrop)" }}>

      {txConfirmed && onSkip && (
        <button
          onClick={onSkip}
          className="absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            background: "var(--modal-bg)",
            border: "2px solid var(--outline)",
          }}
          aria-label={lang === "ru" ? "Пропустить" : "Skip"}
        >
          <svg className="w-4 h-4" style={{ color: "var(--panel-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}

      <style>{`
        @keyframes chestWaitGlow {
          0%,100% { opacity: 0.86; }
          50%     { opacity: 1; }
        }
        @keyframes chestShakeAmplify {
          0%   { transform: rotate(0deg) scale(1); }
          4%   { transform: rotate(-1deg) scale(1.01); }
          8%   { transform: rotate(1.5deg) scale(1.02); }
          12%  { transform: rotate(-2deg) scale(1.03); }
          16%  { transform: rotate(2.5deg) scale(1.04); }
          20%  { transform: rotate(-3deg) scale(1.05); }
          24%  { transform: rotate(3.5deg) scale(1.06); }
          28%  { transform: rotate(-4deg) scale(1.07); }
          32%  { transform: rotate(4.5deg) scale(1.08); }
          36%  { transform: rotate(-5deg) scale(1.09); }
          40%  { transform: rotate(5.5deg) scale(1.10); }
          44%  { transform: rotate(-6deg) scale(1.11); }
          48%  { transform: rotate(6.5deg) scale(1.12); }
          52%  { transform: rotate(-7deg) scale(1.13); }
          56%  { transform: rotate(7.5deg) scale(1.13); }
          60%  { transform: rotate(-8deg) scale(1.14); }
          64%  { transform: rotate(8.5deg) scale(1.14); }
          68%  { transform: rotate(-9deg) scale(1.15); }
          72%  { transform: rotate(9.5deg) scale(1.15); }
          76%  { transform: rotate(-10deg) scale(1.15); }
          80%  { transform: rotate(10deg) scale(1.15); }
          84%  { transform: rotate(-10deg) scale(1.14); }
          88%  { transform: rotate(10deg) scale(1.13); }
          92%  { transform: rotate(-8deg) scale(1.10); }
          96%  { transform: rotate(5deg) scale(1.05); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes chestShakeGlow {
          0%,100% { opacity: 0.9; }
          50%     { opacity: 1; }
        }
        @keyframes burstFlash {
          0%   { opacity: 0; transform: scale(0.4); }
          25%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.8); }
        }
        @keyframes particleFly {
          from { opacity: 1; transform: rotate(var(--pa)) translateY(0) scale(1.2); }
          to   { opacity: 0; transform: rotate(var(--pa)) translateY(-160px) scale(0.1); }
        }
        @keyframes chestOpenPop {
          from { transform: scale(0.9); }
          55%  { transform: scale(1.08); }
          to   { transform: scale(1); }
        }
        @keyframes openWaitGlow {
          0%,100% { opacity: 0.92; }
          50%     { opacity: 1; }
        }
        @keyframes cardFlyOut {
          0%   { opacity: 0; transform: translate(calc(-50% + 0px), calc(-50% + 0px)) scale(0.15) rotate(0deg); }
          18%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.95) rotate(var(--rot)); }
        }
      `}</style>

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative" style={{ width: 540, height: 540 }}>
          {/* Burst flash */}
          {phase === "burst" && (
            <div
              className="absolute inset-[-80px] rounded-full pointer-events-none"
              style={{
                background: chest.particle,
                opacity: 0.16,
                animation: "burstFlash 1000ms ease-out both",
              }}
            />
          )}

          {/* Particles */}
          {phase === "burst" && Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
              style={{
                width: `${6 + (i % 3) * 4}px`,
                height: `${6 + (i % 3) * 4}px`,
                background: chest.particle,
                border: "1.5px solid var(--outline)",
                marginLeft: `-${3 + (i % 3) * 2}px`,
                marginTop: `-${3 + (i % 3) * 2}px`,
                "--pa": `${i * (360 / 20)}deg`,
                animation: `particleFly ${700 + (i % 5) * 150}ms ease-out ${i * 20}ms both`,
              } as CSSProperties & Record<"--pa", string>}
            />
          ))}

          {/* Closed chest */}
          <img
            src={chest.closed}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              opacity: isOpen ? 0 : 1,
              transition: "opacity 250ms ease-out",
              animation: phase === "waiting"
                ? "chestWaitGlow 2s ease-in-out infinite"
                : phase === "shaking"
                  ? "chestShakeAmplify 2s ease-in-out both, chestShakeGlow 2s ease-in-out both"
                  : undefined,
            }}
          />

          {/* Open chest */}
          <img
            src={chest.open}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              opacity: isOpen ? 1 : 0,
              transition: "opacity 250ms ease-out",
              animation: isOpen
                ? "chestOpenPop 500ms cubic-bezier(.17,.67,.35,1.3) both, openWaitGlow 2s ease-in-out 500ms infinite"
                : undefined,
            }}
          />
        </div>

        {/* Flying cards burst */}
        {showReel && Array.from({ length: 8 }, (_, i) => {
          const pid = REEL_PIDS[(i * 7) % REEL_PIDS.length];
          const angle = (i / 8) * 360;
          const dist = 110 + (i % 3) * 35;
          const tx = Math.round(Math.cos((angle * Math.PI) / 180) * dist);
          const ty = Math.round(Math.sin((angle * Math.PI) / 180) * dist);
          const rot = -40 + i * 12;
          const delay = i * 55;
          const dur = 850 + (i % 3) * 120;
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                top: "50%", left: "50%",
                width: 46, height: 63,
                borderRadius: 7,
                border: "1.5px solid var(--panel-border)",
                background: "var(--card)",
                overflow: "hidden",
                boxShadow: "var(--shadow-sticker-sm)",
                "--tx": `${tx}px`,
                "--ty": `${ty}px`,
                "--rot": `${rot}deg`,
                animation: `cardFlyOut ${dur}ms ease-out ${delay}ms both`,
              } as CSSProperties & Record<"--tx" | "--ty" | "--rot", string>}
            >
              <img src={COIN_ICONS[pid]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />
            </div>
          );
        })}

        <div className="text-sm tracking-wide" style={{ color: "var(--panel-text-muted)" }}>
          {phase === "waiting"
            ? (lang === "ru" ? "Подтвердите транзакцию в кошельке…" : "Confirm transaction in wallet…")
            : phase === "shaking"
              ? (lang === "ru" ? "Открываем сундук…" : "Opening chest…")
              : phase === "fadingOut"
                ? (lang === "ru" ? "Карточка найдена!" : "Card found!")
                : (lang === "ru" ? "Ищем карточку…" : "Finding your card…")}
        </div>
      </div>
    </div>,
    document.body,
  );
}
