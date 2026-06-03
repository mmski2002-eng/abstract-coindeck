"use client";

import { WalletApp } from "@/components/WalletApp";
import { useI18n } from "@/components/LanguageProvider";
import { Modal, Card } from "@/components/ui";
import { TourOverlay } from "@/components/TourOverlay";
import React, { useEffect, useState } from "react";
import { Shield, Store, TrendingUp, Trophy, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { BeachScene } from "@/components/BeachScene";

type Tab = "roster" | "marketplace" | "tournament" | "rankings" | "admin";
type Theme = "light" | "dark";

function hadPreviousWalletConnection(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("wagmi.store");
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data?.state?.status === "connected" || Boolean(data?.state?.current);
  } catch { return false; }
}

const TICKER_DEFAULT = [
  { symbol: "BTC", price: "$109,482", change: "+2.41%" },
  { symbol: "ETH", price: "$5,864", change: "+1.18%" },
  { symbol: "SOL", price: "$214.77", change: "-0.62%" },
  { symbol: "BNB", price: "$1,024.55", change: "+0.93%" },
];

const TICKER_IDS: [string, string][] = [
  ["bitcoin", "BTC"],
  ["ethereum", "ETH"],
  ["solana", "SOL"],
  ["binancecoin", "BNB"],
];

function MergeRow({
  from,
  to,
}: {
  from: { label: string; color: string; count: number };
  to: { label: string; color: string; count: number };
}) {
  return (
    <div className="grid items-center gap-3 rounded-xl p-4 md:grid-cols-[1fr_auto_1fr]" style={{ border: "2px solid var(--outline)", background: "var(--paper-2)", boxShadow: "2px 2px 0 var(--shadow-sticker-color-strong)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: from.color }} />
          <div className="text-sm font-semibold" style={{ color: "var(--panel-text)" }}>{from.label}</div>
        </div>
        <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>x{from.count}</div>
      </div>
      <div className="mx-auto flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--panel-text-muted)" }}>
        <span className="rounded-full px-3 py-1" style={{ border: "2px solid var(--outline)", background: "var(--mint-soft)", color: "var(--ink)" }}>MERGE</span>
        <span style={{ color: "var(--panel-text-muted)" }}>5 → 1</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: to.color }} />
          <div className="text-sm font-semibold" style={{ color: "var(--panel-text)" }}>{to.label}</div>
        </div>
        <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>x{to.count}</div>
      </div>
    </div>
  );
}

function StepCard({ num, icon, title, desc }: { num: number; icon: string; title: string; desc: string }) {
  return (
    <div className="relative rounded-xl p-5" style={{ border: "2px solid var(--outline)", background: "var(--paper-2)", boxShadow: "3px 3px 0 var(--shadow-sticker-color-strong)" }}>
      <div className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black" style={{ border: "2px solid var(--outline)", background: "var(--sky)", color: "var(--ink)" }}>
        {num}
      </div>
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="mb-1 text-sm font-black" style={{ color: "var(--panel-text)" }}>{title}</div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--panel-text-muted)" }}>{desc}</div>
    </div>
  );
}

