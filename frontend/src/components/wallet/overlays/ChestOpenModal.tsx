"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ASSETS } from "@/config/assetUniverse";

const EGG_STARS: { top?: string; left?: string; right?: string; bottom?: string; animationDelay: string; animationDuration: string }[] = [
  { top: "-18px", left: "50%",    animationDelay: "0s",   animationDuration: "2.1s" },
  { top: "10%",   left: "-20px",  animationDelay: "0.7s", animationDuration: "1.8s" },
  { top: "10%",   right: "-20px", animationDelay: "1.3s", animationDuration: "2.4s" },
  { bottom: "5%", left: "-18px",  animationDelay: "0.4s", animationDuration: "1.6s" },
  { bottom: "5%", right: "-18px", animationDelay: "1.0s", animationDuration: "2.2s" },
  { bottom: "-16px", left: "40%", animationDelay: "1.6s", animationDuration: "1.9s" },
];

const THEME = [
  { accent: "#D9D3C2", glow: "rgba(217,211,194,0.22)", bg: "rgba(217,211,194,0.08)" },
  { accent: "#7AC7E8", glow: "rgba(122,199,232,0.22)", bg: "rgba(122,199,232,0.08)" },
  { accent: "#26C6A8", glow: "rgba(38,198,168,0.22)",  bg: "rgba(38,198,168,0.08)"  },
];

const TIER_NAME = ["Маленькое", "Среднее", "Тяжелое", "Супер Тяжелое"];

type Phase = "idle" | "fading" | "waiting" | "scratching" | "lastaExit" | "reveal";

export type ChestOpenData = { type: number; label: string; emoji: string; tier: number; available: number; grad: string; ring: string; buyBg: string };

type Props = {
  lang: string;
  modal: ChestOpenData;
  onClose: () => void;
  chestOpenQty: number;
  setChestOpenQty: React.Dispatch<React.SetStateAction<number>>;
  busy: string | null;
  onOpenChestTyped: (type: number, qty: number) => void;
  txConfirmed: boolean;
  cardFound: boolean;
  revealCard: { playerId: number; tier: number } | null;
  revealCards: { playerId: number; tier: number }[] | null;
};

function chestWord(n: number, ru: boolean) {
  if (!ru) return n === 1 ? "egg" : "eggs";
  if (n === 1) return "яйцо";
  if (n < 5)   return "яйца";
  return "яиц";
}

