"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Tab } from "@/components/wallet/types";

type TourStep = {
  target: string;
  tab: Tab;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  demo?: boolean;
};

const STEPS: TourStep[] = [
  {
    target: "[data-tour='roster-info']",
    tab: "roster",
    titleRu: "Ростер: обзор",
    titleEn: "Wallet: overview",
    descRu: "Это твой кошелек — место, где собирается коллекция карточек. Здесь видно баланс сундуков, карточки, редкость и всё, что понадобится для участия в инвестиционных днях.",
    descEn: "This is your wallet — the place where your card collection comes together. You can see chest balances, cards, rarity, and everything you need for investment days.",
  },
  {
    target: "[data-tour='roster-chests']",
    tab: "roster",
    titleRu: "Сундуки",
    titleEn: "Chests",
    descRu: "Из сундуков выпадают новые карточки криптовалют. Чем выше тип сундука, тем выше шанс получить редкую карту. Покупай, открывай и усиливай коллекцию.",
    descEn: "Chests drop new crypto cards. The higher the chest type, the better the chance of a rare card. Buy, open, and strengthen your collection.",
  },
  {
    target: "[data-tour='roster-cards']",
    tab: "roster",
    titleRu: "Мои карточки",
    titleEn: "My cards",
    descRu: "Карточки отличаются редкостью: Common, Rare, Epic и Legendary. Редкие карточки дают больший множитель очков. Пять одинаковых карточек можно слить в одну карту следующего уровня, а недостающие карты можно искать на маркетплейсе.",
    descEn: "Cards have rarity tiers: Common, Rare, Epic, and Legendary. Rarer cards multiply your score. Merge five identical cards into the next tier, or find missing cards on the marketplace.",
    demo: true,
  },
  {
    target: "[data-tour='market-filters']",
    tab: "marketplace",
    titleRu: "Маркетплейс: фильтры",
    titleEn: "Marketplace: filters",
    descRu: "Фильтры помогают быстро найти нужную карточку: по редкости, категории и названию монеты. Это удобно, когда ты добираешь карту для слияния или собираешь конкретный портфель.",
    descEn: "Filters help you quickly find the right card by rarity, category, or coin name. They are useful when you need one more card for a merge or a specific portfolio.",
  },
  {
    target: "[data-tour='market-cards']",
    tab: "marketplace",
    titleRu: "Маркетплейс: карточки",
    titleEn: "Marketplace: cards",
    descRu: "На маркетплейсе игроки продают карточки друг другу. Смотри цену, редкость и монету, сравнивай варианты и покупай то, что усиливает твою стратегию.",
    descEn: "Players sell cards to each other here. Check price, rarity, and coin, compare options, and buy what strengthens your strategy.",
    demo: true,
  },
  {
    target: "[data-tour='invest-portfolio']",
    tab: "tournament",
    titleRu: "Инвестирование: портфель",
    titleEn: "Investing: portfolio",
    descRu: "Здесь выставляется дневной портфель. Выбери 5 карточек монет, которые, по твоему мнению, покажут лучший результат. После отправки портфель участвует в расчёте очков за торговый день. Будь внимателен: заменить состав может быть только платно.",
    descEn: "This is where you submit your daily portfolio. Pick 5 coin cards you think will perform best. After submission, the portfolio scores for the trading day. Be careful: changing it can require a paid replacement.",
    demo: true,
  },
  {
    target: "[data-tour='invest-coins']",
    tab: "tournament",
    titleRu: "Инвестирование: монеты",
    titleEn: "Investing: coins",
    descRu: "Очки считаются по рыночным критериям: движение цены, объём торгов, волатильность, температура рынка и интерес игроков. Карточка — это не просто NFT, а ставка на реальную динамику монеты.",
    descEn: "Scores use market criteria: price movement, trading volume, volatility, market temperature, and player interest. A card is not just an NFT, it is a bet on real coin dynamics.",
    demo: true,
  },
  {
    target: "[data-tour='rankings-info']",
    tab: "rankings",
    titleRu: "Лидерборд: инфотабло",
    titleEn: "Leaderboard: dashboard",
    descRu: "Информационное табло показывает состояние турнира: неделю, день, призовой фонд и твой текущий рейтинг. Сюда стоит заглядывать, чтобы понимать прогресс раунда.",
    descEn: "The dashboard shows tournament state: week, day, prize pool, and your current rank. Check it to understand the round's progress.",
  },
  {
    target: "[data-tour='rankings-table']",
    tab: "rankings",
    titleRu: "Лидерборд: лиги",
    titleEn: "Leaderboard: leagues",
    descRu: "Лидерборд разделён на лиги. Лига зависит от силы и редкости выставленных карточек, поэтому новички соревнуются с сопоставимыми портфелями, а сильные коллекции играют в более высоких лигах.",
    descEn: "The leaderboard is split into leagues. Your league depends on portfolio strength and rarity, so newcomers compete with comparable portfolios while stronger collections move higher.",
    demo: true,
  },
  {
    target: "[data-tour='tour-finish']",
    tab: "roster",
    titleRu: "Удачи!",
    titleEn: "Good luck!",
    descRu: "Готово. Теперь у тебя есть аккаунт, ростер и понимание основ. Открывай сундуки, усиливай карточки, собирай портфель и пробуй обойти рынок. Удачи, инвестор.",
    descEn: "Done. You have an account, a wallet, and the basics. Open chests, upgrade cards, build portfolios, and try to beat the market. Good luck, investor.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 10;
const VIEWPORT_TOP_OFFSET = 96;
const TOOLTIP_INSET = 14;

export function TourOverlay({
  active,
  onFinish,
  lang,
  setActiveTab,
  setDemoMode,
}: {
  active: boolean;
  onFinish: () => void;
  lang: "ru" | "en";
  setActiveTab: (tab: Tab) => void;
  setDemoMode: (active: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const current = STEPS[step];
  const total = STEPS.length;

  const findTarget = useCallback(() => {
    if (!current) return null;
    return document.querySelector(current.target) as HTMLElement | null;
  }, [current]);

  const updateRect = useCallback(() => {
    const el = findTarget();
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [findTarget]);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => {
        setStep(0);
        setDemoMode(false);
      });
      return;
    }
    setActiveTab(current.tab);
    setDemoMode(STEPS.some((s) => s.demo));
    const timers = [
      window.setTimeout(updateRect, 90),
      window.setTimeout(() => {
        const target = findTarget();
        target?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        if (target) window.setTimeout(() => window.scrollBy({ top: -VIEWPORT_TOP_OFFSET, behavior: "smooth" }), 180);
      }, 120),
      window.setTimeout(updateRect, 450),
      window.setTimeout(updateRect, 760),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [active, current, findTarget, setActiveTab, setDemoMode, updateRect]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, updateRect]);

  const finish = useCallback(() => {
    setDemoMode(false);
    setStep(0);
    onFinish();
  }, [onFinish, setDemoMode]);

  const spot = useMemo(() => {
    const fallbackW = typeof window !== "undefined" ? Math.min(420, window.innerWidth - 32) : 320;
    const fallbackLeft = typeof window !== "undefined" ? (window.innerWidth - fallbackW) / 2 : 16;
    return {
      top: (rect?.top ?? 110) - PAD,
      left: (rect?.left ?? fallbackLeft) - PAD,
      width: (rect?.width ?? fallbackW) + PAD * 2,
      height: (rect?.height ?? 96) + PAD * 2,
    };
  }, [rect]);

  if (!active || !current) return null;

  const tooltipTop = typeof window !== "undefined"
    ? Math.max(12, Math.min(spot.top + TOOLTIP_INSET, window.innerHeight - 260))
    : spot.top + TOOLTIP_INSET;
  const tooltipLeft = typeof window !== "undefined"
    ? Math.max(12, Math.min(spot.left + TOOLTIP_INSET, window.innerWidth - 356))
    : 12;
  const isLast = step === total - 1;

  return createPortal(
    <div className="fixed inset-0 z-[999] pointer-events-none select-none">
      <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={finish}>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect x={spot.left} y={spot.top} width={spot.width} height={spot.height} rx={12} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.74)" mask="url(#tour-hole)" />
      </svg>

      <div
        className="absolute rounded-xl pointer-events-none"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 2px rgba(0,240,255,0.9), 0 0 28px rgba(0,240,255,0.5)",
          zIndex: 1000,
        }}
      />

      <div
        className="absolute pointer-events-auto"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          width: 344,
          maxWidth: "calc(100vw - 24px)",
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-white/15 bg-[rgba(6,7,20,0.96)] p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              {lang === "ru" ? "Обучение" : "Tutorial"} {step + 1}/{total}
            </div>
            <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${((step + 1) / total) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-1.5 text-sm font-black text-white">
            {lang === "ru" ? current.titleRu : current.titleEn}
          </div>
          <p className="mb-4 text-xs leading-relaxed text-white/64">
            {lang === "ru" ? current.descRu : current.descEn}
          </p>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={finish} className="text-xs text-white/35 transition hover:text-white/65">
              {lang === "ru" ? "Пропустить" : "Skip"}
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                >
                  ←
                </button>
              )}
              <button
                type="button"
                onClick={() => (isLast ? finish() : setStep((s) => Math.min(total - 1, s + 1)))}
                className="rounded-lg px-4 py-1.5 text-xs font-black text-black transition hover:brightness-110"
                style={{ background: "linear-gradient(90deg, #00F0FF, #B026FF)" }}
              >
                {isLast ? (lang === "ru" ? "Готово" : "Done") : (lang === "ru" ? "Далее" : "Next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
