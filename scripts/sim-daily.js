#!/usr/bin/env node
/**
 * sim-daily.js — Submit lineup for all sim bots once per day.
 * Run via cron or PM2. Exits after epoch day 6.
 *
 * Usage:
 *   node sim-daily.js [concurrency=5]
 *
 * Skips wallets that already submitted today.
 * Exits cleanly when epoch is over.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const sdk  = require(path.join(__dirname, "../frontend/node_modules/@aptos-labs/ts-sdk"));
const addressBook = require(path.join(__dirname, "../frontend/src/config/project-addresses.json"));
const { Aptos, AptosConfig, Network, Account, AccountAddress, Ed25519PrivateKey } = sdk;
const activeNetwork = addressBook.networks[addressBook.activeNetwork];

// ── Config ────────────────────────────────────────────────────────────────────
const MODULE   = process.env.MODULE_ADDR || process.env.CONTRACT_ADDRESS || activeNetwork.contracts.moduleAddress;
const REST_URL = process.env.REST_URL || activeNetwork.urls.restUrl;
const CONCURR  = parseInt(process.argv[2] ?? "5", 10);
const DELAY_MS = 500;

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: REST_URL }));
const STATE_FILE = path.join(__dirname, "data", "sim-state.json");

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadState() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function tx(account, fn, args) {
  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: fn, typeArguments: [], functionArguments: args },
  });
  const signed = aptos.transaction.sign({ signer: account, transaction: txn });
  const res    = await aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: signed });
  await aptos.waitForTransaction({ transactionHash: res.hash, options: { timeoutSecs: 60 } });
  return res.hash;
}

// Returns { running, epoch, day } from on-chain state
async function getEpochState() {
  const res = await fetch(`${REST_URL}/view`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      function:        `${MODULE}::tournament::get_state`,
      type_arguments:  [],
      arguments:       [],
    }),
  });
  if (!res.ok) throw new Error(`get_state HTTP ${res.status}`);
  const data = await res.json();
  return {
    running: data[0] === true || data[0] === "true",
    epoch:   Number(data[1] ?? 1),
    day:     Number(data[2] ?? 0),
  };
}

// ── Per-wallet lineup submit ───────────────────────────────────────────────────
async function submitLineup(idx, s, state, today) {
  const log = msg => console.log(`[${String(idx).padStart(3, "0")} ${(s.nick ?? "?").padEnd(14)}] ${msg}`);

  if (!s.initialLineup || !Array.isArray(s.lineupCards) || s.lineupCards.length < 5) {
    log("skip (setup not done)");
    return;
  }

  if (s.lastLineupDate === today) {
    log("skip (already done today)");
    return;
  }

  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(s.privateKey),
    legacy:     true,
  });

  try {
    const addrs = s.lineupCards.map(a => AccountAddress.fromString(a));
    await tx(account, `${MODULE}::tournament::submit_lineup`, [addrs]);
    await sleep(DELAY_MS);
    state[idx] = { ...s, lastLineupDate: today };
    saveState(state);
    log("lineup ✓");
  } catch (e) {
    log(`ERROR: ${e.message ?? e}`);
    // Don't update lastLineupDate — retry next run
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(STATE_FILE)) {
    console.error("sim-state.json not found. Run sim-bot.js first.");
    process.exit(1);
  }

  // Check on-chain epoch state
  let epochState;
  try {
    epochState = await getEpochState();
  } catch (e) {
    console.error(`Failed to get epoch state: ${e.message}`);
    process.exit(1);
  }

  const { running, epoch, day } = epochState;
  console.log(`Epoch state: running=${running} epoch=${epoch} day=${day}`);

  if (!running || day > 6) {
    console.log("Epoch over or not running. Nothing to do.");
    process.exit(0);
  }

  const state   = loadState();
  const today   = new Date().toISOString().slice(0, 10);
  const indices = Object.keys(state)
    .map(Number)
    .filter(i => state[i]?.initialLineup && Array.isArray(state[i]?.lineupCards))
    .sort((a, b) => a - b);

  const alreadyDone = indices.filter(i => state[i].lastLineupDate === today).length;
  const toRun       = indices.length - alreadyDone;

  console.log(`Today: ${today} | ${toRun} to submit, ${alreadyDone} already done`);
  if (toRun === 0) {
    console.log("All done for today.");
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < indices.length; i += CONCURR) {
    const batch = indices.slice(i, i + CONCURR);
    await Promise.all(batch.map(async idx => {
      const before = state[idx].lastLineupDate;
      await submitLineup(idx, state[idx], state, today);
      if (state[idx].lastLineupDate === today && before !== today) ok++;
      else if (state[idx].lastLineupDate !== today) fail++;
    }));
    await sleep(300);
  }

  console.log(`\nDone. ${ok} submitted, ${fail} failed, ${alreadyDone} skipped.`);
})();
