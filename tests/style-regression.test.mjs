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
    "--beach-card-bg",
    "--beach-cta-bg",
  ]) {
    assert.equal(css.includes(token), true, `В globals.css нет ${token}`);
    assert.equal(scene.includes(`var(${token})`), true, `BeachScene не использует ${token}`);
  }

  assert.equal(/const\s+sky1|const\s+sea1|const\s+sand1/.test(scene), false, "BeachScene снова содержит локальные цвета фона.");
});
