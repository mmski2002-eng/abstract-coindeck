import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.FRONTEND_SMOKE_URL ?? "http://127.0.0.1:3000";

async function maybeFetch(path) {
  try {
    return await fetch(`${BASE_URL}${path}`);
  } catch {
    return null;
  }
}

test("локальный frontend отвечает и отдает NFT metadata endpoints", async (t) => {
  const home = await maybeFetch("/");
  if (!home) {
    t.skip(`Dev-сервер ${BASE_URL} не запущен; HTTP smoke пропущен.`);
    return;
  }

  assert.equal(home.status, 200);

  const card = await maybeFetch("/api/nft/card-meta/0/0");
  assert.ok(card, "card-meta endpoint недоступен.");
  assert.equal(card.status, 200);
  assert.match(card.headers.get("cache-control") ?? "", /max-age=3600/);
  const cardJson = await card.json();
  assert.match(cardJson.name, /Bitcoin/);
  assert.equal(cardJson.attributes.some((item) => item.trait_type === "Ticker" && item.value === "BTC"), true);

  const chest = await maybeFetch("/api/nft/chest-meta/0");
  assert.ok(chest, "chest-meta endpoint недоступен.");
  assert.equal(chest.status, 200);
  assert.match(chest.headers.get("cache-control") ?? "", /max-age=3600/);
  const chestJson = await chest.json();
  assert.equal(Array.isArray(chestJson.attributes), true);
});
