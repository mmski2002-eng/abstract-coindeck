"use client";
import React, { useEffect, useRef, useState } from "react";

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
  @keyframes penguinWalkLeft {
    0%   { transform: translateX(0)     scaleX(1);  }
    8%   { transform: translateX(3vw)   scaleX(1);  }
    40%  { transform: translateX(30vw)  scaleX(1);  }
    48%  { transform: translateX(30vw)  scaleX(-1); }
    56%  { transform: translateX(27vw)  scaleX(-1); }
    90%  { transform: translateX(0)     scaleX(-1); }
    98%  { transform: translateX(0)     scaleX(1);  }
    100% { transform: translateX(0)     scaleX(1);  }
  }
  @keyframes penguinWalkRight {
    0%   { transform: translateX(0)      scaleX(1);  }
    8%   { transform: translateX(-3vw)   scaleX(1);  }
    40%  { transform: translateX(-30vw)  scaleX(1);  }
    48%  { transform: translateX(-30vw)  scaleX(-1); }
    56%  { transform: translateX(-27vw)  scaleX(-1); }
    90%  { transform: translateX(0)      scaleX(-1); }
    98%  { transform: translateX(0)      scaleX(1);  }
    100% { transform: translateX(0)      scaleX(1);  }
  }
  @keyframes penguinBob {
    0%,100% { transform: translateY(0);    }
    25%     { transform: translateY(-5px); }
    75%     { transform: translateY(-5px); }
  }
  @keyframes ghostFloat {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }
  @keyframes connectPulse {
    0%,100% { box-shadow: 4px 4px 0 var(--shadow-sticker-color-strong), 0 0 0 0 var(--beach-connect-pulse); }
    55% { box-shadow: 4px 4px 0 var(--shadow-sticker-color-strong), 0 0 0 14px var(--beach-connect-pulse-off); }
  }
  @keyframes fadeInCard {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes dotPulse {
    0%,100% { box-shadow: 0 0 0 0 var(--beach-connect-pulse); }
    50% { box-shadow: 0 0 0 5px var(--beach-connect-pulse-off); }
  }
  @keyframes cloudDrift {
    0%   { transform: translateX(-220px); }
    100% { transform: translateX(calc(100vw + 220px)); }
  }
  @keyframes splashRipple {
    0%   { transform: scale(0.2); opacity: 0.75; }
    100% { transform: scale(3.5); opacity: 0; }
  }
  @keyframes starTwinkle {
    0%, 100% { opacity: 0.15; }
    50%      { opacity: 0.9; }
  }
  @keyframes pawFade {
    0%, 40% { opacity: 0.6; }
    100%    { opacity: 0; }
  }
`;

const GHOST_POSITIONS = [
  { left: "10%", bottom: "27%" },
  { left: "26%", bottom: "25%" },
  { right: "26%", bottom: "27%" },
  { right: "10%", bottom: "25%" },
] as const;

type Star = { id: number; left: number; top: number; size: number; dur: number; delay: number };

function genStars(n: number): Star[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: 4 + Math.random() * 90,
    top: 1 + Math.random() * 40,
    size: 2 + Math.random() * 2,
    dur: 1.5 + Math.random() * 2.5,
    delay: -(Math.random() * 4),
  }));
}

const PAW_SVG =
  `<svg width="14" height="18" viewBox="0 0 14 18" xmlns="http://www.w3.org/2000/svg">` +
  `<ellipse cx="7" cy="12.5" rx="4" ry="4.5" fill="currentColor"/>` +
  `<ellipse cx="2.5" cy="5.5" rx="1.7" ry="2" fill="currentColor"/>` +
  `<ellipse cx="7" cy="3" rx="1.7" ry="2" fill="currentColor"/>` +
  `<ellipse cx="11.5" cy="5.5" rx="1.7" ry="2" fill="currentColor"/>` +
  `</svg>`;

export function BeachScene({ lang, isDark, onToggleTheme }: { lang: string; isDark: boolean; onToggleTheme?: () => void }) {
  const sceneRef = useRef<HTMLDivElement>(null);

  const penguinLFleeRef = useRef<HTMLDivElement>(null);
  const penguinRFleeRef = useRef<HTMLDivElement>(null);
  const penguinLImgRef = useRef<HTMLImageElement>(null);
  const penguinRImgRef = useRef<HTMLImageElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);

  const [stars, setStars] = useState<Star[]>([]);
  useEffect(() => { setStars(genStars(50)); }, []);

  // Cloud eggs — spawned under cloud, fall to water, splash (light theme only)
  useEffect(() => {
    if (isDark) return;
    const scene = sceneRef.current;
    if (!scene) return;
    let alive = true;
    let tid: ReturnType<typeof setTimeout>;

    const spawn = () => {
      if (!alive) return;
      const cloud = cloudRef.current;
      if (!cloud) { tid = setTimeout(spawn, 500); return; }

      const sr = scene.getBoundingClientRect();
      const cr = cloud.getBoundingClientRect();
      const sx = cr.left - sr.left + cr.width * 0.15 + Math.random() * cr.width * 0.7;
      const sy = cr.bottom - sr.top;
      const waterY = sr.height * 0.77;
      const dist = Math.max(50, waterY - sy);
      const wX = Math.random() * 18 - 9;
      const rotDir = Math.random() > 0.5 ? 1 : -1;
      const rot = 220 + Math.random() * 280;

      const uid = `ed${Date.now()}${(Math.random() * 9999) | 0}`;
      const st = document.createElement("style");
      st.textContent =
        `@keyframes ${uid}{` +
        `0%{transform:translateY(0) rotate(0deg) translateX(0)}` +
        `40%{transform:translateY(${dist * 0.4}px) rotate(${rotDir * rot * 0.4}deg) translateX(${wX * 0.6}px)}` +
        `75%{transform:translateY(${dist * 0.75}px) rotate(${rotDir * rot * 0.75}deg) translateX(${-wX}px)}` +
        `100%{transform:translateY(${dist}px) rotate(${rotDir * rot}deg) translateX(0)}}`;
      document.head.appendChild(st);

      const egg = document.createElement("img");
      egg.src = "/egg.webp";
      egg.style.cssText =
        `position:absolute;left:${sx}px;top:${sy}px;` +
        `width:clamp(12px,1.6vw,22px);height:auto;z-index:4;pointer-events:none;will-change:transform;` +
        `animation:${uid} 2.3s ease-in forwards;`;
      scene.appendChild(egg);

      setTimeout(() => {
        if (!alive) { egg.remove(); st.remove(); return; }
        const splash = document.createElement("div");
        splash.style.cssText =
          `position:absolute;left:${sx - 14}px;top:${waterY - 6}px;` +
          `width:28px;height:12px;border-radius:50%;border:2px solid rgba(168,223,245,0.8);` +
          `pointer-events:none;z-index:4;animation:splashRipple 0.65s ease-out forwards;`;
        scene.appendChild(splash);
        egg.remove();
        st.remove();
        setTimeout(() => splash.remove(), 700);
      }, 2100);

      tid = setTimeout(spawn, 2000 + Math.random() * 2000);
    };

    tid = setTimeout(spawn, 600 + Math.random() * 1000);
    return () => { alive = false; clearTimeout(tid); };
  }, [isDark]);

  // Meteor eggs — diagonal, with glowing tail, splash (dark theme only)
  useEffect(() => {
    if (!isDark) return;
    const scene = sceneRef.current;
    if (!scene) return;
    let alive = true;
    let tid: ReturnType<typeof setTimeout>;

    const spawn = () => {
      if (!alive) return;
      const sr = scene.getBoundingClientRect();
      const waterY = sr.height * 0.77;
      const sx = sr.width * (0.04 + Math.random() * 0.48);
      const sy = sr.height * (0.02 + Math.random() * 0.13);
      const angleDeg = 32 + Math.random() * 14;
      const angleRad = angleDeg * (Math.PI / 180);
      const tY = waterY - sy + 30;
      const tX = tY / Math.tan(angleRad);
      const tDist = Math.sqrt(tX * tX + tY * tY);
      const rotDeg = 90 - angleDeg;

      const uid = `mt${Date.now()}${(Math.random() * 9999) | 0}`;
      const st = document.createElement("style");
      st.textContent =
        `@keyframes ${uid}{0%{transform:translateX(0);opacity:1}80%{opacity:0.9}100%{transform:translateX(${tDist}px);opacity:0}}`;
      document.head.appendChild(st);

      const wrap = document.createElement("div");
      wrap.style.cssText =
        `position:absolute;left:${sx}px;top:${sy}px;pointer-events:none;z-index:4;` +
        `transform:rotate(${rotDeg}deg);transform-origin:0 0;`;

      const inner = document.createElement("div");
      inner.style.cssText = `display:flex;align-items:center;will-change:transform;animation:${uid} 1.8s ease-in forwards;`;

      const tail = document.createElement("div");
      tail.style.cssText =
        `width:48px;height:2px;flex-shrink:0;align-self:center;` +
        `background:linear-gradient(to right,transparent,rgba(255,245,200,0.65));`;

      const img = document.createElement("img");
      img.src = "/egg.webp";
      img.style.cssText =
        `width:15px;height:auto;flex-shrink:0;` +
        `filter:brightness(2.2) drop-shadow(0 0 5px rgba(255,235,160,0.9));`;

      inner.appendChild(tail);
      inner.appendChild(img);
      wrap.appendChild(inner);
      scene.appendChild(wrap);

      setTimeout(() => {
        if (!alive) { wrap.remove(); st.remove(); return; }
        const landX = sx + tX;
        const splash = document.createElement("div");
        splash.style.cssText =
          `position:absolute;left:${landX - 14}px;top:${waterY - 6}px;` +
          `width:28px;height:12px;border-radius:50%;border:2px solid rgba(180,215,255,0.7);` +
          `pointer-events:none;z-index:4;animation:splashRipple 0.65s ease-out forwards;`;
        scene.appendChild(splash);
        wrap.remove();
        st.remove();
        setTimeout(() => splash.remove(), 700);
      }, 1700);

      tid = setTimeout(spawn, 3000 + Math.random() * 2000);
    };

    tid = setTimeout(spawn, 900 + Math.random() * 1500);
    return () => { alive = false; clearTimeout(tid); };
  }, [isDark]);

  // Penguin flee + paw prints
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let pawDist = 0;
    let lastPX = 0;
    let lastPY = 0;
    let pawStep = 0;
    let pawCount = 0;

    const spawnPaw = (cx: number, cy: number, angle: number, step: number) => {
      if (pawCount >= 30) return;
      const sr = scene.getBoundingClientRect();
      const ox = step === 0 ? -10 : 10;
      const oy = step === 0 ? 0 : -5;
      const rotExtra = step === 0 ? -0.2 : 0.2;
      const paw = document.createElement("div");
      paw.innerHTML = PAW_SVG;
      paw.style.cssText =
        `position:absolute;left:${cx - sr.left + ox - 9}px;top:${cy - sr.top + oy - 11}px;` +
        `width:18px;height:22px;color:#7a5c2e;pointer-events:none;z-index:6;` +
        `transform:rotate(${angle + rotExtra}rad);transform-origin:center;` +
        `animation:pawFade 4s ease-out forwards;`;
      scene.appendChild(paw);
      pawCount++;
      setTimeout(() => { paw.remove(); pawCount--; }, 4000);
    };

    const onMove = (cx: number, cy: number) => {
      const sr = scene.getBoundingClientRect();

      // Penguin flee
      const pairs: Array<{ img: React.RefObject<HTMLImageElement | null>; wrap: React.RefObject<HTMLDivElement | null> }> = [
        { img: penguinLImgRef, wrap: penguinLFleeRef },
        { img: penguinRImgRef, wrap: penguinRFleeRef },
      ];
      for (const { img, wrap } of pairs) {
        const imgEl = img.current;
        const wrapEl = wrap.current;
        if (!imgEl || !wrapEl) continue;
        const r = imgEl.getBoundingClientRect();
        const pcx = r.left + r.width / 2;
        const pcy = r.top + r.height / 2;
        const dx = cx - pcx;
        const dy = cy - pcy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 150 && d > 0) {
          const force = (150 - d) / 150;
          const raw = -(dx / d) * force * 180;
          const wr = wrapEl.getBoundingClientRect();
          const minOff = sr.left - wr.left + 8;
          const maxOff = sr.right - wr.right - 8;
          const clamped = Math.max(minOff, Math.min(maxOff, raw));
          wrapEl.style.transition = "none";
          wrapEl.style.transform = `translateX(${clamped}px)`;
        } else {
          wrapEl.style.transition = "transform 0.8s ease";
          wrapEl.style.transform = "";
        }
      }

      // Paw prints in sand zone (bottom 22% = sand area)
      if (cy > sr.bottom - sr.height * 0.22) {
        const ddx = cx - lastPX;
        const ddy = cy - lastPY;
        pawDist += Math.sqrt(ddx * ddx + ddy * ddy);
        if (pawDist >= 50) {
          pawDist = 0;
          spawnPaw(cx, cy, Math.atan2(ddy, ddx), pawStep);
          pawStep ^= 1;
        }
      }
      lastPX = cx;
      lastPY = cy;
    };

    const onMouse = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    scene.addEventListener("mousemove", onMouse);
    scene.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      scene.removeEventListener("mousemove", onMouse);
      scene.removeEventListener("touchmove", onTouch);
    };
  }, []);

  const skyBg = isDark
    ? "linear-gradient(to bottom,#07071e 0%,#13134a 52%,var(--beach-sea-start) 66%,var(--beach-sea-end) 76%,var(--beach-sand-start) 78%,var(--beach-sand-end) 100%)"
    : "linear-gradient(to bottom,var(--beach-sky-start) 0%,var(--beach-sky-end) 52%,var(--beach-sea-start) 66%,var(--beach-sea-end) 76%,var(--beach-sand-start) 78%,var(--beach-sand-end) 100%)";

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div ref={sceneRef} style={{ position: "fixed", inset: 0, zIndex: 15, overflow: "hidden" }}>

        {/* Sky gradient */}
        <div style={{ position: "absolute", inset: 0, background: skyBg, transition: "background 2s ease" }} />

        {/* Night dark overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
          background: "linear-gradient(to bottom,rgba(4,4,22,0.6) 0%,rgba(8,8,32,0.3) 55%,transparent 74%)",
          opacity: isDark ? 1 : 0, transition: "opacity 1.8s ease",
        }} />

        {/* Stars */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
          opacity: isDark ? 1 : 0, transition: "opacity 1.8s ease",
        }}>
          {stars.map(s => (
            <div key={s.id} style={{
              position: "absolute", left: `${s.left}%`, top: `${s.top}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
              animation: `starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
              willChange: "opacity",
            }} />
          ))}
        </div>



        {/* Cloud (light theme only) */}
        <div ref={cloudRef} style={{
          position: "absolute", top: "11%", left: 0, zIndex: 3, pointerEvents: "none",
          opacity: isDark ? 0 : 0.82, transition: "opacity 1.8s ease",
          animation: "cloudDrift 28s linear infinite", willChange: "transform",
        }}>
          <div style={{ position: "relative", width: 130, height: 52 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50% 50% 45% 45% / 55% 55% 45% 45%", background: "#6a7b8c" }} />
            <div style={{ position: "absolute", top: -18, left: 18, width: 58, height: 42, borderRadius: "50%", background: "#7a8c9e" }} />
            <div style={{ position: "absolute", top: -12, left: 52, width: 44, height: 36, borderRadius: "50%", background: "#6e8090" }} />
          </div>
        </div>

        {/* Waves */}
        <div style={{ position: "absolute", bottom: "22%", left: 0, right: 0, height: 70, overflow: "hidden", zIndex: 2 }}>
          <svg
            style={{ position: "absolute", width: "200%", height: "100%", animation: "beachWave 9s linear infinite" }}
            viewBox="0 0 2880 70" preserveAspectRatio="none"
          >
            <path d="M0,35 C240,58 480,12 720,35 C960,58 1200,12 1440,35 C1680,58 1920,12 2160,35 C2400,58 2640,12 2880,35 L2880,70 L0,70 Z" fill="var(--beach-wave-front)" />
          </svg>
          <svg
            style={{ position: "absolute", width: "200%", height: "100%", top: 14, animation: "beachWave 6.5s linear infinite", animationDelay: "-2s" }}
            viewBox="0 0 2880 70" preserveAspectRatio="none"
          >
            <path d="M0,22 C360,44 720,5 1080,28 C1440,50 1800,6 2160,28 C2520,50 2700,14 2880,22 L2880,70 L0,70 Z" fill="var(--beach-wave-back)" />
          </svg>
        </div>

        {/* Penguin left — flee wrapper isolates JS transform from walk animation */}
        <div ref={penguinLFleeRef} style={{ position: "absolute", bottom: "18.5%", left: "3%", zIndex: 3 }}>
          <div style={{ animation: "penguinWalkLeft 11s ease-in-out infinite" }}>
            <img
              ref={penguinLImgRef}
              src="/penguin-left.webp"
              alt=""
              style={{
                height: "clamp(88px,17vh,220px)", width: "auto",
                objectFit: "contain", display: "block",
                animation: "penguinBob 0.55s ease-in-out infinite",
                filter: isDark ? "brightness(0.65)" : "none",
              }}
            />
          </div>
        </div>

        {/* Penguin right — flee wrapper */}
        <div ref={penguinRFleeRef} style={{ position: "absolute", bottom: "18.5%", right: "3%", zIndex: 3 }}>
          <div style={{ animation: "penguinWalkRight 13s ease-in-out infinite", animationDelay: "-4s" }}>
            <img
              ref={penguinRImgRef}
              src="/fonpepe-right.webp"
              alt=""
              style={{
                height: "clamp(88px,17vh,220px)", width: "auto",
                objectFit: "contain", display: "block",
                animation: "penguinBob 0.6s ease-in-out infinite", animationDelay: "-0.3s",
                filter: isDark ? "brightness(0.65)" : "none",
              }}
            />
          </div>
        </div>


        {/* Ghost NFT cards */}
        {GHOST_POSITIONS.map((pos, i) => (
          <div key={i} style={{
            position: "absolute", ...pos,
            width: "clamp(58px,6.5vw,88px)", height: "clamp(80px,9vw,118px)",
            borderRadius: 12, background: "var(--beach-ghost-bg)",
            border: "1.5px solid var(--beach-ghost-border)", filter: "blur(2.5px)",
            opacity: isDark ? 0.5 : 0.65,
            animation: `ghostFloat ${4 + i * 0.75}s ease-in-out infinite`,
            animationDelay: `${-i * 1.3}s`, zIndex: 2,
          }}>
            <div style={{
              margin: "7px 7px 0", height: "54%", borderRadius: 8,
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