export function ChestOpenModal({ lang, modal, onClose, chestOpenQty, setChestOpenQty, busy, onOpenChestTyped, txConfirmed, cardFound, revealCard, revealCards }: Props) {
  const t   = THEME[modal.type] ?? THEME[0];
  const tn  = TIER_NAME[modal.tier] ?? "Common";
  const ru  = lang === "ru";

  const [phase, setPhase] = useState<Phase>("idle");
  const scratchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const exitTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const winCard = revealCard ?? revealCards?.[0] ?? null;
  const coin = winCard != null ? (ASSETS[winCard.playerId] ?? null) : null;

  function handleScratch() {
    setPhase("fading");
    onOpenChestTyped(modal.type, chestOpenQty);
  }

  // fading → waiting
  useEffect(() => {
    if (phase !== "fading") return;
    const id = setTimeout(() => setPhase("waiting"), 450);
    return () => clearTimeout(id);
  }, [phase]);

  // tx confirmed → scratching for 3s minimum
  useEffect(() => {
    if (!txConfirmed || phase !== "waiting") return;
    setPhase("scratching");
    scratchTimer.current = setTimeout(() => {
      setPhase("lastaExit");
      exitTimer.current = setTimeout(() => setPhase("reveal"), 550);
    }, 3000);
  }, [txConfirmed, phase]);

  // cancelled: busy became null while waiting
  useEffect(() => {
    if (phase === "waiting" && busy === null) setPhase("idle");
  }, [busy, phase]);

  // auto-close after reveal
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [phase, onClose]);

  useEffect(() => () => {
    clearTimeout(scratchTimer.current);
    clearTimeout(exitTimer.current);
  }, []);

  const showContent = phase === "idle";
  const showAnim    = phase !== "idle";
  const animOpacity = phase === "fading" ? 0 : 1;
  // clean egg fades in during scratch
  const cleanEggOpacity = phase === "scratching" ? 1 : phase === "lastaExit" || phase === "reveal" ? 1 : 0;
  const lastaVisible = phase === "scratching";
  const lastaExiting = phase === "lastaExit";
  const txSigned     = phase === "scratching" || phase === "lastaExit" || phase === "reveal";

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center backdrop-blur-sm p-4"
      style={{ background: "var(--overlay-backdrop)" }}
      onClick={showContent ? onClose : undefined}
    >
      <style>{`
        @keyframes scratchMove {
          0%   { transform: translate(-40px, -16px) rotate(-22deg); }
          30%  { transform: translate(40px,  18px)  rotate(20deg);  }
          60%  { transform: translate(-30px, -10px) rotate(-16deg); }
          80%  { transform: translate(35px,  14px)  rotate(18deg);  }
          100% { transform: translate(-40px, -16px) rotate(-22deg); }
        }
        @keyframes lastaIn {
          from { opacity: 0; transform: translate(-40px,-16px) rotate(-22deg) scale(0.5); }
          to   { opacity: 1; transform: translate(-40px,-16px) rotate(-22deg) scale(1); }
        }
        @keyframes lastaOut {
          from { opacity: 1; }
          to   { opacity: 0; transform: translateX(-320px) rotate(-35deg); }
        }
        @keyframes coinReveal {
          0%   { opacity: 0; transform: scale(0.4) rotate(-10deg); }
          60%  { opacity: 1; transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes tickerReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes confettiBurst {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--cx), var(--cy)) scale(0); }
        }
      `}</style>

      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "var(--modal-bg)",
          border: "1.5px solid #000",
          boxShadow: "var(--shadow-sticker)",
          minHeight: showAnim ? 400 : undefined,
          transition: "min-height 0.3s",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── IDLE CONTENT ── */}
        <div style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.35s", pointerEvents: showContent ? "auto" : "none", position: showAnim ? "absolute" : "relative", inset: showAnim ? 0 : undefined }}>
          <div className="relative flex flex-col items-center pt-8 pb-6 px-6 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${t.bg} 0%, transparent 65%)` }} />
            <div className="relative mb-4" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <div className="egg-ripple"   style={{ color: t.accent, animationDelay: `${([0,-4,-8] as const)[modal.type]}s` }} />
              <div className="egg-ripple-2" style={{ color: t.accent, animationDelay: `${([0,-4,-8] as const)[modal.type]}s` }} />
              {EGG_STARS.map((pos, i) => (
                <span key={i} className="egg-star" style={{ ...pos as CSSProperties, color: t.accent }}>✦</span>
              ))}
              <img src="/egg2.webp" alt={modal.label} className="egg-shake egg-glow"
                style={{ width: ([80,96,120] as const)[modal.type], height: ([80,96,120] as const)[modal.type], objectFit: "contain", position: "relative", zIndex: 1, animationDelay: `${([0,-4,-8] as const)[modal.type]}s`, color: t.accent }} />
            </div>
            <div className="relative text-center">
              <div className="font-display font-black text-xl tracking-tight" style={{ color: "var(--panel-text)" }}>{modal.label}</div>
              <div className="mt-2 flex items-center justify-center">
                <span style={{ display: "inline-flex", alignItems: "center", background: t.accent, color: "var(--ink)", border: "2.5px solid var(--ink)", borderRadius: 999, padding: "4px 10px", fontSize: 10, letterSpacing: 1.6, fontWeight: 800, boxShadow: "2px 2px 0 var(--card-shadow)" }}>
                  {tn}
                </span>
              </div>
            </div>
          </div>

          <div className="mx-6 h-px" style={{ background: `linear-gradient(to right, transparent, ${t.accent}35, transparent)` }} />

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--nft-muted)" }}>{ru ? "Выбери количество" : "Select amount"}</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => setChestOpenQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base transition active:scale-90" style={{ background: t.accent, border: "1.5px solid var(--ink)", color: "#111" }}>−</button>
                  <span className="w-10 text-center font-bold text-base tabular-nums" style={{ color: "var(--panel-text)" }}>{chestOpenQty}</span>
                  <button onClick={() => setChestOpenQty((q) => Math.min(modal.available, q + 1))} className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base transition active:scale-90" style={{ background: t.accent, border: "1.5px solid var(--ink)", color: "#111" }}>+</button>
                </div>
                <button onClick={() => setChestOpenQty(modal.available)} className="rounded-lg px-3 h-8 text-xs font-bold transition active:scale-90" style={{ background: t.accent, border: "1.5px solid var(--ink)", color: "#111" }}>MAX</button>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: t.accent + "0a", border: `1px solid ${t.accent}22` }}>
              <span style={{ color: "var(--panel-text-muted)" }}>{ru ? "Почешешь " : "Scratching "}</span>
              <span className="font-bold" style={{ color: "var(--panel-text)" }}>{chestOpenQty} {chestWord(chestOpenQty, ru)}</span>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="btn-sticker-outline flex-1" style={{ padding: "10px 20px", borderColor: t.accent, background: t.accent, color: "var(--chest-buy-btn-text)" }}>
                {ru ? "Отмена" : "Cancel"}
              </button>
              <button onClick={handleScratch} disabled={busy !== null} className="btn-sticker-primary flex-1" style={{ padding: "10px 20px", background: t.accent, color: "var(--chest-buy-btn-text)" }}>
                {ru ? "Почесать" : "Scratch"}
              </button>
            </div>
          </div>
        </div>

        {/* ── ANIMATION CONTENT ── */}
        {showAnim && (
          <div style={{ opacity: animOpacity, transition: "opacity 0.35s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, padding: "40px 24px", gap: 20 }}>

            {/* Egg stack + lasta */}
            <div style={{ position: "relative", width: 330, height: 330, display: "flex", alignItems: "center", justifyContent: "center" }}>

              {/* Spotted egg (egg2.webp) — base, fades out as clean egg covers */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!txSigned && <div className="egg-ripple"   style={{ color: t.accent }} />}
                {!txSigned && <div className="egg-ripple-2" style={{ color: t.accent }} />}
                {!txSigned && EGG_STARS.map((pos, i) => (
                  <span key={i} className="egg-star" style={{ ...pos as CSSProperties, color: t.accent }}>✦</span>
                ))}
                <img src="/egg2.webp" alt="" className={txSigned ? "" : "egg-shake egg-glow"}
                  style={{ width: 195, height: 195, objectFit: "contain", position: "relative", zIndex: 1, color: t.accent }} />
              </div>

              {/* Clean egg (egg.webp) — fades in over spotted egg during scratch */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, opacity: cleanEggOpacity, transition: "opacity 2.8s ease" }}>
                <img src="/egg.webp" alt=""
                  style={{ width: 206, height: 206, objectFit: "contain", color: t.accent }} />
              </div>

              {/* Coin reveal on clean egg */}
              {phase === "reveal" && coin && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
                  <img src={coin.iconPath} alt={coin.ticker}
                    style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "contain", animation: "coinReveal 0.6s cubic-bezier(.17,.67,.35,1.3) both" }} />
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18, letterSpacing: 2, color: coin.brandColor ?? t.accent, animation: "tickerReveal 0.5s ease 0.3s both" }}>
                    {coin.ticker}
                  </div>
                </div>
              )}

              {/* Confetti */}
              {phase === "reveal" && Array.from({ length: 10 }, (_, i) => {
                const angle = (i / 10) * 360;
                const dist  = 80 + (i % 3) * 28;
                return (
                  <div key={i} style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: 9, height: 9, borderRadius: "50%",
                    background: [t.accent, "var(--ink)", coin?.brandColor ?? "#fff"][i % 3],
                    "--cx": `${Math.round(Math.cos((angle * Math.PI) / 180) * dist)}px`,
                    "--cy": `${Math.round(Math.sin((angle * Math.PI) / 180) * dist)}px`,
                    animation: `confettiBurst 0.9s ease-out ${i * 60}ms both`,
                  } as unknown as CSSProperties} />
                );
              })}

              {/* Lasta */}
              {(lastaVisible || lastaExiting) && (
                <img
                  src="/lasta.webp"
                  alt=""
                  style={{
                    position: "absolute",
                    width: 350,
                    zIndex: 10,
                    pointerEvents: "none",
                    animation: lastaExiting
                      ? "lastaOut 0.5s ease-in both"
                      : "lastaIn 0.2s ease both, scratchMove 0.65s ease-in-out 0.2s infinite",
                  }}
                />
              )}
            </div>

            {/* Status */}
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "var(--panel-text)", fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>
                {phase === "waiting"    && (ru ? "Подтвердите в кошельке…" : "Confirm in wallet…")}
                {phase === "scratching" && (ru ? "Чешем яйцо…"            : "Scratching egg…")}
                {phase === "lastaExit"  && (ru ? "Почти готово…"          : "Almost done…")}
                {phase === "reveal"     && (ru ? "Готово! 🎉"              : "Done! 🎉")}
              </div>
              {phase === "reveal" && (
                <button onClick={onClose} className="btn-sticker-primary" style={{ marginTop: 16, padding: "8px 24px", background: t.accent, color: "var(--chest-buy-btn-text)" }}>
                  {ru ? "Отлично!" : "Awesome!"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
