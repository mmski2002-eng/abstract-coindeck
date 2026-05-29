# CoinDeck — Цветовая система v2
**Игровые NFT на Abstract · Минимализм + 2D cartoon vibe + сине-зелёные акценты**

Документ описывает обновлённую цветовую систему: минималистичная сетка, сине-зелёные брендовые акценты Abstract и подача «мультяшной 2D-наклейки» (толстые чёрные обводки, плоские заливки, off-set тень, никаких градиентов).

---

## 1. Mood

> **«Sticker UI»** — чистая бумажная подложка, толстая чёрная обводка, плоский цвет, лёгкая offset-тень `4px 4px 0 #0A0A0A`. Никаких градиентов и блюров. Дружелюбно как пингвин, но строго как биржа.

### Что это значит на практике

| Принцип | Как применять |
|---|---|
| **Outline-first** | Каждый интерактивный/контентный блок имеет чёрную обводку `2.5px`. Это формирует «иллюстративный» каркас сайта. |
| **Flat fills, hard shadow** | Заливка — один сплошной цвет. Тень — резкая, без blur: `box-shadow: 4px 4px 0 var(--ink)`. |
| **Two-accent system** | Сине-зелёная ось Abstract: **Mint Aqua `#26C6A8`** (основной CTA) + **Sky `#7AC7E8`** (вторичный, спокойный). |
| **Off-white paper** | В light-теме фон не белый, а кремово-бумажный `#F4EFE2` — даёт мультяшное «фон комикса». |
| **Cool ink** | Везде, где нужен чёрный — используется холодный `#0F1115` (он чуть синит, держит общую сине-зелёную тональность). |
| **Один акцент на блок** | На карточке — одна цветная плашка (значок, badge), остальное — `paper` + `ink`. |

---

## 2. Базовая палитра

### 2.1 Бренд / акценты (сине-зелёная ось Abstract)

| Токен | HEX | RGB | Назначение |
|---|---|---|---|
| `--mint` | `#26C6A8` | 38 198 168 | **Primary CTA**, активный таб, рост цены, Epic NFT |
| `--mint-deep` | `#1DA88E` | 29 168 142 | Mint hover/active |
| `--mint-soft` | `#BFEDE2` | 191 237 226 | Подложки, soft-плитки, light bg для секций |
| `--sky` | `#7AC7E8` | 122 199 232 | **Secondary** заливка, Rare NFT, info-плашки |
| `--sky-deep` | `#4DAFD5` | 77 175 213 | Sky hover/active |
| `--sky-soft` | `#DCEEF7` | 220 238 247 | Подложка hero / soft-чипы |
| `--lime-pop` | `#88FC00` | 136 252 0 | Брендовый лайм Abstract — **только** на Legendary и в логотипе |

> **Правило 60-30-10**: 60% paper/ink → 30% mint+sky → 10% lime-pop. Лайм работает только как акцент-вспышка (Legendary, лого-пятно).

### 2.2 Нейтрали (paper + ink)

| Токен | Light | Dark | Применение |
|---|---|---|---|
| `--paper` | `#F4EFE2` | `#0E141A` | Корневой фон страницы |
| `--paper-2` | `#FBF7EC` | `#141B23` | Карточки, header, поверхности |
| `--paper-3` | `#FFFFFF` | `#1B232C` | Hover surface / elevated |
| `--sunken` | `#E9E2D1` | `#0A0F14` | Inputs, code blocks, чарт-зона |
| `--ink` | `#0F1115` | `#0F1115` | Обводки, основной текст |
| `--ink-2` | `#3A4049` | `#E8EEF5` | Вторичный текст |
| `--ink-3` | `#7A828D` | `#9AA3AE` | Caption / disabled |

> Ink одинаков в обеих темах — это «комиксная» чёрная обводка, которая всегда тёмно-холодная. В тёмной теме она же используется для разделителей.

### 2.3 Статус (приглушённый, не конкурирует с mint)

| Токен | HEX | Применение |
|---|---|---|
| `--up` | `#23A86A` | Рост цены ↑, success |
| `--down` | `#E25C5C` | Падение цены ↓, error |
| `--warn` | `#F2B73A` | Предупреждения |
| `--info` | `#4DAFD5` | Совпадает с `--sky-deep`, ссылки |

---

## 3. Цвета редкостей NFT

Двигаются строго по сине-зелёной оси Abstract: от прохладного нейтрала → к sky → mint → lime-pop.

