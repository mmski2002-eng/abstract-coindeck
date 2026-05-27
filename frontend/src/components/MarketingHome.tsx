"use client";

import { WalletApp } from "@/components/WalletApp";
import { useI18n } from "@/components/LanguageProvider";
import { Modal, Card } from "@/components/ui";
import { TourOverlay } from "@/components/TourOverlay";
import React, { useEffect, useState } from "react";
import { Moon, Shield, Store, Sun, TrendingUp, Trophy, Wallet } from "lucide-react";

type Tab = "roster" | "marketplace" | "tournament" | "rankings" | "admin";
type Theme = "light" | "dark";

const TICKER_ITEMS = [
  { symbol: "BTC", price: "$109,482", change: "+2.41%" },
  { symbol: "ETH", price: "$5,864", change: "+1.18%" },
  { symbol: "SOL", price: "$214.77", change: "-0.62%" },
  { symbol: "BNB", price: "$1,024.55", change: "+0.93%" },
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
    { icon: "📈", title: "Зарабатывай очки", desc: "Очки начисляются по реальным движениям рынка. Лучшие игроки получают призы в ABS." },
  ];
  const stepsEn = [
    { icon: "🎁", title: "Open chests", desc: "Buy a chest and get a random crypto asset card: Bitcoin, Ethereum, Solana and more." },
    { icon: "🔮", title: "Merge cards", desc: "5 identical cards of one tier become 1 card of the next tier: Common → Rare → Epic → Legendary." },
    { icon: "💼", title: "Build portfolio", desc: "Pick 5 cards for the day. Your league depends on rarity: Bronze, Silver or Gold." },
    { icon: "📈", title: "Earn prizes", desc: "Points come from real market moves. Top players earn ABS prizes." },
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
    if (isAdmin) {
      queueMicrotask(() => setActiveTab("admin"));
    } else if (activeTab === "admin") {
      queueMicrotask(() => setActiveTab("roster"));
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("cd_theme", theme);
    } catch {}
  }, [theme]);

  const isDark = themeReady && theme === "dark";

  return (
    <div className="noise min-h-screen" style={{ color: "var(--foreground)" }}>
      <div aria-hidden className="pointer-events-none fixed left-0 top-20 bottom-0 z-[1] hidden w-[22vw] min-w-[200px] max-w-[340px] lg:block">
        <img
          src="/penguin-left.webp"
          alt=""
          className="absolute left-0 bottom-0 h-full w-auto max-w-none opacity-72"
          style={{ filter: isDark ? "brightness(0.55) saturate(0.6)" : "brightness(0.85) saturate(1)" }}
        />
      </div>
      <div aria-hidden className="pointer-events-none fixed right-0 top-20 bottom-0 z-[1] hidden w-[22vw] min-w-[200px] max-w-[340px] lg:block">
        <img
          src="/fonpepe-right.webp"
          alt=""
          className="absolute right-0 bottom-0 h-full w-auto max-w-none opacity-72"
          style={{ filter: isDark ? "brightness(0.55) saturate(0.6)" : "brightness(0.85) saturate(1)" }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ borderColor: "var(--header-border)", background: "var(--header-bg)" }}>
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-4 px-6 py-2 lg:px-10">
          <div className="hidden shrink-0 xl:flex items-end gap-2.5">
            <div
              className="font-abs-brand relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold"
              style={{ background: "linear-gradient(135deg, #00CFFF, #00FF47)", boxShadow: "0 0 16px rgba(0,207,255,0.25), inset 0 1px 0 rgba(255,255,255,0.3)" }}
            >
              <span className="select-none text-black drop-shadow">CD</span>
            </div>
            <div className="flex flex-col justify-between" style={{ height: "2rem" }}>
              <span className="font-abs-brand text-base leading-none font-bold tracking-[0.08em]" style={{ color: "var(--foreground)" }}>
                COINDECK
              </span>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--header-muted)" }}>
                markets · decks · rewards
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 xl:hidden">
            <div
              className="font-abs-brand relative flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold"
              style={{ background: "linear-gradient(135deg, #00CFFF, #00FF47)", boxShadow: "0 0 16px rgba(0,207,255,0.25), inset 0 1px 0 rgba(255,255,255,0.3)" }}
            >
              <span className="select-none text-black drop-shadow">CD</span>
            </div>
            <span className="font-abs-brand text-base leading-none font-bold tracking-[0.08em]" style={{ color: "var(--foreground)" }}>
              COINDECK
            </span>
          </div>

          <nav className="mx-auto hidden min-w-0 flex-shrink items-center gap-1.5 overflow-x-auto scrollbar-hide lg:flex">
            {tabs.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ id, ru, en, icon: Icon }) => (
              <button
                key={id}
                id={`tour-tab-${id}`}
                type="button"
                onClick={() => { setActiveTab(id); try { localStorage.setItem("active_tab", id); } catch {} }}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 text-xs font-medium uppercase tracking-wide transition-all ${
                  activeTab === id ? "nav-tab-active border" :"text-[var(--header-muted)] hover:bg-[var(--hover-surface)] hover:text-[var(--foreground)]"
                }`}
                style={{}}
              >
                <Icon size={13} strokeWidth={2} />
                <span>{lang === "ru" ? ru : en}</span>
              </button>
            ))}
          </nav>

          <nav className="mx-auto flex gap-1.5 overflow-x-auto scrollbar-hide lg:hidden">
            {tabs.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setActiveTab(id); try { localStorage.setItem("active_tab", id); } catch {} }}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
                  activeTab === id ? "nav-tab-active border" :"text-[var(--header-muted)] hover:bg-[var(--hover-surface)] hover:text-[var(--foreground)]"
                }`}
                style={{}}
              >
                <Icon size={15} strokeWidth={2} />
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0">
            <div id="network-badge" />
            <div className="hidden items-center gap-2 md:flex">
              <span className="inline-flex rounded-xl p-px" style={{ background: "var(--ctrl-border)" }}>
                <a
                  href="https://x.com/CoinDeck"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex h-8 w-8 items-center justify-center rounded-[calc(0.75rem-1px)] transition-all active:scale-95"
                  style={{ background: "var(--ctrl-fill)", boxShadow: "var(--control-shadow)", color: "var(--control-text)" }}
                  aria-label="X (Twitter)"
                >
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><span aria-hidden className="absolute inset-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#00FF66]" /></span>
                  <span className="relative z-10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </span>
                </a>
              </span>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="inline-flex rounded-xl p-px" style={{ background: "var(--ctrl-border)" }}>
                <button
                  type="button"
                  onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                  className="group relative flex h-8 w-8 items-center justify-center rounded-[calc(0.75rem-1px)] transition-all active:scale-95"
                  style={{ background: "var(--ctrl-fill)", boxShadow: "var(--control-shadow)", color: "var(--control-text)" }}
                  aria-label={lang === "ru" ? "Переключить тему" : "Toggle theme"}
                >
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><span aria-hidden className="absolute inset-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#00FF66]" /></span>
                  <span className="relative z-10 flex items-center justify-center">
                    {themeReady && isDark ? <Moon size={15} /> : <Sun size={15} />}
                  </span>
                </button>
              </span>

              <div className="relative" ref={langRef}>
              <span className="inline-flex rounded-xl p-px" style={{ background: "var(--ctrl-border)" }}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="group relative flex items-center gap-1.5 rounded-[calc(0.75rem-1px)] px-3 py-1.5 transition-all active:scale-95"
                style={{
                  background: "var(--ctrl-fill)",
                  boxShadow: langOpen ? "var(--control-shadow-active)" : "var(--control-shadow)",
                  color: "var(--control-text)",
                }}
                aria-label="Switch language"
              >
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><span aria-hidden className="absolute inset-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#00FF66]" /></span>
                <span className="relative z-10 flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {lang}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="transition-transform duration-200" style={{ transform: langOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              </span>

              {langOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl"
                  style={{
                    background: "var(--control-bg)",
                    border: "1px solid transparent",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.16), var(--control-shadow)",
                  }}
                >
                  {([
                    { code: "ru", label: "Русский", flag: "🇷🇺" },
                    { code: "en", label: "English", flag: "🇺🇸" },
                  ] as const).map(({ code, label, flag }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { setLang(code); setLangOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-all hover:bg-white/6"
                      style={{
                        color: lang === code ? "#00FF66" : "var(--control-text)",
                        background: lang === code ? "rgba(0,255,102,0.08)" : undefined,
                      }}
                    >
                      <span className="text-base leading-none">{flag}</span>
                      <span className="font-medium">{label}</span>
                      {lang === code && (
                        <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#00FF66" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>
            <div id="wallet-cta" />
          </div>
        </div>

      </header>

      <div className="sticky top-16 z-[15] overflow-hidden border-b" style={{ borderColor: "var(--header-border)", background: "var(--ticker-bg)" }}>
        <div className="ticker-marquee flex min-w-max items-center gap-4 px-6 py-1.5">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => {
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
                { label: "Common", mult: "x1.0", color: "text-zinc-400", bg: "bg-zinc-800/40 border-zinc-600/30" },
                { label: "Rare", mult: "x1.4", color: "text-blue-300", bg: "bg-blue-900/20 border-blue-500/20" },
                { label: "Epic", mult: "x1.9", color: "text-purple-300", bg: "bg-purple-900/20 border-purple-500/20" },
                { label: "Leg.", mult: "x2.5", color: "text-amber-300", bg: "bg-amber-900/20 border-amber-500/20" },
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
                { icon: "💎", title: lang === "ru" ? "ABS токен" : "ABS token", desc: lang === "ru" ? "Призы в нативном токене" : "Native token prizes" },
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
