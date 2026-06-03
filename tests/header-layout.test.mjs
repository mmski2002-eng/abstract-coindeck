import test from "node:test";
import assert from "node:assert/strict";
import { read } from "./helpers.mjs";

test("header nav не содержит пустой network-badge и не обрезает sticker-тени вкладок", () => {
  const source = read("frontend/src/components/MarketingHome.tsx");

  assert.equal(source.includes('id="network-badge"'), false, "В шапке не должно быть пустого network-badge контейнера.");
  assert.match(
    source,
    /<nav className="flex max-w-full items-center gap-1\.5 overflow-x-auto scrollbar-hide" style=\{\{ padding: "2px 8px 8px 2px", marginBottom: -8 \}\}>/,
    "Desktop nav должен иметь внутренний padding, чтобы не клипать тени последней вкладки.",
  );
  assert.match(
    source,
    /className="flex shrink-0 items-center gap-1\.5 transition-all"/,
    "Кнопки desktop nav должны быть shrink-0, чтобы вкладка Admin не сжималась и не выглядела обрезанной.",
  );
});