| Редкость | Fill HEX | Shadow / glow | Логика |
|---|---|---|---|
| **COMMON** | `#D9D3C2` (paper-tan) | `#0F1115` (ink) | Бумажный нейтрал, читается как «обычная карточка» |
| **RARE** | `#7AC7E8` (sky) | `#0F1115` | Прохладный sky-blue — синяя половина Abstract |
| **EPIC** | `#26C6A8` (mint) | `#0F1115` | Mint aqua — мост между sky и lime, чистая Abstract-нота |
| **LEGENDARY** | `#88FC00` (lime-pop) | `#0F1115` | Сам акцент Abstract — Legendary видно за километр |

**Правила:**
- Карточка любой редкости — одинаковая структура: `paper-2` фон + 2.5px ink-обводка + offset-тень.
- Цвет редкости живёт в **одной плашке** в верху карточки (rarity-chip) и в нижней «полоске цены» (4px полоса).
- Никаких градиент-бордеров. Никаких пульсаций. Только sticker-консистентность.
- Legendary получает дополнительную «вторую тень» лаймом: `box-shadow: 4px 4px 0 #0F1115, 8px 8px 0 #88FC00`.

---

## 4. Компонентные правила

### 4.1 Кнопки (sticker-style)

| Тип | Fill | Text | Border | Shadow |
|---|---|---|---|---|
| **Primary** | `--mint` | `--ink` | `2.5px --ink` | `4px 4px 0 --ink` |
| **Secondary** | `--sky` | `--ink` | `2.5px --ink` | `4px 4px 0 --ink` |
| **Outline** | `--paper-2` | `--ink` | `2.5px --ink` | `4px 4px 0 --ink` |
| **Ghost** | transparent | `--ink-2` | none | none |
| **Destructive** | `--paper-2` | `--down` | `2.5px --down` | `4px 4px 0 --down` |

**Hover:** кнопка сдвигается на `2px 2px` и тень становится `2px 2px 0 --ink` — эффект «нажатия наклейки».  
**Active/press:** `translate(4px, 4px)` и `box-shadow: none`.  
**Focus ring:** `outline: 3px solid --mint; outline-offset: 3px;`

### 4.2 Карточка NFT

```
┌──────────────────────────┐  ← 2.5px ink-border, radius 18px
│ ◉ EPIC          [NEW]    │  ← rarity-chip (mint fill) + lime badge
│                          │
│      ┌──────────┐        │
│      │   🐧     │        │  ← символ монеты на mint-soft круге
│      └──────────┘        │
│                          │
│  Arbitrum                │  ← ink, weight 700
│  ROLLUP                  │  ← ink-3, mono-spaced caps
│                          │
│  ●●●●○  4/5              │  ← progress dots
│  ▰▰▰▰▰▰▰▰▰▰              │  ← rarity-fill полоса 4px
│                          │
│  [ Купить ]   [ → ]      │  ← primary + ghost icon
└──────────────────────────┘
       └─ shadow 4px 4px 0 #0F1115
```

### 4.3 Header / Тикер

- `--paper-2` фон, `border-bottom: 2.5px --ink`
- Логотип = sticker-плашка `--lime-pop` 36×36 с буквами `CD` чёрным
- Тикер: ink цена + `--up`/`--down` для %, моноширинный шрифт
- Theme toggle = pill-кнопка outline-style

### 4.4 Фильтры (BOX · LAYER 1 · MEME · …)

- Неактивный: `--paper-2` фон, `2px --ink` border, text `--ink-2`
- Hover: фон → `--sky-soft`
- Активный: фон → `--mint`, text → `--ink`, тот же 2px ink-border + 3px offset shadow

### 4.5 Магазин сундуков

- Каждый сундук = sticker-карточка той же редкости
- Сундук Хомяка → COMMON, Сундук Медведя → RARE, Сундук Быка → EPIC, Сундук Дракона → LEGENDARY
- Иконка сундука сидит на круглой плашке цвета редкости (для COMMON — paper-tan)

### 4.6 Фон страницы

- Light: `--paper` ровный, без градиентов.
- Допустимо: декоративные плоские «стикер-пятна» (круг mint-soft 240px, круг sky-soft 180px) поставленные в углах hero, чуть выходящие за viewport. Без blur.
- Опциональный paper-noise 2% opacity для текстуры «бумаги».
- Dark: `--paper` (deep navy ink), без декоративных пятен — там работают акцентные карточки.

---

## 5. Типографика (рекомендация)

- **Дисплей / заголовки:** `"Sora"`, `"DM Sans"`, `"Space Grotesk"` — округлый геометрический grotesque (sticker-friendly), weight 700–800
- **Body:** тот же шрифт, weight 500
- **Mono (цены, тикер):** `"JetBrains Mono"` / `ui-monospace`
- **Регистр:** заголовки sentence case, метки и rarity caps — UPPERCASE с трекингом 2

