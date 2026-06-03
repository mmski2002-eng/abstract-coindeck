"use client";
import React from "react";


const KEYFRAMES = `
  @keyframes beachWave {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes eggWiggle1 {
    0%,100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-18px) rotate(3deg); }
  }
  @keyframes eggWiggle2 {
    0%,100% { transform: translateY(-8px) rotate(2deg); }
    50% { transform: translateY(10px) rotate(-2deg); }
  }
  @keyframes eggWiggle3 {
    0%,100% { transform: translateY(4px) rotate(-1deg); }
    50% { transform: translateY(-14px) rotate(1deg); }
  }
  @keyframes penguinSway {
    0%,100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }
  @keyframes ghostFloat {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }
  @keyframes connectPulse {
    0%,100% { box-shadow: 4px 4px 0 var(--outline), 0 0 0 0 var(--beach-connect-pulse); }
    55% { box-shadow: 4px 4px 0 var(--outline), 0 0 0 14px var(--beach-connect-pulse-off); }
  }
  @keyframes fadeInCard {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes dotPulse {
    0%,100% { box-shadow: 0 0 0 0 var(--beach-connect-pulse); }
    50% { box-shadow: 0 0 0 5px var(--beach-connect-pulse-off); }
  }
`;

const GHOST_POSITIONS = [
  { left: "10%", bottom: "27%" },
  { left: "26%", bottom: "25%" },
  { right: "26%", bottom: "27%" },
  { right: "10%", bottom: "25%" },
] as const;

export function BeachScene({ lang, isDark }: { lang: string; isDark: boolean }) {

  const bg = "linear-gradient(to bottom, var(--beach-sky-start) 0%, var(--beach-sky-end) 52%, var(--beach-sea-start) 66%, var(--beach-sea-end) 76%, var(--beach-sand-start) 78%, var(--beach-sand-end) 100%)";

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 15, overflow: "hidden" }}>
        {/* Sky + sea + sand gradient */}
        <div style={{ position: "absolute", inset: 0, background: bg }} />

        {/* Waves */}
        <div style={{ position: "absolute", bottom: "22%", left: 0, right: 0, height: 70, overflow: "hidden", zIndex: 2 }}>
          <svg
            style={{ position: "absolute", width: "200%", height: "100%", animation: "beachWave 9s linear infinite" }}
            viewBox="0 0 2880 70"
            preserveAspectRatio="none"
          >
            <path d="M0,35 C240,58 480,12 720,35 C960,58 1200,12 1440,35 C1680,58 1920,12 2160,35 C2400,58 2640,12 2880,35 L2880,70 L0,70 Z" fill="var(--beach-wave-front)" />
          </svg>
          <svg
            style={{ position: "absolute", width: "200%", height: "100%", top: 14, animation: "beachWave 6.5s linear infinite", animationDelay: "-2s" }}
            viewBox="0 0 2880 70"
            preserveAspectRatio="none"
          >
            <path d="M0,22 C360,44 720,5 1080,28 C1440,50 1800,6 2160,28 C2520,50 2700,14 2880,22 L2880,70 L0,70 Z" fill="var(--beach-wave-back)" />
          </svg>
        </div>

        {/* Penguin left */}
        <img
          src="/penguin-left.webp"
          alt=""
          style={{
            position: "absolute", bottom: "18.5%", left: "3%",
            height: "clamp(88px, 17vh, 220px)", width: "auto",
            objectFit: "contain",
            animation: "penguinSway 4.5s ease-in-out infinite",
            filter: isDark ? "brightness(0.65)" : "none",
            zIndex: 3,
          }}
        />

        {/* Penguin right */}
        <img
          src="/fonpepe-right.webp"
          alt=""
          style={{
            position: "absolute", bottom: "18.5%", right: "3%",
            height: "clamp(88px, 17vh, 220px)", width: "auto",
            objectFit: "contain",
            animation: "penguinSway 5.5s ease-in-out infinite",
            animationDelay: "-2.5s",
            filter: isDark ? "brightness(0.65)" : "none",
            zIndex: 3,
          }}
        />

        {/* Egg 1 — top-left, large */}
        <img
          src="/egg.webp"
          alt=""
          style={{
            position: "absolute", top: "13%", left: "8%",
            width: "clamp(36px, 4.5vw, 72px)", height: "auto",
            animation: "eggWiggle1 5s ease-in-out infinite",
            filter: isDark ? "brightness(0.7)" : "none",
            zIndex: 3,
          }}
        />

        {/* Egg 2 — top-right, medium */}
        <img
          src="/egg2.webp"
          alt=""
          style={{
            position: "absolute", top: "25%", right: "11%",
            width: "clamp(28px, 3.5vw, 56px)", height: "auto",
            animation: "eggWiggle2 7.5s ease-in-out infinite",
            filter: isDark ? "brightness(0.7)" : "none",
            zIndex: 3,
          }}
        />

        {/* Egg 3 — mid-left, small */}
        <img
          src="/egg.webp"
          alt=""
          style={{
            position: "absolute", top: "50%", left: "20%",
            width: "clamp(20px, 2.4vw, 40px)", height: "auto",
            animation: "eggWiggle3 6s ease-in-out infinite",
            animationDelay: "-3.2s",
            filter: isDark ? "brightness(0.7)" : "none",
            zIndex: 3,
          }}
        />

        {/* Ghost NFT cards */}
        {GHOST_POSITIONS.map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: "clamp(58px, 6.5vw, 88px)",
              height: "clamp(80px, 9vw, 118px)",
              borderRadius: 12,
              background: "var(--beach-ghost-bg)",
              border: "1.5px solid var(--beach-ghost-border)",
              filter: "blur(2.5px)",
              opacity: isDark ? 0.5 : 0.65,
              animation: `ghostFloat ${4 + i * 0.75}s ease-in-out infinite`,
              animationDelay: `${-i * 1.3}s`,
              zIndex: 2,
            }}
          >
            <div style={{
              margin: "7px 7px 0",
              height: "54%",
              borderRadius: 8,
              background: "var(--beach-ghost-inner-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <img src="/egg.webp" style={{ width: "48%", height: "auto", opacity: 0.5 }} alt="" />
            </div>
            <div style={{ margin: "6px 7px 3px", height: 6, borderRadius: 3, background: "var(--beach-ghost-line-strong)" }} />
            <div style={{ margin: "0 7px", height: 5, borderRadius: 3, background: "var(--beach-ghost-line-soft)", width: "55%" }} />
          </div>
        ))}

      </div>
    </>
  );
}
