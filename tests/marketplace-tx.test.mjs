import test from "node:test";
import assert from "node:assert/strict";
import { read } from "./helpers.mjs";

test("marketplace buy транзакции передают payable value из цены лота", () => {
  const source = read("frontend/src/components/wallet/hooks/useMarketplaceLogic.ts");

  assert.match(
    source,
    /const listing = mpListings\.find\(\(l\) => l\.id === listingId\);[\s\S]*?value: BigInt\(listing\.price\),/,
    "Одиночная покупка marketplace должна отправлять value равный цене лота в wei.",
  );

  assert.match(
    source,
    /const totalPrice = selectedListings\.reduce\(\(sum, listing\) => sum \+ BigInt\(listing\.price\), 0n\);[\s\S]*?value: totalPrice,/,
    "Batch-покупка marketplace должна отправлять суммарный value выбранных лотов.",
  );
});
