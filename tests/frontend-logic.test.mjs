import test from "node:test";
import assert from "node:assert/strict";
import { read } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

test("oracleScoring считает очки, пороги и clamp без регрессий", async () => {
  const scoring = await importTs("frontend/src/lib/oracleScoring.ts");

  assert.equal(scoring.clamp(10, 0, 5), 5);
  assert.equal(scoring.calcVolPts(500_000_000), 100);
  assert.equal(scoring.calcVolPts(9_999_999), 0);
  assert.equal(scoring.calcVolatilityPts(20), 100);
  assert.equal(scoring.calcSpreadPct(100, 120), 20);

  const breakdown = scoring.calcOracleBreakdown({
    priceChg: 12.6,
    vol24h: 600_000_000,
    low24h: 100,
    high24h: 120,
    tempRatio: 20,
    hype: true,
  });

  assert.equal(breakdown.pricePts, 126);
  assert.equal(breakdown.volPts, 100);
  assert.equal(breakdown.volatilityPts, 100);
  assert.equal(breakdown.tempPts, 150);
  assert.equal(breakdown.hypePts, 100);
  assert.equal(breakdown.total, 576);

  assert.equal(scoring.calcOraclePoints({
    priceChg: 999,
    vol24h: 600_000_000,
    low24h: 1,
    high24h: 100,
    tempRatio: 999,
    hype: true,
  }), 750);
});

test("oracleWindow строит UTC-окна и query для market-data", async () => {
  const windows = await importTs("frontend/src/lib/oracleWindow.ts");

  const juneFirst2026 = Date.UTC(2026, 5, 1, 0, 0, 0) / 1000;
  const selected = windows.resolveOracleWindow("2026-06-03", juneFirst2026);

  assert.equal(selected.day, 3);
  assert.equal(selected.dateKey, "2026-06-03");
  assert.equal(selected.fromTs, juneFirst2026 + 2 * 86400);
  assert.equal(selected.toTs, juneFirst2026 + 3 * 86400);
  assert.equal(windows.buildMarketDataQuery(selected), `date=2026-06-03&fromTs=${juneFirst2026 + 2 * 86400}`);
  assert.equal(windows.parseDateInputToUtcTs("bad-input"), null);
});

test("palette sanitizer пропускает только разрешенные CSS-переменные", async () => {
  const palette = await importTs("frontend/src/lib/palette.ts");

  const sanitized = palette.sanitizePaletteData({
    light: {
      "--panel-bg": "  #fff  ",
      "--unknown-token": "#f00",
      "--button-primary-bg": "",
    },
    dark: {
      "--surface": "rgba(0,0,0,.5)",
      "--overlay-backdrop": " transparent ",
    },
  });

  assert.deepEqual(sanitized.light, { "--panel-bg": "#fff" });
  assert.deepEqual(sanitized.dark, {
    "--surface": "rgba(0,0,0,.5)",
    "--overlay-backdrop": "transparent",
  });
  assert.deepEqual(palette.sanitizePaletteData(null), { light: {}, dark: {} });
});

test("adminAuth стабилизирует домен, payload и сообщение подписи", async () => {
  const auth = await importTs("frontend/src/lib/adminAuth.ts");

  assert.equal(auth.normalizeAdminDomain(" HTTPS://Example.COM/path/// "), "example.com/path");
  assert.equal(auth.stableStringify({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');

  const message = auth.buildAdminActionMessage({
    domain: "https://Example.COM/",
    chainId: 11124,
    action: auth.PALETTE_ACTION,
    timestamp: 1780000000,
    nonce: "nonce-1",
    payloadHash: "0xabc",
  });

  assert.equal(message, [
    "moveinvestor-admin",
    "domain:example.com",
    "chainId:11124",
    "action:admin-palette",
    "timestamp:1780000000",
    "nonce:nonce-1",
    "payloadHash:0xabc",
  ].join("\n"));
});

test("connect modal берет счетчик minted NFT из блокчейна и не показывает статичное число", () => {
  const modal = read("frontend/src/components/wallet/overlays/ConnectPortals.tsx");
  const evm = read("frontend/src/lib/evmContracts.ts");

  assert.equal(modal.includes("342 НФТ заминчено"), false, "CTA не должен показывать старое статичное число NFT.");
  assert.equal(modal.includes("342 NFTs minted"), false, "CTA не должен показывать старое статичное число NFT.");
  assert.match(modal, /readEvmMintedNftCount/, "Connect modal должен читать счетчик из EVM helper.");
  assert.match(modal, /AnimatedMintedNumber/, "Пока данные грузятся, должен работать анимированный пересчет цифр.");
  assert.match(modal, /НФТ пересчитывается/, "Для отсутствующих данных нужен loading-текст пересчета.");

  assert.match(evm, /EggMonetMinted\(address,uint256,uint8,uint8\)/, "Нужно считать mint card события.");
  assert.match(evm, /EggMinted\(address,uint256,uint8\)/, "Нужно считать mint egg события.");
  assert.match(evm, /eth_getLogs/, "Счетчик minted NFT должен читать события из RPC.");
});
