"use client";

import { WalletApp } from "@/components/WalletApp";
import { useI18n } from "@/components/LanguageProvider";
import { Modal, Card } from "@/components/ui";
import { TourOverlay } from "@/components/TourOverlay";
import React, { useEffect, useState } from "react";
import { Moon, Shield, Store, Sun, TrendingUp, Trophy, Wallet } from "lucide-react";

type Tab = "roster" | "marketplace" | "tournament" | "rankings" | "admin";
type Theme = "light" | "dark";

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
    <div className="grid items-center gap-3 rounded-2xl p-4 md:grid-cols-[1fr_auto_1fr]" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: from.color }} />
          <div className="text-sm font-semibold" style={{ color: "var(--panel-text)" }}>{from.label}</div>
        </div>
        <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>x{from.count}</div>
      </div>
      <div className="mx-auto flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--panel-text-muted)" }}>
        <span className="rounded-full px-3 py-1" style={{ background: "var(--panel-pill-bg)", boxShadow: "inset 0 0 0 1px var(--panel-pill-border)" }}>MERGE</span>
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
    <div className="relative rounded-2xl p-5 shadow-[0_10px_24px_rgba(22,24,29,0.05)]" style={{ border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }}>
      <div className="absolute -top-3 -left-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white shadow" style={{ background: "var(--panel-text)" }}>
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
  const [langOpen, setLangOpen] = useState(false);
  const [tickerItems, setTickerItems] = useState(TICKER_DEFAULT);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const current = document.documentElement.dataset.theme;
    return current === "dark" || current === "light" ? current : "light";
  });
  const themeReady = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const langRef = React.useRef<HTMLDivElement>(null);

  const tabs: { id: Tab; ru: string; en: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: "roster", ru: "Портфель", en: "Portfolio", icon: Wallet },
    { id: "marketplace", ru: "Маркетплейс", en: "Marketplace", icon: Store },
    { id: "tournament", ru: "Инвестирование", en: "Investing", icon: TrendingUp },
    { id: "rankings", ru: "Лидерборд", en: "Leaderboard", icon: Trophy },
    { id: "admin", ru: "Админ", en: "Admin", icon: Shield, adminOnly: true },
  ];

  const stepsRu = [
    { icon: "🎁", title: "Открой сундуки", desc: "Купи сундук и получи случайную карточку криптоактива: Bitcoin, Ethereum, Solana и других монет." },
    { icon: "🔮", title: "Объединяй карты", desc: "5 одинаковых карточек одного тира превращаются в 1 карту следующего уровня: Common → Rare → Epic → Legendary." },
    { icon: "💼", title: "Собери портфель", desc: "Выбери 5 карточек на день. Лига зависит от редкости твоего состава: Bronze, Silver или Gold." },
    { icon: "📈", title: "Зарабатывай очки", desc: "Очки начисляются по реальным движениям рынка. Лучшие игроки получают призы в ETH." },
  ];
  const stepsEn = [
    { icon: "🎁", title: "Open chests", desc: "Buy a chest and get a random crypto asset card: Bitcoin, Ethereum, Solana and more." },
    { icon: "🔮", title: "Merge cards", desc: "5 identical cards of one tier become 1 card of the next tier: Common → Rare → Epic → Legendary." },
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

  useEffect(() => {
    if (!langOpen) return;
    function onOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [langOpen]);

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
      const saved = localStorage.getItem("active_tab") as Tab | null;
      const valid: Tab[] = ["roster", "marketplace", "tournament", "rankings"];
      if (saved && valid.includes(saved)) queueMicrotask(() => setActiveTab(saved));
    } catch {}
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

  const isDark = themeReady && theme === "dark";

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

      <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ borderColor: "var(--header-border)", background: "var(--header-bg)" }}>
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-4 px-6 py-2 lg:px-10">
          <div className="hidden shrink-0 xl:flex items-center gap-2.5">
            <div
            >
              <img src="/logo.webp" alt="logo" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
            </div>
            <span
              className="leading-none select-none"
              style={{
                fontFamily: "var(--font-titan-one)",
                fontSize: "2rem",
                fontWeight: 900,
                color: "#000000",
              }}
            >
              HEAVYEGGS
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 xl:hidden">
            <div
            >
              <img src="/logo.webp" alt="logo" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
            </div>
            <span
              className="leading-none select-none"
              style={{
                fontFamily: "var(--font-titan-one)",
                fontSize: "2rem",
                fontWeight: 900,
                color: "#000000",
              }}
            >
              HEAVYEGGS
            </span>
          </div>

          <nav className="mx-auto hidden min-w-0 flex-shrink items-center gap-1.5 overflow-x-auto scrollbar-hide lg:flex" style={{ paddingBottom: 6, marginBottom: -6 }}>
            {tabs.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ id, ru, en, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  id={`tour-tab-${id}`}
                  type="button"
                  onClick={() => { setActiveTab(id); try { localStorage.setItem("active_tab", id); } catch {} }}
                  className="flex items-center gap-1.5 transition-all"
                  style={{
                    padding: "6px 14px", whiteSpace: "nowrap",
                    background: active ? "var(--mint)" : "var(--paper-3)",
                    color: "var(--header-btn-color)", border: "2.5px solid var(--ink)", borderRadius: 999,
                    fontSize: 11, letterSpacing: 1.4, fontWeight: 800, cursor: "pointer",
                    boxShadow: active ? "4px 4px 0 var(--card-shadow)" : "2px 2px 0 var(--card-shadow)",
                  }}
                >
                  <Icon size={13} strokeWidth={2} />
                  <span>{lang === "ru" ? ru : en}</span>
                </button>
              );
            })}
          </nav>

          <nav className="mx-auto flex gap-1.5 overflow-x-auto scrollbar-hide lg:hidden" style={{ paddingBottom: 6, marginBottom: -6 }}>
            {tabs.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ id, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); try { localStorage.setItem("active_tab", id); } catch {} }}
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: 36, height: 36,
                    background: active ? "var(--mint)" : "var(--paper-3)",
                    color: "var(--ink)", border: "2.5px solid var(--ink)", borderRadius: 999,
                    cursor: "pointer",
                    boxShadow: active ? "4px 4px 0 var(--card-shadow)" : "2px 2px 0 var(--card-shadow)",
                  }}
                >
                  <Icon size={15} strokeWidth={2} />
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0">
            <div id="network-badge" />
            <div className="hidden items-center gap-2 md:flex">
              <a
                href="https://x.com/CoinDeck"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-sticker-outline h-9 w-9 p-0"
                aria-label="X (Twitter)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className="btn-sticker-outline h-9 w-9 p-0"
                aria-label={lang === "ru" ? "Переключить тему" : "Toggle theme"}
              >
                {themeReady && isDark ? <Moon size={15} /> : <Sun size={15} />}
              </button>

              <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="btn-sticker-outline flex items-center gap-1.5 px-3 py-2"
                aria-label="Switch language"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest">{lang}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50 transition-transform duration-200" style={{ transform: langOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {langOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-3 w-40"
                  style={{
                    background: "var(--paper-2)",
                    border: "2.5px solid var(--ink)",
                    borderRadius: 14,
                    boxShadow: "4px 4px 0 var(--ink)",
                  }}
                >
                  {([
                    { code: "ru", label: "Русский", flag: "🇷🇺" },
                    { code: "en", label: "English", flag: "🇺🇸" },
                  ] as const).map(({ code, label, flag }, i, arr) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { setLang(code); setLangOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-bold transition-colors"
                      style={{
                        color: lang === code ? "var(--ink)" : "var(--ink-2)",
                        background: lang === code ? "var(--mint-soft)" : "transparent",
                        borderBottom: i < arr.length - 1 ? "1.5px solid rgba(15,17,21,0.12)" : "none",
                        borderRadius: i === 0 ? "11px 11px 0 0" : i === arr.length - 1 ? "0 0 11px 11px" : 0,
                      }}
                      onMouseEnter={e => { if (lang !== code) e.currentTarget.style.background = "var(--sky-soft)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = lang === code ? "var(--mint-soft)" : "transparent"; }}
                    >
                      <span className="text-base leading-none">{flag}</span>
                      <span>{label}</span>
                      {lang === code && (
                        <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="var(--mint-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>
            <div id="wallet-cta" className="flex items-center" />
          </div>
        </div>

      </header>

      <div className="sticky top-16 z-[15] overflow-hidden border-b" style={{ borderColor: "var(--header-border)", background: "var(--ticker-bg)" }}>
        <div className="ticker-marquee flex min-w-max items-center gap-4 px-6 py-1.5">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => {
            const positive = item.change.startsWith("+");
            return (
              <div key={`${item.symbol}-${idx}`} className="flex items-center gap-3 rounded-full px-4 py-1.5" style={{ border: "1px solid var(--ticker-pill-border)", background: "var(--ticker-pill-bg)" }}>
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--ticker-symbol)" }}>{item.symbol}</span>
                <span className="font-display text-sm font-semibold" style={{ color: "var(--panel-text)" }}>{item.price}</span>
                <span className={`text-xs font-black ${positive ? "text-emerald-400" : "text-red-400"}`}>{item.change}</span>
              </div>
            );
          })}
        </div>
      </div>

      <main className="relative z-10 overflow-x-hidden">
        <section id="app" className="container py-6">
          <WalletApp
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onAdminChange={setIsAdmin}
            tourDemoMode={tourDemoMode}
            onStartTour={startTour}
          />
        </section>
      </main>

      {!fabDismissed && !mechanicsOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {!feedbackBtnDismissed && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFeedbackOpen(true)}
                className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur transition"
                style={{ border: "1px solid var(--floating-border)", background: "var(--floating-bg)", color: "var(--floating-text)" }}
              >
                <span className="text-base">💬</span>
                {lang === "ru" ? "Оставить отзыв" : "Leave a review"}
              </button>
              <button
                onClick={() => setFeedbackBtnDismissed(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full shadow-xl backdrop-blur transition"
                style={{ border: "1px solid var(--floating-border)", background: "var(--floating-bg)", color: "var(--floating-muted)" }}
                aria-label="Dismiss feedback button"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMechanicsOpen(true)}
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur transition"
              style={{ border: "1px solid var(--floating-border)", background: "var(--floating-bg)", color: "var(--floating-text)" }}
            >
              <span className="text-base">❓</span>
              {lang === "ru" ? "Как это работает" : "How it works"}
            </button>
            <button
              onClick={() => setFabDismissed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full shadow-xl backdrop-blur transition"
              style={{ border: "1px solid var(--floating-border)", background: "var(--floating-bg)", color: "var(--floating-muted)" }}
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
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{lang === "ru" ? "Как играть" : "How to play"}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map((s, i) => (
                <StepCard key={i} num={i + 1} icon={s.icon} title={s.title} desc={s.desc} />
              ))}
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--panel-border)", background: "var(--soft-surface)" }}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t("merge.example.title")}</div>
                <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>{t("merge.example.subtitle")}</div>
              </div>
            </div>
            <div className="grid gap-3 p-5">
              <MergeRow from={{ label: "Common (L1)", color: "var(--rarity-common)", count: 5 }} to={{ label: "Rare (L2)", color: "var(--rarity-rare)", count: 1 }} />
              <MergeRow from={{ label: "Rare (L2)", color: "var(--rarity-rare)", count: 5 }} to={{ label: "Epic (L3)", color: "var(--rarity-epic)", count: 1 }} />
              <MergeRow from={{ label: "Epic (L3)", color: "var(--rarity-epic)", count: 5 }} to={{ label: "Legendary (L4)", color: "var(--rarity-legendary)", count: 1 }} />
              <div className="rounded-xl border p-4 text-xs" style={{ borderColor: "var(--soft-border)", background: "var(--soft-surface-2)", color: "var(--panel-text-muted)" }}>{t("merge.note")}</div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{t("rarity.kicker")}</div>
              <div className="grid gap-2">
                {[
                  { label: "Common • L1", color: "var(--rarity-common)", cls: "border-zinc-500/30 bg-zinc-800/30 text-zinc-300" },
                  { label: "Rare • L2", color: "var(--rarity-rare)", cls: "border-blue-500/30 bg-blue-900/20 text-blue-300" },
                  { label: "Epic • L3", color: "var(--rarity-epic)", cls: "border-purple-500/30 bg-purple-900/20 text-purple-300" },
                  { label: "Legendary • L4", color: "var(--rarity-legendary)", cls: "border-amber-500/30 bg-amber-900/20 text-amber-300" },
                ].map(({ label, color, cls }) => (
                  <div key={label} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${cls}`}>
                    <div className="text-sm font-semibold">{label}</div>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--soft-border)", background: "var(--soft-surface)", color: "var(--panel-text-muted)" }}>{t("rarity.note")}</div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Инвестиционные лиги" : "Investment leagues"}</div>
              <div className="grid gap-2">
                <div className="flex items-start justify-between rounded-xl border border-zinc-500/30 bg-zinc-800/30 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black text-zinc-300">Bronze</div>
                      <div className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">25%</div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">{lang === "ru" ? "Только Common (T1) во все дни" : "Only Common (T1) on all days"}</div>
                  </div>
                  <span className="text-lg">🥉</span>
                </div>
                <div className="flex items-start justify-between rounded-xl border border-zinc-400/30 bg-zinc-700/20 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black text-zinc-200">Silver</div>
                      <div className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">35%</div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-400/70">{lang === "ru" ? "1–2 карты Rare (T2) в любой день" : "1–2 Rare (T2) cards on any day"}</div>
                  </div>
                  <span className="text-lg">🥈</span>
                </div>
                <div className="flex items-start justify-between rounded-xl border border-violet-500/30 bg-violet-900/20 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black text-violet-300">Gold</div>
                      <div className="rounded bg-violet-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">40%</div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-violet-300/60">{lang === "ru" ? "Epic (T3) в любой день или 3+ Rare за день" : "Epic (T3) on any day, or 3+ Rare on any day"}</div>
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
                <div key={String(ev)} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
                  <span className="text-zinc-400">{ev}</span>
                  <span className="font-black text-emerald-400">{pts}</span>
                </div>
              ))}
            </div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Множители карточек" : "Card multipliers"}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: lang === "ru" ? "Мал." : "Sm.", mult: "x1.0", color: "text-zinc-400", bg: "bg-zinc-800/40 border-zinc-600/30" },
                { label: lang === "ru" ? "Ср."  : "Md.", mult: "x1.4", color: "text-blue-300", bg: "bg-blue-900/20 border-blue-500/20" },
                { label: lang === "ru" ? "Бол." : "Hvy.", mult: "x1.9", color: "text-purple-300", bg: "bg-purple-900/20 border-purple-500/20" },
                { label: lang === "ru" ? "Тяж." : "S.H.", mult: "x2.5", color: "text-amber-300", bg: "bg-amber-900/20 border-amber-500/20" },
              ].map(({ label, mult, color, bg }) => (
                <div key={label} className={`rounded-lg border px-2 py-2 text-center ${bg}`}>
                  <div className={`text-[10px] font-semibold ${color}`}>{label}</div>
                  <div className={`mt-0.5 text-sm font-black ${color}`}>{mult}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Технология" : "Technology"}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: "⚡", title: lang === "ru" ? "Быстрые транзакции" : "Fast transactions", desc: "Abstract Mainnet-ready stack" },
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-black transition hover:brightness-110 active:brightness-95"
            style={{ background: "linear-gradient(90deg, #00F0FF, #B026FF)" }}
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
            <button onClick={closeFeedback} className="rounded-2xl px-6 py-2.5 text-sm font-black text-black" style={{ background: "linear-gradient(90deg,#00F0FF,#B026FF)" }}>
              {lang === "ru" ? "Закрыть" : "Close"}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <div className="mb-2 text-xs font-semibold" style={{ color: "var(--panel-text-muted)" }}>{lang === "ru" ? "Оценка" : "Rating"}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setFeedbackRating(s)} className={`text-2xl transition-transform hover:scale-110 ${s <= feedbackRating ? "text-amber-400" : "text-white/20"}`}>
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
                className="themed-input w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", boxShadow: "inset 0 0 0 1px transparent" }}
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
                className="themed-input w-full resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)" }}
              />
              <div className="mt-0.5 text-right text-[10px]" style={{ color: "var(--panel-text-muted)" }}>{feedbackText.length}/1000</div>
            </div>
            {feedbackStatus === "error" && (
              <div className="text-xs text-red-400">{lang === "ru" ? "Ошибка отправки. Попробуйте ещё раз." : "Send error. Please try again."}</div>
            )}
            <button
              onClick={submitFeedback}
              disabled={feedbackStatus === "sending" || !feedbackText.trim()}
              className="w-full rounded-2xl py-3 text-sm font-black text-black transition hover:brightness-110 disabled:opacity-40"
              style={{ background: "linear-gradient(90deg,#00F0FF,#B026FF)" }}
            >
              {feedbackStatus === "sending" ? "…" : (lang === "ru" ? "Отправить" : "Submit")}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
