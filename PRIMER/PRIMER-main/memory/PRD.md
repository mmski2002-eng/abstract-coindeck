# CoinDeck — Color System Preview

## Original problem statement
> «У меня есть вот такой сайт. Разработай мне цветовое решение для этого сайта. Он на абстракте, игровые нфт.»

Пользователь предоставил PDF-скриншот существующего сайта CoinDeck (игровые NFT на Abstract).

## User choices
- Формат: палитра + рекомендации (документ) **+** интерактивный preview-макет (variant 2)
- Тема: обе (Dark/Light с переключателем)
- Бренд: использовать Abstract Lime `#88FC00` как единственный акцент
- Mood: минимализм с одним ярким акцентом
- Редкости: сочетать с сине-зелёной палитрой Abstract

## Architecture
- React 19 + react-router-dom 7, CSS Custom Properties для тем (без правки глобальных `:root` чтобы не ломать существующий shadcn-стек)
- Один файл компонента `/app/frontend/src/ColorPreview.jsx` с самодостаточной системой токенов
- Темы переключаются runtime через React state + `document.body` background sync

## What's been implemented (2026-01)
- `/app/design/COLOR_GUIDELINES.md` — полный гайдлайн (палитра, правила, контрастность WCAG, CSS-токены, Tailwind config snippet)
- `/app/frontend/src/ColorPreview.jsx` — интерактивный preview:
  - Header с лого CD, криптотикером (success/danger статусы), кнопкой переключения темы
  - Hero с радиальным accent spot-light и 4 вариантами кнопок
  - Магазин сундуков (Common / Rare / Epic) с rarity-окраской и glow
  - Фильтры с активным состоянием через bottom-border (минимализм)
  - Сетка NFT-карточек всех 4 редкостей (COMMON, RARE, EPIC, LEGENDARY) с rarity-glow и progress bar
  - Token swatches: accent, surfaces, rarities, status
- `/app/frontend/src/App.js` — упрощённая роутизация на ColorPreview как главную

## Color tokens (high-level)
- **Accent (shared):** `#88FC00` (Abstract Lime), hover `#9CFF2E`/`#7AE800`, foreground `#0A0F0D`
- **Dark theme:** bg `#0A0F0D`, surface `#11171A`, text `#ECF1EE / #A0AAA4 / #6B7570`
- **Light theme:** bg `#F4F6F5`, surface `#FFFFFF`, text `#0B1410 / #5A6661 / #8A938F`
- **Rarities:** Common `#7C8782/#9DA9A2`, Rare `#2BA8C9`, Epic `#1DD3B0`, Legendary `#B6FF3D`
- **Status:** success `#4ADE80`, danger `#F26D6D`, warning `#F5C451`, info `#5DB4D3`

## Backlog (P1/P2)
- P1: Tailwind-токены прописать прямо в `tailwind.config.js` и `index.css` (сейчас preview изолирован)
- P2: Применить палитру ко всему реальному сайту CoinDeck (нужна кодовая база сайта)
- P2: Экспорт Figma Tokens (W3C Design Tokens JSON) для дизайнеров
- P2: Добавить hover/focus motion preset (Framer Motion) под каждый компонент
