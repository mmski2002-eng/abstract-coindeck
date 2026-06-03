import test from "node:test";
import assert from "node:assert/strict";
import { listFiles, read, readJson, solidityConstants, tsNumberConstants } from "./helpers.mjs";

test("Solidity contracts имеют SPDX, pragma и базовую security-структуру", () => {
  const files = listFiles("contracts/contracts", [".sol"]);
  assert.equal(files.length >= 6, true, "Ожидались Solidity контракты миграции.");

  for (const file of files) {
    const source = read(file);
    assert.match(source, /SPDX-License-Identifier:\s*MIT/, `${file}: нет SPDX MIT.`);
    assert.match(source, /pragma solidity \^0\.8\.24;/, `${file}: pragma должен быть ^0.8.24.`);
  }

  const admin = read("contracts/contracts/AdminControl.sol");
  assert.match(admin, /contract AdminControl is Ownable, ReentrancyGuard/);
  assert.match(admin, /MIN_TREASURY_DELAY\s*=\s*1 hours/);
  assert.match(admin, /function queueAction\(uint8 actionType, bytes32 payloadHash\) external/);
  assert.match(admin, /function consumeAction\(uint8 actionType, bytes32 payloadHash\) external/);

  const tournament = read("contracts/contracts/Tournament.sol");
  assert.match(tournament, /contract Tournament is ReentrancyGuard/);
  assert.match(tournament, /uint256 public constant SLOTS\s*=\s*5;/);
  assert.match(tournament, /uint256 public constant EPOCH_DAYS\s*=\s*6;/);
});

test("ACTION_* constants синхронизированы между AdminControl.sol и frontend evmContracts.ts", () => {
  const solidity = solidityConstants(read("contracts/contracts/AdminControl.sol"));
  const frontend = tsNumberConstants(read("frontend/src/lib/evmContracts.ts"));

  const expected = [
    "ACTION_SET_BASE_URIS",
    "ACTION_SET_EGG_PRICES",
    "ACTION_ADMIN_MINT_TO",
    "ACTION_RESET_ALL_ORACLE_DAYS",
    "ACTION_TREASURY_WITHDRAW",
    "ACTION_SET_CLAIM_DAYS",
    "ACTION_SET_CLAIM_LIST",
    "ACTION_START_CLAIM",
    "ACTION_CLOSE_CLAIM",
    "ACTION_STOP_AND_RESET",
  ];

  for (const name of expected) {
    assert.equal(frontend.has(name), true, `frontend/src/lib/evmContracts.ts не содержит ${name}`);
    assert.equal(solidity.has(name), true, `AdminControl.sol не содержит ${name}`);
    assert.equal(frontend.get(name), solidity.get(name), `${name} различается между frontend и Solidity.`);
  }
});

test("contracts/package.json test script не является заглушкой", () => {
  const pkg = readJson("contracts/package.json");
  assert.equal(typeof pkg.scripts?.test, "string", "contracts/package.json должен иметь scripts.test.");
  assert.equal(pkg.scripts.test.includes("Error: no test specified"), false, "contracts npm test все еще заглушка.");
  assert.equal(pkg.scripts.test.includes("exit 1"), false, "contracts npm test не должен всегда падать.");
});
