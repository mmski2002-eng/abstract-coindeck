import test from "node:test";
import assert from "node:assert/strict";
import { assertNoMatches, listFiles, read } from "./helpers.mjs";

test("в компонентах нет старых dark utility-классов после PRIMER-токенизации", () => {
  const files = listFiles("frontend/src", [".ts", ".tsx"], {
    excluded: [
      "frontend/src/config/assetUniverse.ts",
      "frontend/src/app/api/nft/palette.ts",
    ],
  });

  assertNoMatches(
    assert,
    files,
    /\b(?:bg-white\/|bg-black\/|text-zinc|border-white\/|bg-zinc-|bg-blue-900|bg-purple-900|bg-amber-900|bg-red-950|text-white\/|text-cyan-|text-violet-|text-amber-|text-red-)/,
    "Найдены старые Tailwind utility-цвета, которые должны быть заменены на CSS-токены.",
  );
});

test("globals.css не содержит старый compatibility-блок и neon-tab fallback", () => {
  const css = read("frontend/src/app/globals.css");
  const forbidden = [
    "activeTabColorWave",
    "activeTabBgWave",
    "holo-sheen",
    "foil-perpetual",
    "mp-accent-bg",
    'html[data-theme="light"] .bg-white',
    'html[data-theme="light"] .bg-black',
    'html[data-theme="light"] .text-zinc',
    'html[data-theme="light"] .border-white',
  ];

  for (const token of forbidden) {
    assert.equal(css.includes(token), false, `globals.css содержит удаленный compatibility/style токен: ${token}`);
  }
});

test("BeachScene использует централизованные beach CSS-переменные", () => {
  const scene = read("frontend/src/components/BeachScene.tsx");
  const css = read("frontend/src/app/globals.css");

  for (const token of [
    "--beach-sky-start",
    "--beach-sea-start",
    "--beach-sand-start",
    "--beach-wave-front",
    "--beach-ghost-bg",
    "--beach-ghost-border",
    "--beach-ghost-inner-bg",
    "--beach-ghost-line-strong",
    "--beach-ghost-line-soft",
  ]) {
    assert.equal(css.includes(token), true, `В globals.css нет ${token}`);
    assert.equal(scene.includes(`var(${token})`), true, `BeachScene не использует ${token}`);
  }

  assert.equal(/const\s+sky1|const\s+sea1|const\s+sand1/.test(scene), false, "BeachScene снова содержит локальные цвета фона.");
});

test("dark theme использует единый серый shadow token вместо белых теней", () => {
  const css = read("frontend/src/app/globals.css");
  const darkBlock = css.match(/html\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(darkBlock, /--shadow-sticker-color-strong:\s*#4A5563;/);
  for (const token of [
    "--shadow-sticker",
    "--shadow-sticker-sm",
    "--shadow-sticker-legend",
    "--card-shadow",
    "--info-shell-shadow",
    "--filter-btn-shadow",
    "--filter-btn-shadow-active",
  ]) {
    assert.match(
      darkBlock,
      new RegExp(`${token}:\\s*[^;]*var\\(--shadow-sticker-color-strong\\)`),
      `${token} в dark theme должен ссылаться на общий серый shadow token.`,
    );
  }
});

test("sticker shadows не используют outline: в dark theme outline остается рамкой, а не тенью", () => {
  const files = listFiles("frontend/src", [".css", ".ts", ".tsx"]);

  assertNoMatches(
    assert,
    files,
    /(?:boxShadow|box-shadow)[^;\n}]*var\(--outline\)/,
    "Найдена тень, привязанная к --outline. Для тени используйте --shadow-sticker-color-strong / --card-shadow.",
  );
});
