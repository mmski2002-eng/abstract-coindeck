"use client";

import * as React from "react";

export type Language = "ru" | "en";

type Dict = Record<string, { ru: string; en: string }>;

const dict: Dict = {
  "nav.how": { ru: "Как это работает", en: "How it works" },
  "nav.rarity": { ru: "Редкости", en: "Rarities" },
  "nav.dapp": { ru: "dApp", en: "dApp" },
  "cta.mechanics": { ru: "Механика", en: "Mechanics" },
  "cta.connectWallet": { ru: "Подключить кошелёк", en: "Connect wallet" },
  "cta.seeMechanic": { ru: "Смотреть механику", en: "See the mechanic" },

  "hero.badge.cards": { ru: "Dota 2 • Player Cards as Move objects", en: "Dota 2 • Player cards as Move objects" },
  "hero.badge.merge": { ru: "Механика: Merge 5 → 1", en: "Mechanic: Merge 5 → 1" },
  "hero.title": {
    ru: "Коллекционируй карточки про‑игроков и прокачивай редкость через слияние",
    en: "Collect pro player cards and upgrade rarity through merging",
  },
  "hero.subtitle": {
    ru: "Собирай одинаковые карточки, сжигай их в Merge и поднимай уровень: Common → Rare → Epic → Legendary. Чем выше редкость — тем ценнее коллекция.",
    en: "Collect duplicates, burn them in Merge and level up: Common → Rare → Epic → Legendary. The higher the rarity, the more valuable the collection.",
  },

  "steps.collect.kicker": { ru: "Собирай", en: "Collect" },
  "steps.collect.title": { ru: "Дроп карточек", en: "Card drops" },
  "steps.collect.desc": { ru: "Получай игроков в коллекцию", en: "Add players to your collection" },
  "steps.merge.kicker": { ru: "Объединяй", en: "Merge" },
  "steps.merge.title": { ru: "5 одинаковых", en: "5 duplicates" },
  "steps.merge.desc": { ru: "Сжигаются ради апгрейда", en: "Burned to upgrade" },
  "steps.upgrade.kicker": { ru: "Прокачивай", en: "Upgrade" },
  "steps.upgrade.title": { ru: "Редкость ↑", en: "Rarity ↑" },
  "steps.upgrade.desc": { ru: "До Legendary уровня", en: "Up to Legendary" },

  "merge.example.title": { ru: "Пример слияния", en: "Merge example" },
  "merge.example.subtitle": { ru: "одинаковая карточка → апгрейд", en: "same card → upgrade" },
  "merge.note": {
    ru: "Каждое слияние сжигает 5 копий и создаёт 1 улучшенную карточку следующего уровня.",
    en: "Each merge burns 5 copies and creates 1 upgraded card of the next tier.",
  },

  "how.kicker": { ru: "КАК ЭТО РАБОТАЕТ", en: "HOW IT WORKS" },
  "how.title": { ru: "Простая прогрессия, сильная цель", en: "Simple progression, strong goal" },
  "how.desc": {
    ru: "Твой прогресс — это коллекция. Ты всегда понимаешь, что делать дальше: собрать ещё 5 одинаковых, чтобы поднять уровень редкости. Это создаёт редкость на рынке и азарт на сбор.",
    en: "Your progress is your collection. The next step is always clear: collect 5 duplicates to upgrade rarity. This creates scarcity on the market and excitement in the chase.",
  },
  "how.card1.t": { ru: "Коллекция", en: "Collection" },
  "how.card1.d": { ru: "Карточки живут как Move‑объекты и принадлежат кошельку.", en: "Cards live as Move objects and are owned by your wallet." },
  "how.card2.t": { ru: "Merge", en: "Merge" },
  "how.card2.d": { ru: "Сжигаешь 5 одинаковых — получаешь 1 карточку следующего уровня.", en: "Burn 5 duplicates to get 1 card of the next tier." },
  "how.card3.t": { ru: "Охота за легендой", en: "Chasing the legend" },
  "how.card3.d": { ru: "Legendary — долгосрочная цель: дорогая, редкая, узнаваемая.", en: "Legendary is a long-term trophy: expensive, rare, recognizable." },
  "how.card4.t": { ru: "Дроп/ивенты", en: "Drops / events" },
  "how.card4.d": { ru: "Подходит под баттл‑пасс, сезоны, турниры и спец‑серии игроков.", en: "Perfect for battle passes, seasons, tournaments, and special player series." },

  "rarity.kicker": { ru: "РЕДКОСТИ", en: "RARITIES" },
  "rarity.note": {
    ru: "Legendary — максимальный уровень. Открывается из Сундука быка или получается слиянием 5 Epic карточек.",
    en: "Legendary is the highest tier. Obtained from Bull Chests or by merging 5 Epic cards.",
  },

  "app.kicker": { ru: "DAPP", en: "DAPP" },
  "app.title": { ru: "Коллекция в кошельке", en: "Collection in your wallet" },
  "app.desc": {
    ru: "Ниже — текущий демо‑интерфейс: подключение Razor wallet, минт и галерея.",
    en: "Below is the current demo UI: Razor wallet connect, mint, and gallery.",
  },

  "wallet.connect": { ru: "Подключить кошелек", en: "Connect wallet" },
  "wallet.disconnect": { ru: "Отключить", en: "Disconnect" },
  "wallet.choose": { ru: "Выбор кошелька", en: "Choose wallet" },
  "wallet.status": { ru: "Статус", en: "Status" },
  "wallet.wallet": { ru: "Кошелёк", en: "Wallet" },
  "wallet.chain": { ru: "Сеть", en: "Chain" },
  "wallet.installPrompt": {
    ru: "Если кошелёк не установлен, установи расширение и обнови страницу.",
    en: "If a wallet is not installed, install the extension and refresh the page.",
  },
  "demo.engine": { ru: "Engine (демо)", en: "Engine demo" },
  "demo.module": { ru: "Модуль", en: "Module" },
  "demo.initializing": { ru: "Инициализация…", en: "Initializing…" },
  "demo.init": { ru: "Инициализировать", en: "Init" },
  "demo.setting": { ru: "Запись…", en: "Setting…" },
  "demo.set": { ru: "Записать", en: "Set" },
  "demo.reading": { ru: "Чтение…", en: "Reading…" },
  "demo.get": { ru: "Прочитать", en: "Get" },
};

const LanguageContext = React.createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof dict) => string;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = React.useState<Language>("ru");

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("moveinvestor.lang");
      if (stored === "ru" || stored === "en") setLang(stored);
      else {
        const nav = (navigator.language || "").toLowerCase();
        setLang(nav.startsWith("ru") ? "ru" : "en");
      }
    } catch {
      // ignore
    }
  }, []);

  const setAndPersist = React.useCallback((l: Language) => {
    setLang(l);
    try {
      window.localStorage.setItem("moveinvestor.lang", l);
    } catch {
      // ignore
    }
  }, []);

  const t = React.useCallback(
    (key: keyof typeof dict) => {
      const entry = dict[key];
      return entry ? entry[lang] : String(key);
    },
    [lang],
  );

  const value = React.useMemo(() => ({ lang, setLang: setAndPersist, t }), [lang, setAndPersist, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
