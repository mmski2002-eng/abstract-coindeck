import test from "node:test";
import assert from "node:assert/strict";
import { assertNoMatches, listFiles, read } from "./helpers.mjs";

test("NFT rarity/ink цвета объявлены только в app/api/nft/palette.ts", () => {
  const files = listFiles("frontend/src/app/api/nft", [".ts", ".tsx"], {
    excluded: ["frontend/src/app/api/nft/palette.ts"],
  });

  assertNoMatches(
    assert,
    files,
    /#D9D3C2|#7AC7E8|#26C6A8|#88FC00|#FFB800|#0F1115/,
    "NFT API не должен размазывать PRIMER rarity/ink hex по route-файлам.",
  );

  const palette = read("frontend/src/app/api/nft/palette.ts");
  for (const token of ["NFT_INK", "NFT_RARITY_STYLES", "NFT_CHEST_RENDER_STYLES", "NFT_CHEST_ANIM_STYLES"]) {
    assert.equal(palette.includes(token), true, `В NFT palette нет ${token}`);
  }
});

test("NFT route-файлы используют общий palette вместо локальных style-дублей", () => {
  const files = listFiles("frontend/src/app/api/nft", [".ts", ".tsx"], {
    excluded: ["frontend/src/app/api/nft/palette.ts"],
  });

  assertNoMatches(
    assert,
    files,
    /const\s+(?:FILLS|CHESTS|RARITY_LABELS|TIER_LABELS)\b/,
    "Найдены локальные NFT style массивы, которые должны жить в palette.ts.",
  );

  for (const file of [
    "frontend/src/app/api/nft/shared.tsx",
    "frontend/src/app/api/nft/card-anim/[...slug]/route.ts",
    "frontend/src/app/api/nft/chest-anim/[...slug]/route.ts",
    "frontend/src/app/api/nft/card-meta/[...slug]/route.ts",
    "frontend/src/app/api/nft/chest-meta/[...slug]/route.ts",
    "frontend/src/app/api/nft/chest-img/[...slug]/route.tsx",
  ]) {
    assert.match(read(file), /from "\.\.?\/\.\.?\/palette"|from "\.\/palette"/, `${file} не импортирует общий NFT palette.`);
  }
});

test("NFT endpoints сохраняют Cache-Control headers", () => {
  const routeFiles = listFiles("frontend/src/app/api/nft", [".ts", ".tsx"], {
    excluded: ["frontend/src/app/api/nft/palette.ts"],
  }).filter((file) => file.endsWith("route.ts") || file.endsWith("route.tsx"));

  for (const file of routeFiles) {
    const source = read(file);
    const hasCacheHeader = source.includes("Cache-Control") || source.includes("buildCardImageResponse") || source.includes("buildChestImageResponse");
    assert.equal(hasCacheHeader, true, `${file} не задает и не делегирует Cache-Control для NFT response.`);
  }
});