---

## 6. Контрастность (WCAG)

| Пара | Контраст | Допустимо |
|---|---|---|
| `#0F1115` на `#F4EFE2` (ink/paper) | **17.1 : 1** | ✅ AAA |
| `#0F1115` на `#26C6A8` (ink/mint) | **6.9 : 1** | ✅ AA large+normal |
| `#0F1115` на `#7AC7E8` (ink/sky) | **8.7 : 1** | ✅ AAA |
| `#0F1115` на `#88FC00` (ink/lime) | **13.5 : 1** | ✅ AAA |
| `#E8EEF5` на `#0E141A` (dark text/bg) | **15.0 : 1** | ✅ AAA |

Текст всегда — ink (или ink-2). Mint/Sky/Lime — **только заливки**, никогда не цвет шрифта.

---

## 7. Готовые токены — CSS

```css
:root {
  /* Brand */
  --mint:       #26C6A8;
  --mint-deep:  #1DA88E;
  --mint-soft:  #BFEDE2;
  --sky:        #7AC7E8;
  --sky-deep:   #4DAFD5;
  --sky-soft:   #DCEEF7;
  --lime-pop:   #88FC00;

  /* Ink (shared) */
  --ink:   #0F1115;
  --ink-2: #3A4049;
  --ink-3: #7A828D;

  /* Status */
  --up:   #23A86A;
  --down: #E25C5C;
  --warn: #F2B73A;
  --info: #4DAFD5;

  /* Rarities */
  --rarity-common:    #D9D3C2;
  --rarity-rare:      #7AC7E8;
  --rarity-epic:      #26C6A8;
  --rarity-legendary: #88FC00;

  /* Radii / motion */
  --radius-sm: 10px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --ease-out:  cubic-bezier(0.22, 1, 0.36, 1);

  /* Sticker shadow */
  --shadow-sticker: 4px 4px 0 var(--ink);
  --shadow-sticker-sm: 2px 2px 0 var(--ink);
}

/* LIGHT (default) */
:root, [data-theme="light"] {
  --paper:   #F4EFE2;
  --paper-2: #FBF7EC;
  --paper-3: #FFFFFF;
  --sunken:  #E9E2D1;
}

/* DARK */
[data-theme="dark"] {
  --paper:   #0E141A;
  --paper-2: #141B23;
  --paper-3: #1B232C;
  --sunken:  #0A0F14;
  --ink-2:   #E8EEF5;
  --ink-3:   #9AA3AE;
  /* Note: --ink остаётся одинаковым — обводки всегда чёрные */
}
```

### Tailwind фрагмент

```js
extend: {
  colors: {
    paper:   { DEFAULT: 'var(--paper)', 2: 'var(--paper-2)', 3: 'var(--paper-3)' },
    sunken:  'var(--sunken)',
    ink:     { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
    mint:    { DEFAULT: 'var(--mint)', deep: 'var(--mint-deep)', soft: 'var(--mint-soft)' },
    sky:     { DEFAULT: 'var(--sky)',  deep: 'var(--sky-deep)',  soft: 'var(--sky-soft)'  },
    lime:    'var(--lime-pop)',
    up:      'var(--up)',
    down:    'var(--down)',
    rarity:  {
      common: 'var(--rarity-common)',
      rare:   'var(--rarity-rare)',
      epic:   'var(--rarity-epic)',
      legend: 'var(--rarity-legendary)',
    },
  },
  boxShadow: {
    sticker:    '4px 4px 0 var(--ink)',
    'sticker-sm': '2px 2px 0 var(--ink)',
    'sticker-down': '4px 4px 0 var(--down)',
    legend:     '4px 4px 0 var(--ink), 8px 8px 0 var(--lime-pop)',
  }
}
```

---

## 8. Чек-лист перед применением

- [ ] Все интерактивные блоки имеют 2.5px ink-обводку
- [ ] Тени резкие, не размытые (`0 blur`)
- [ ] Нет градиентов на фонах
- [ ] На странице один Primary mint CTA на секцию
- [ ] Lime используется только на Legendary и логотипе
- [ ] Цвета редкостей читаются по оси: tan → sky → mint → lime
- [ ] Hover на кнопке физически «вдавливает» её (translate + shrink shadow)
- [ ] Контраст всех текстов на ink ≥ 4.5:1
- [ ] Тикер +/-% — `--up` / `--down`, не mint

---

## 9. Mood-board одной строкой

> **Sticker minimalism · cool ink outlines · mint+sky abstract duo · lime-pop on legendary · paper warmth instead of pure white · cartoon discipline.**