export function MarketingHome() {
  const { lang, setLang, t } = useI18n();
  const { isConnected, status } = useAccount();
  const [mechanicsOpen, setMechanicsOpen] = useState(false);
  const [fabDismissed, setFabDismissed] = useState(false);
  const [feedbackBtnDismissed, setFeedbackBtnDismissed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [activeTab, setActiveTab] = useState<Tab>("roster");
  const [isAdmin, setIsAdmin] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourDemoMode, setTourDemoMode] = useState(false);
  const [tickerItems, setTickerItems] = useState(TICKER_DEFAULT);
  const [theme, setTheme] = useState<Theme>("dark");
  const _prevConnected = hadPreviousWalletConnection();
  const [contentReady, setContentReady] = useState(_prevConnected);
  const [beachFading, setBeachFading] = useState(_prevConnected);
  const wasReconnecting = React.useRef(_prevConnected);
  useEffect(() => {
    if (status === "reconnecting") { wasReconnecting.current = true; }
    if (status === "connected" && wasReconnecting.current) { wasReconnecting.current = false; setContentReady(true); }
    if (status === "disconnected") { wasReconnecting.current = false; setContentReady(false); setBeachFading(false); }
  }, [status]);
  useEffect(() => {
    if (contentReady) setBeachFading(true);
    else setBeachFading(false);
  }, [contentReady]);

  const tabs: { id: Tab; ru: string; en: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: "roster", ru: "Мои Яйца", en: "My Eggs", icon: Wallet },
    { id: "marketplace", ru: "Магазин Яиц", en: "Egg Market", icon: Store },
    { id: "tournament", ru: "Взвешивание", en: "Weigh-in", icon: TrendingUp },
    { id: "rankings", ru: "Топ Тяжеловесов", en: "Top Heavyweights", icon: Trophy },
    { id: "admin", ru: "Админ", en: "Admin", icon: Shield, adminOnly: true },
  ];

  const stepsRu = [
    { icon: "🥚", title: "Яиц можно почесать", desc: "Купи яйцо и получи случайный криптоактив: Bitcoin, Ethereum, Solana и другие монеты." },
    { icon: "🔮", title: "Объединяй яйца", desc: "5 одинаковых яиц одного тира превращаются в 1 яйцо следующего уровня: Малое → Среднее → Тяжелое → Супер тяжелое." },
    { icon: "💼", title: "Собери портфель", desc: "Выбери 5 карточек на день. Лига зависит от редкости твоего состава: Bronze, Silver или Gold." },
    { icon: "📈", title: "Зарабатывай очки", desc: "Очки начисляются по реальным движениям рынка. Лучшие игроки получают призы в ETH." },
  ];
  const stepsEn = [
    { icon: "🥚", title: "Scratch an egg", desc: "Buy an egg and get a random crypto asset: Bitcoin, Ethereum, Solana and more." },
    { icon: "🔮", title: "Merge eggs", desc: "5 identical eggs of one tier become 1 egg of the next tier: Small → Heavy → Big → Super Heavy." },
    { icon: "💼", title: "Build portfolio", desc: "Pick 5 cards for the day. Your league depends on rarity: Bronze, Silver or Gold." },
    { icon: "📈", title: "Earn prizes", desc: "Points come from real market moves. Top players earn ETH prizes." },
  ];
  const steps = lang === "ru" ? stepsRu : stepsEn;

  async function submitFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackStatus("sending");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText, name: feedbackName, rating: feedbackRating || null }),
      });
      setFeedbackStatus(r.ok ? "done" : "error");
    } catch {
      setFeedbackStatus("error");
    }
  }

  function closeFeedback() {
    setFeedbackOpen(false);
    setFeedbackText("");
    setFeedbackName("");
    setFeedbackRating(0);
    setFeedbackStatus("idle");
  }

  const startTour = () => {
    setMechanicsOpen(false);
    setActiveTab("roster");
    setTourDemoMode(true);
    setTourActive(true);
  };

  const finishTour = () => {
    setTourActive(false);
    setTourDemoMode(false);
    try { localStorage.setItem("cd_tour_seen", "1"); } catch {}
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cd_theme");
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
        return;
      }
      if (!stored && window.matchMedia && !window.matchMedia("(prefers-color-scheme: dark)").matches) {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:#F4EFE2;pointer-events:none;opacity:0;transition:opacity 0.35s ease";
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";
          setTimeout(() => {
            setTheme("light");
            setTimeout(() => {
              overlay.style.opacity = "0";
              setTimeout(() => overlay.remove(), 350);
            }, 50);
          }, 300);
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("active_tab") as Tab | null;
      const valid: Tab[] = ["roster", "marketplace", "tournament", "rankings", "admin"];
      if (saved && valid.includes(saved)) queueMicrotask(() => setActiveTab(saved));
    } catch {}
    try {
      const y = parseInt(localStorage.getItem("scroll_y") ?? "0", 10);
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch {}
    const onScroll = () => { try { localStorage.setItem("scroll_y", String(window.scrollY)); } catch {} };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = TICKER_IDS.map(([id]) => id).join(",");
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
      .then(r => r.json())
      .then((data: Record<string, { usd: number; usd_24h_change: number }>) => {
        const items = TICKER_IDS.map(([id, symbol]) => {
          const d = data[id];
          if (!d) return TICKER_DEFAULT.find(t => t.symbol === symbol) ?? TICKER_DEFAULT[0];
          const price = d.usd >= 1000
            ? "$" + d.usd.toLocaleString("en-US", { maximumFractionDigits: 0 })
            : "$" + d.usd.toLocaleString("en-US", { maximumFractionDigits: 2 });
          const ch = d.usd_24h_change;
          const change = (ch >= 0 ? "+" : "") + ch.toFixed(2) + "%";
          return { symbol, price, change };
        });
        setTickerItems(items);
      })
      .catch(() => {});
  }, []);

  const prevIsAdmin = React.useRef(isAdmin);
  useEffect(() => {
    const prev = prevIsAdmin.current;
    prevIsAdmin.current = isAdmin;
    if (!isAdmin && prev && activeTab === "admin") {
      queueMicrotask(() => setActiveTab("roster"));
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("cd_theme", theme);
      document.cookie = `cd_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <div className="noise min-h-screen" style={{ color: "var(--foreground)" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: "var(--page-gradient)" }} />

      <style>{`
        @keyframes sky-drift {
          from { transform: translateX(-300px); }
          to   { transform: translateX(calc(100vw + 300px)); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>

      {/* Дневное небо */}
      <div aria-hidden className="sky-day pointer-events-none fixed inset-0 z-[1] overflow-hidden">
          <div style={{ position: "absolute", top: "16%", animation: "sky-drift 195s linear infinite", animationDelay: "-30s" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%, #FFF176, #FFD600)", boxShadow: "0 0 40px 14px rgba(255,214,0,0.45)" }} />
          </div>
          <div style={{ position: "absolute", top: "22%", animation: "sky-drift 135s linear infinite", animationDelay: "-15s" }}>
            <svg width="180" height="80" viewBox="0 0 180 80" fill="white" opacity="0.92">
              <ellipse cx="90" cy="62" rx="82" ry="24" /><ellipse cx="60" cy="48" rx="44" ry="32" /><ellipse cx="105" cy="42" rx="52" ry="36" /><ellipse cx="140" cy="54" rx="36" ry="26" />
            </svg>
          </div>
          <div style={{ position: "absolute", top: "33%", animation: "sky-drift 105s linear infinite", animationDelay: "-60s" }}>
            <svg width="130" height="60" viewBox="0 0 130 60" fill="white" opacity="0.85">
              <ellipse cx="65" cy="46" rx="60" ry="18" /><ellipse cx="42" cy="34" rx="32" ry="24" /><ellipse cx="78" cy="30" rx="38" ry="27" /><ellipse cx="105" cy="40" rx="24" ry="17" />
            </svg>
          </div>
          <div style={{ position: "absolute", top: "46%", animation: "sky-drift 83s linear infinite", animationDelay: "-38s" }}>
            <svg width="100" height="48" viewBox="0 0 100 48" fill="white" opacity="0.78">
              <ellipse cx="50" cy="36" rx="46" ry="15" /><ellipse cx="32" cy="26" rx="26" ry="19" /><ellipse cx="62" cy="22" rx="30" ry="22" /><ellipse cx="82" cy="32" rx="20" ry="14" />
            </svg>
          </div>
          <div style={{ position: "absolute", top: "12%", animation: "sky-drift 165s linear infinite", animationDelay: "-98s" }}>
            <svg width="110" height="50" viewBox="0 0 110 50" fill="white" opacity="0.7">
              <ellipse cx="55" cy="38" rx="50" ry="16" /><ellipse cx="35" cy="28" rx="28" ry="21" /><ellipse cx="68" cy="24" rx="34" ry="24" /><ellipse cx="90" cy="34" rx="20" ry="15" />
            </svg>
          </div>
        </div>

      {/* Ночное небо */}
      <div aria-hidden className="sky-night pointer-events-none fixed inset-0 z-[1] overflow-hidden">
          {/* Луна-полумесяц */}
          <div style={{ position: "absolute", top: "14%", animation: "sky-drift 220s linear infinite", animationDelay: "-50s" }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="#FFD633" />
              <circle cx="44" cy="24" r="24" fill="#05061a" />
            </svg>
          </div>
          {([
            [8,6,1.8,0],[15,18,1.2,2.1],[24,9,2,0.8],[33,4,1.4,3.5],[41,22,1,1.6],
            [50,11,1.6,4.2],[58,7,1.2,0.3],[66,19,2.2,2.8],[74,3,1,1.1],[82,14,1.5,3.9],
            [89,8,1.8,0.7],[95,20,1,2.3],[7,35,1.4,4.8],[19,42,1.2,1.4],[29,30,1.8,3.1],
            [38,50,1,0.6],[47,38,2,2.6],[55,44,1.3,4.1],[63,28,1.6,1.9],[71,55,1,3.3],
            [78,40,1.8,0.4],[85,32,1.2,2.9],[92,48,1.5,1.7],[13,58,1,4.5],[53,60,1.4,3.0],
          ] as [number,number,number,number][]).map(([x, y, r, delay], i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              width: r * 2, height: r * 2,
              borderRadius: "50%",
              background: "white",
              animation: `twinkle ${2.5 + (i % 4) * 0.7}s ease-in-out infinite`,
              animationDelay: `${delay}s`,
            }} />
          ))}
        </div>

      <div aria-hidden className="pointer-events-none fixed left-0 top-20 bottom-0 z-[2] hidden w-[22vw] min-w-[200px] max-w-[340px] lg:block">
        <img
          src="/penguin-left.webp"
          alt=""
          className="absolute left-0 bottom-0 h-full w-auto max-w-none opacity-100"
          style={{ filter: isDark ? "brightness(0.55) saturate(0.6)" : "brightness(0.85) saturate(1)" }}
        />
      </div>
      <div aria-hidden className="pointer-events-none fixed right-0 top-20 bottom-0 z-[2] hidden w-[22vw] min-w-[200px] max-w-[340px] lg:block">
        <img
          src="/fonpepe-right.webp"
          alt=""
          className="absolute right-0 bottom-0 h-full w-auto max-w-none opacity-100"
          style={{ filter: isDark ? "brightness(0.55) saturate(0.6)" : "brightness(0.85) saturate(1)" }}
        />
      </div>

      <header className="sticky top-0 z-20" style={{ borderBottom: contentReady ? "2.5px solid var(--outline)" : "none", background: contentReady ? "var(--header-bg)" : "transparent", opacity: contentReady ? 1 : 0, transform: contentReady ? "none" : "translateY(-16px)", transition: "opacity 500ms ease, transform 500ms ease", pointerEvents: contentReady ? undefined : "none" }}>
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-4 px-6 py-2 lg:px-10">
          {contentReady && <div className="hidden shrink-0 xl:flex items-center gap-2.5">
            <div
              className="grid place-items-center"
              style={{
                width: 40,
                height: 40,
                border: "2.5px solid var(--outline)",
                borderRadius: 12,
                background: "var(--lime-pop)",
                boxShadow: "3px 3px 0 var(--shadow-sticker-color-strong)",
              }}
            >
              <img src="/logo.webp" alt="logo" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
            </div>
            <img src="/brand/name.png" alt="HeavyEggs" style={{ height: 36, width: "auto", objectFit: "contain" }} />
          </div>}

          {contentReady && <div className="flex shrink-0 items-center gap-2.5 xl:hidden">
            <div
              className="grid place-items-center"
              style={{
                width: 40,
                height: 40,
                border: "2.5px solid var(--outline)",
                borderRadius: 12,
                background: "var(--lime-pop)",
                boxShadow: "3px 3px 0 var(--shadow-sticker-color-strong)",
              }}
            >
              <img src="/logo.webp" alt="logo" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
            </div>
            <img src="/brand/name.png" alt="HeavyEggs" style={{ height: 36, width: "auto", objectFit: "contain" }} />
          </div>}

          {contentReady && <div className="mx-auto hidden min-w-0 flex-1 justify-center lg:flex">
            <nav className="flex max-w-full items-center gap-1.5 overflow-x-auto scrollbar-hide" style={{ padding: "2px 8px 8px 2px", marginBottom: -8 }}>
            {tabs.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ id, ru, en, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  id={`tour-tab-${id}`}
                  type="button"
                  onClick={() => { setActiveTab(id); try { localStorage.setItem("active_tab", id); } catch {} }}
                  className="flex shrink-0 items-center gap-1.5 transition-all"
                  style={{
                    padding: "6px 14px", whiteSpace: "nowrap",
                    background: active ? "var(--header-btn-active-bg)" : "var(--header-btn-bg)",
                    color: active ? "var(--ink)" : "var(--ink-2)", border: "2.5px solid var(--outline)", borderRadius: 999,
                    fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                    boxShadow: active ? "var(--filter-btn-shadow-active)" : "var(--filter-btn-shadow)",
                  }}
                >
                  <Icon size={13} strokeWidth={2} />
                  <span>{lang === "ru" ? ru : en}</span>
                </button>
              );
            })}
            </nav>
          </div>}

          {contentReady && <div className="mx-auto flex min-w-0 flex-1 justify-center lg:hidden">
            <nav className="flex max-w-full gap-1.5 overflow-x-auto scrollbar-hide" style={{ padding: "2px 8px 8px 2px", marginBottom: -8 }}>
            {tabs.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ id, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); try { localStorage.setItem("active_tab", id); } catch {} }}
                  className="flex shrink-0 items-center justify-center transition-all"
                  style={{
                    width: 36, height: 36,
                    background: active ? "var(--header-btn-active-bg)" : "var(--header-btn-bg)",
                    color: "var(--ink)", border: "2.5px solid var(--outline)", borderRadius: 999,
                    cursor: "pointer",
                    boxShadow: active ? "var(--filter-btn-shadow-active)" : "var(--filter-btn-shadow)",
                  }}
                >
                  <Icon size={15} strokeWidth={2} />
                </button>
              );
            })}
            </nav>
          </div>}

          <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0" style={{ display: contentReady ? undefined : "none" }}>
            <div id="wallet-cta" className="flex items-center" />
          </div>
        </div>

      </header>

      {(!contentReady || beachFading) && (
        <div style={{ opacity: beachFading ? 0 : 1, transition: "opacity 700ms ease" }}>
          <BeachScene lang={lang} isDark={isDark} />
        </div>
      )}

      <main className="relative z-10 overflow-x-hidden" style={{ background: contentReady ? (isDark ? "rgba(15,17,21,0.70)" : "rgba(250,243,227,0.65)") : "transparent", opacity: contentReady ? 1 : 0, transform: contentReady ? "none" : "translateY(32px)", transition: "opacity 600ms ease 100ms, transform 600ms ease 100ms", pointerEvents: contentReady ? undefined : "none" }}>
        <section id="app" className="container py-6">
          <WalletApp
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onAdminChange={setIsAdmin}
            tourDemoMode={tourDemoMode}
            onStartTour={startTour}
            isDark={isDark}
            theme={theme}
            setTheme={setTheme}
            themeReady={true}
            onEnterApp={() => setContentReady(true)}
          />
        </section>
      </main>

      {contentReady && !fabDismissed && !mechanicsOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {!feedbackBtnDismissed && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFeedbackOpen(true)}
                className="btn-sticker-outline gap-2 px-4 py-2.5 text-sm"
              >
                <span className="text-base">💬</span>
                {lang === "ru" ? "Оставить отзыв" : "Leave a review"}
              </button>
              <button
                onClick={() => setFeedbackBtnDismissed(true)}
                className="btn-sticker-ghost h-8 w-8 p-0"
                aria-label="Dismiss feedback button"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMechanicsOpen(true)}
              className="btn-sticker-secondary gap-2 px-4 py-2.5 text-sm"
            >
              <span className="text-base">❓</span>
              {lang === "ru" ? "Как это работает" : "How it works"}
            </button>
            <button
              onClick={() => setFabDismissed(true)}
              className="btn-sticker-ghost h-8 w-8 p-0"
              aria-label="Close all"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <Modal open={mechanicsOpen} onClose={() => setMechanicsOpen(false)} title={t("nav.how")}>
        <div className="grid gap-6">
          <Card className="p-5">
            <div className="text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{t("how.kicker")}</div>
            <div className="mt-2 text-xl font-black tracking-tight">{t("how.title")}</div>
            <p className="mt-3 text-sm" style={{ color: "var(--panel-text-muted)" }}>{t("how.desc")}</p>
          </Card>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>{lang === "ru" ? "Как играть" : "How to play"}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map((s, i) => (
                <StepCard key={i} num={i + 1} icon={s.icon} title={s.title} desc={s.desc} />
              ))}
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="px-5 py-4" style={{ borderBottom: "2px solid var(--outline)", background: "var(--paper-3)" }}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t("merge.example.title")}</div>
                <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>{t("merge.example.subtitle")}</div>
              </div>
            </div>
            <div className="grid gap-3 p-5">
              <MergeRow from={{ label: "Small (L1)", color: "var(--rarity-common)", count: 5 }} to={{ label: "Heavy (L2)", color: "var(--rarity-rare)", count: 1 }} />
              <MergeRow from={{ label: "Heavy (L2)", color: "var(--rarity-rare)", count: 5 }} to={{ label: "Big (L3)", color: "var(--rarity-epic)", count: 1 }} />
              <MergeRow from={{ label: "Big (L3)", color: "var(--rarity-epic)", count: 5 }} to={{ label: "Super Heavy (L4)", color: "var(--rarity-legendary)", count: 1 }} />
              <div className="rounded-xl p-4 text-xs" style={{ border: "2px solid var(--outline)", background: "var(--sunken)", color: "var(--ink-2)" }}>{t("merge.note")}</div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{t("rarity.kicker")}</div>
              <div className="grid gap-2">
                {[
                  { label: lang === "ru" ? "Малое • L1" : "Small • L1", color: "var(--rarity-common)" },
                  { label: lang === "ru" ? "Тяжелое яйцо • L2" : "Heavy Egg • L2", color: "var(--rarity-rare)" },
                  { label: lang === "ru" ? "Тяжелое • L3" : "Big • L3", color: "var(--rarity-epic)" },
                  { label: lang === "ru" ? "Супер тяжелое • L4" : "Super Heavy • L4", color: "var(--rarity-legendary)" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ border: "2px solid var(--outline)", background: color, color: "var(--ink)" }}>
                    <div className="text-sm font-semibold">{label}</div>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl p-3 text-xs" style={{ border: "2px solid var(--outline)", background: "var(--sunken)", color: "var(--ink-2)" }}>{t("rarity.note")}</div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Инвестиционные лиги" : "Investment leagues"}</div>
              <div className="grid gap-2">
                <div className="flex items-start justify-between rounded-xl px-4 py-3" style={{ border: "2px solid var(--outline)", background: "var(--rarity-common)", color: "var(--ink)" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black">Bronze</div>
                      <div className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ border: "1.5px solid var(--outline)", background: "var(--paper-2)", color: "var(--ink)" }}>25%</div>
                    </div>
                    <div className="mt-0.5 text-[10px]" style={{ color: "var(--ink-2)" }}>{lang === "ru" ? "Только Common (T1) во все дни" : "Only Common (T1) on all days"}</div>
                  </div>
                  <span className="text-lg">🥉</span>
                </div>
                <div className="flex items-start justify-between rounded-xl px-4 py-3" style={{ border: "2px solid var(--outline)", background: "var(--sky)", color: "var(--ink)" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black">Silver</div>
                      <div className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ border: "1.5px solid var(--outline)", background: "var(--paper-2)", color: "var(--ink)" }}>35%</div>
                    </div>
                    <div className="mt-0.5 text-[10px]" style={{ color: "var(--ink-2)" }}>{lang === "ru" ? "1–2 Тяжелых яйца (T2) в любой день" : "1–2 Heavy Eggs (T2) on any day"}</div>
                  </div>
                  <span className="text-lg">🥈</span>
                </div>
                <div className="flex items-start justify-between rounded-xl px-4 py-3" style={{ border: "2px solid var(--outline)", background: "var(--mint)", color: "var(--ink)" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black">Gold</div>
                      <div className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ border: "1.5px solid var(--outline)", background: "var(--paper-2)", color: "var(--ink)" }}>40%</div>
                    </div>
                    <div className="mt-0.5 text-[10px]" style={{ color: "var(--ink-2)" }}>{lang === "ru" ? "Тяжелое (T3) в любой день или 3+ Тяжелых за день" : "Big (T3) on any day, or 3+ Heavy on any day"}</div>
                  </div>
                  <span className="text-lg">🥇</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Система начисления очков" : "Scoring system"}</div>
            <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
              {[
                [lang === "ru" ? "Изменение цены" : "Price change", lang === "ru" ? "до ±300 очков" : "up to ±300 pts"],
                [lang === "ru" ? "Объём торгов" : "Trading volume", lang === "ru" ? "до +100 очков" : "up to +100 pts"],
                [lang === "ru" ? "Волатильность" : "Volatility", lang === "ru" ? "до +100 очков" : "up to +100 pts"],
                [lang === "ru" ? "Температура рынка" : "Market temperature", lang === "ru" ? "до +150 очков" : "up to +150 pts"],
                [lang === "ru" ? "Hype-индекс" : "Hype index", lang === "ru" ? "+100 очков" : "+100 pts"],
              ].map(([ev, pts]) => (
                <div key={String(ev)} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ border: "2px solid var(--outline)", background: "var(--paper-3)" }}>
                  <span style={{ color: "var(--ink-2)" }}>{ev}</span>
                  <span className="font-black" style={{ color: "var(--up)" }}>{pts}</span>
                </div>
              ))}
            </div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Множители карточек" : "Card multipliers"}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: lang === "ru" ? "Мал." : "Sm.", mult: "x1.0", bg: "var(--rarity-common)" },
                { label: lang === "ru" ? "Ср."  : "Md.", mult: "x1.4", bg: "var(--rarity-rare)" },
                { label: lang === "ru" ? "Бол." : "Hvy.", mult: "x1.9", bg: "var(--rarity-epic)" },
                { label: lang === "ru" ? "Тяж." : "S.H.", mult: "x2.5", bg: "var(--rarity-legendary)" },
              ].map(({ label, mult, bg }) => (
                <div key={label} className="rounded-lg px-2 py-2 text-center" style={{ border: "2px solid var(--outline)", background: bg, color: "var(--ink)" }}>
                  <div className="text-[10px] font-semibold">{label}</div>
                  <div className="mt-0.5 text-sm font-black">{mult}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Технология" : "Technology"}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: "⚡", title: lang === "ru" ? "Быстрые транзакции" : "Fast transactions", desc: "Movement Mainnet-ready stack" },
                { icon: "🔒", title: lang === "ru" ? "NFT-объекты" : "NFT objects", desc: "aptos_token_objects" },
                { icon: "💎", title: "ETH", desc: lang === "ru" ? "Призы в ETH" : "ETH prizes" },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="rounded-xl border p-3" style={{ borderColor: "var(--soft-border)", background: "var(--soft-surface)" }}>
                  <div className="mb-1.5 text-xl">{icon}</div>
                  <div className="mb-0.5 text-xs font-black" style={{ color: "var(--panel-text)" }}>{title}</div>
                  <div className="text-[10px]" style={{ color: "var(--panel-text-muted)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </Card>

          <button
            type="button"
            onClick={startTour}
            className="btn-sticker-primary w-full gap-2 py-3 text-sm"
          >
            <span>🗺</span>
            {lang === "ru" ? "Пройти обучающий тур" : "Take the guided tour"}
          </button>
        </div>
      </Modal>

      <TourOverlay active={tourActive} onFinish={finishTour} lang={lang} setActiveTab={setActiveTab} setDemoMode={setTourDemoMode} />


      <Modal open={feedbackOpen} onClose={closeFeedback} title={lang === "ru" ? "Оставить отзыв" : "Leave a review"}>
        {feedbackStatus === "done" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-4xl">🙏</div>
            <div className="text-base font-black" style={{ color: "var(--panel-text)" }}>{lang === "ru" ? "Спасибо за отзыв!" : "Thanks for your feedback!"}</div>
            <button onClick={closeFeedback} className="btn-sticker-primary px-6 py-2.5 text-sm">
              {lang === "ru" ? "Закрыть" : "Close"}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <div className="mb-2 text-xs font-semibold" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Оценка" : "Rating"}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setFeedbackRating(s)} className="text-2xl transition-transform hover:scale-110" style={{ color: s <= feedbackRating ? "var(--warn)" : "var(--ink-3)" }}>
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Имя (необязательно)" : "Name (optional)"}</div>
              <input
                type="text"
                maxLength={50}
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                placeholder={lang === "ru" ? "Ваше имя..." : "Your name..."}
                className="input-sticker w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Отзыв" : "Feedback"}</div>
              <textarea
                rows={4}
                maxLength={1000}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={lang === "ru" ? "Что понравилось? Что улучшить?" : "What did you like? What can we improve?"}
                className="input-sticker w-full resize-none px-3 py-2 text-sm"
              />
              <div className="mt-0.5 text-right text-[10px]" style={{ color: "var(--panel-text-muted)" }}>{feedbackText.length}/1000</div>
            </div>
            {feedbackStatus === "error" && (
              <div className="text-xs font-semibold" style={{ color: "var(--down)" }}>{lang === "ru" ? "Ошибка отправки. Попробуйте ещё раз." : "Send error. Please try again."}</div>
            )}
            <button
              onClick={submitFeedback}
              disabled={feedbackStatus === "sending" || !feedbackText.trim()}
              className="btn-sticker-primary w-full py-3 text-sm"
            >
              {feedbackStatus === "sending" ? "…" : (lang === "ru" ? "Отправить" : "Submit")}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
