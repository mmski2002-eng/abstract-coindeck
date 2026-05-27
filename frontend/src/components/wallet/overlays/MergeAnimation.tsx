"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { COIN_ICONS, TIER_HEX, TIER_COLORS } from "../constants";

export function MergeAnimation({
  card,
  txConfirmed,
  cardReady,
  onComplete,
  lang,
}: {
  card: { playerId: number; tier: number };
  txConfirmed: boolean;
  cardReady: boolean;
  onComplete: () => void;
  lang: string;
}) {
  const [phase, setPhase] = useState<"waiting" | "gathering" | "fusion" | "burst" | "awaiting">("waiting");
  const animDoneRef = useRef(false);
  const cardReadyRef = useRef(cardReady);
  const resultColor = TIER_HEX[Math.min(card.tier + 1, 3)];
  const currentColor = TIER_HEX[card.tier];
  const tc = TIER_COLORS[card.tier];

  const pentagon = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 - 90) * (Math.PI / 180);
    return { x: Math.round(Math.cos(a) * 105), y: Math.round(Math.sin(a) * 105) };
  });

  useEffect(() => {
    cardReadyRef.current = cardReady;
  }, [cardReady]);

  useEffect(() => {
    if (!txConfirmed) return;
    animDoneRef.current = false;
    queueMicrotask(() => setPhase("gathering"));
    const t1 = setTimeout(() => setPhase("fusion"), 900);
    const t2 = setTimeout(() => setPhase("burst"), 1600);
    const t3 = setTimeout(() => {
      animDoneRef.current = true;
      if (cardReadyRef.current) { onComplete(); } else { setPhase("awaiting"); }
    }, 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [txConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cardReady && animDoneRef.current) onComplete();
  }, [cardReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md gap-10">

      {txConfirmed && (
        <button
          onClick={onComplete}
          className="absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(#0d0f22, #08091a) padding-box, linear-gradient(135deg, rgba(0,240,255,0.3), rgba(176,38,255,0.3)) border-box",
            border: "1px solid transparent",
            boxShadow: "0 0 14px rgba(0,240,255,0.12)",
          }}
          aria-label={lang === "ru" ? "Пропустить" : "Skip"}
        >
          <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}

      <style>{`
        @keyframes mergeWait {
          0%,100% { opacity:0.65; transform:translate(var(--mx),var(--my)) scale(1); filter:drop-shadow(0 0 4px var(--mc)); }
          50%     { opacity:1;    transform:translate(var(--mx),var(--my)) scale(1.08); filter:drop-shadow(0 0 12px var(--mc)); }
        }
        @keyframes mergeGather {
          from { transform:translate(var(--mx),var(--my)) scale(1); opacity:1; }
          80%  { transform:translate(0,0) scale(0.35); opacity:0.6; }
          to   { transform:translate(0,0) scale(0); opacity:0; }
        }
        @keyframes fusionSpin {
          from { transform:rotate(0deg) scale(0.4); opacity:0; }
          30%  { opacity:1; }
          to   { transform:rotate(720deg) scale(1.1); opacity:1; }
        }
        @keyframes fusionPulse {
          0%,100% { filter:blur(6px) brightness(1); }
          50%     { filter:blur(3px) brightness(2); }
        }
        @keyframes mergeBurstFlash {
          0%   { opacity:0; transform:scale(0.5); }
          25%  { opacity:1; transform:scale(1); }
          100% { opacity:0; transform:scale(2.2); }
        }
        @keyframes mergeParticle {
          from { opacity:1; transform:rotate(var(--pa)) translateY(0) scale(1.2); }
          to   { opacity:0; transform:rotate(var(--pa)) translateY(-160px) scale(0); }
        }
        @keyframes mergeAwaitSpin {
          from { transform:rotate(0deg); }
          to   { transform:rotate(360deg); }
        }
        @keyframes mergeAwaitPulse {
          0%,100% { opacity:0.5; transform:scale(0.92); }
          50%     { opacity:1;   transform:scale(1.08); }
        }
      `}</style>

      <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>

        {/* Pentagon cards */}
        {(phase === "waiting" || phase === "gathering") && pentagon.map(({ x, y }, i) => (
          <div
            key={i}
            className={`absolute overflow-hidden rounded-xl border-2 ${tc.border}`}
            style={{
              width: 52, height: 70,
              top: "50%", left: "50%",
              marginTop: -35, marginLeft: -26,
              "--mx": `${x}px`,
              "--my": `${y}px`,
              "--mc": currentColor,
              animation: phase === "waiting"
                ? `mergeWait 2s ease-in-out ${i * 180}ms infinite`
                : `mergeGather 900ms cubic-bezier(.55,.06,.68,.19) ${i * 50}ms both`,
            } as CSSProperties & Record<"--mx" | "--my" | "--mc", string>}
          >
            <img src={COIN_ICONS[card.playerId]} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        ))}

        {/* Fusion vortex */}
        {(phase === "fusion" || phase === "burst") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              style={{
                width: 140, height: 140,
                borderRadius: "50%",
                background: `conic-gradient(from 0deg, ${resultColor}, transparent 40%, ${resultColor}88 60%, transparent 80%, ${resultColor})`,
                animation: phase === "fusion"
                  ? "fusionSpin 700ms ease-in-out both, fusionPulse 700ms ease-in-out both"
                  : "mergeBurstFlash 500ms ease-out both",
              }}
            />
            <div className="absolute rounded-full" style={{
              width: 40, height: 40,
              background: `radial-gradient(circle, white 0%, ${resultColor} 50%, transparent 70%)`,
              filter: "blur(3px)",
              animation: phase === "fusion" ? "fusionPulse 700ms ease-in-out both" : "mergeBurstFlash 500ms ease-out both",
            }} />
          </div>
        )}

        {/* Burst particles */}
        {phase === "burst" && (
          <>
            <div className="absolute inset-[-70px] rounded-full pointer-events-none" style={{
              background: `radial-gradient(circle, ${resultColor}bb 0%, ${resultColor}44 40%, transparent 70%)`,
              animation: "mergeBurstFlash 700ms ease-out both",
            }} />
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
                style={{
                  width: 8 + (i % 3) * 4, height: 8 + (i % 3) * 4,
                  marginLeft: -(4 + (i % 3) * 2), marginTop: -(4 + (i % 3) * 2),
                  background: resultColor,
                  boxShadow: `0 0 10px ${resultColor}, 0 0 20px ${resultColor}`,
                  "--pa": `${i * (360 / 18)}deg`,
                  animation: `mergeParticle ${600 + (i % 4) * 130}ms ease-out ${i * 20}ms both`,
                } as CSSProperties & Record<"--pa", string>}
              />
            ))}
          </>
        )}

        {/* Awaiting result */}
        {phase === "awaiting" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div style={{
              width: 140, height: 140, borderRadius: "50%",
              background: `conic-gradient(from 0deg, ${resultColor}, transparent 40%, ${resultColor}88 60%, transparent 80%, ${resultColor})`,
              animation: "mergeAwaitSpin 1.4s linear infinite",
            }} />
            <div className="absolute rounded-full" style={{
              width: 50, height: 50,
              background: `radial-gradient(circle, white 0%, ${resultColor} 50%, transparent 70%)`,
              filter: "blur(4px)",
              animation: "mergeAwaitPulse 1s ease-in-out infinite",
            }} />
          </div>
        )}
      </div>

      <div className="text-sm tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
        {phase === "waiting"
          ? (lang === "ru" ? "Подтвердите транзакцию в кошельке…" : "Confirm transaction in wallet…")
          : phase === "awaiting"
          ? (lang === "ru" ? "Получаем новую карточку…" : "Getting your new card…")
          : (lang === "ru" ? "Объединяем карточки…" : "Merging cards…")}
      </div>
    </div>,
    document.body,
  );
}
