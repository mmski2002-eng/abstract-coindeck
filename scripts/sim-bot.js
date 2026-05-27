#!/usr/bin/env node
/**
 * sim-bot.js — One-time setup for sim wallets.
 * Per wallet: faucet → register → buy 6 chests → open → lineup(5) → list(1)
 *
 * Groups (0-indexed):
 *   0-99:   Common chests  → list price 0.10-0.30 MOVE
 *   100-199: Rare chests   → list price 1.00-2.00 MOVE
 *   200-299: Epic chests   → list price 0.30-0.50 MOVE
 *
 * Usage:
 *   node sim-bot.js [count=1] [concurrency=3]
 *
 * State saved to scripts/data/sim-state.json — resumable on re-run.
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
const FAUCET   = process.env.FAUCET_URL || activeNetwork.urls.faucetUrl;
const TOTAL    = parseInt(process.argv[2] ?? "1",  10);
const CONCURR  = parseInt(process.argv[3] ?? "3",  10);
const DELAY_MS = 700;

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: REST_URL }));

// ── Paths ─────────────────────────────────────────────────────────────────────
const DATA_DIR   = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "sim-state.json");

// ── Nick generation ───────────────────────────────────────────────────────────
const ADJS = [
  "Red","Blue","Dark","Fast","Gold","Iron","Wild","Bold","Keen","Cool",
  "Grim","Jade","Sage","Rust","Cyan","Lime","Snow","Warm","Cold","Neon",
  "Void","Grey","Teal","Navy","Rose","Salt","Dusk","Dawn","Dust","Ash",
  "Swift","Sharp","Brave","Grand","Deep","Lone","Free","High","Prime","True",
  "Steel","Storm","Flame","Frost","Stone","Night","Blaze","Spark","Razor","Ghost",
];
const NOUNS = [
  "Fox","Wolf","Bear","Hawk","Bull","Lion","Stag","Crow","Lynx","Swan",
  "Boar","Hare","Kite","Wren","Deer","Dove","Wasp","Crab","Moth","Toad",
  "Pike","Mink","Drake","Raven","Finch","Viper","Crane","Otter","Moose","Eagle",
  "Shark","Trout","Stoat","Badger","Gecko","Ibis","Quail","Cobra","Bison","Panda",
  "Tiger","Falcon","Jaguar","Condor","Osprey","Lemur","Ranger","Hunter","Knight","Nomad",
];

// Deterministic unique list: iterate adj×noun in order
function buildNickList(count) {
  const list = [];
  outer: for (let ai = 0; ai < ADJS.length; ai++) {
    for (let ni = 0; ni < NOUNS.length; ni++) {
      if (list.length >= count) break outer;
      list.push(ADJS[ai] + NOUNS[ni]);
    }
  }
  if (list.length < count) throw new Error(`Not enough nick combos (${list.length} < ${count})`);
  return list;
}

// ── State helpers ─────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return {}; }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Patch one wallet entry atomically
function patch(state, idx, update) {
  state[idx] = { ...(state[idx] ?? {}), ...update };
  saveState(state);
}

// ── Chain helpers ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function faucet(address) {
  const res = await fetch(`${FAUCET}/mint?amount=200000000&address=${address}`, { method: "POST" });
  if (!res.ok) throw new Error(`Faucet HTTP ${res.status}: ${await res.text()}`);
  const hashes = await res.json();
  for (const h of (Array.isArray(hashes) ? hashes : [])) {
    try { await aptos.waitForTransaction({ transactionHash: h, options: { timeoutSecs: 30 } }); }
    catch { /* already finalized */ }
  }
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

async function view(fn, args = []) {
  const res = await fetch(`${REST_URL}/view`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
  });
  if (!res.ok) throw new Error(`View ${fn} HTTP ${res.status}`);
  return res.json();
}

async function getChests(addr) {
  const r = await view(`${MODULE}::fantasy_league::get_chest_nft_addrs`, [addr]);
  return Array.isArray(r[0]) ? r[0] : [];
}

async function getCards(addr) {
  const r = await view(`${MODULE}::fantasy_league::get_user_card_addrs`, [addr]);
  return Array.isArray(r[0]) ? r[0] : [];
}

// ── Group helpers ─────────────────────────────────────────────────────────────
function group(idx) {
  if (idx <= 99)  return 0; // Common
  if (idx <= 199) return 1; // Rare
  return 2;                  // Epic
}

const CHEST_NAMES = ["Common", "Rare", "Epic"];

// Listing price in octas per user spec:
//   Group 0 (common cards): 0.10-0.30 MOVE
//   Group 1 (rare cards):   1.00-2.00 MOVE
//   Group 2 (epic cards):   0.30-0.50 MOVE
function listPrice(g) {
  const r = Math.random();
  if (g === 0) return Math.round((0.10 + r * 0.20) * 1e8);
  if (g === 1) return Math.round((1.00 + r * 1.00) * 1e8);
  return             Math.round((0.30 + r * 0.20) * 1e8);
}

// ── Per-wallet runner ─────────────────────────────────────────────────────────
async function runBot(idx, nick, state) {
  const s   = state[idx] ?? {};
  const log = msg => console.log(`[${String(idx).padStart(3, "0")} ${nick.padEnd(14)}] ${msg}`);

  // Load or generate account
  let account;
  if (s.privateKey) {
    account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(s.privateKey), legacy: true });
  } else {
    account = Account.generate();
    const g = group(idx);
    patch(state, idx, {
      address:    account.accountAddress.toString(),
      privateKey: account.privateKey.toString(),
      nick,
      group: g,
    });
    log(`new wallet ${account.accountAddress.toString().slice(0, 14)}... group=${CHEST_NAMES[g]}`);
  }

  const addr = account.accountAddress.toString();
  const g    = group(idx);

  try {
    // Step 1: Faucet
    if (!s.fauceted) {
      log("faucet...");
      await faucet(addr);
      await sleep(DELAY_MS);
      patch(state, idx, { fauceted: true });
      log("faucet ✓");
    }

    // Step 2: Register (create_inventory with nickname)
    if (!s.registered) {
      log("register...");
      const nickBytes = "0x" + Buffer.from(nick, "ascii").toString("hex");
      await tx(account, `${MODULE}::fantasy_league::create_inventory`, [nickBytes]);
      await sleep(DELAY_MS);
      patch(state, idx, { registered: true });
      log(`registered nick="${nick}" ✓`);
    }

    // Step 3: Buy 6 chests
    if (!s.chestsBought) {
      log(`buy 6 ${CHEST_NAMES[g]} chests...`);
      await tx(account, `${MODULE}::fantasy_league::buy_chest`, [g, "6"]);
      await sleep(DELAY_MS);
      patch(state, idx, { chestsBought: true });
      log("chests bought ✓");
    }

    // Step 4: Open chests (batch)
    if (!s.chestsOpened) {
      const chests = await getChests(addr);
      if (chests.length === 0) throw new Error("no chests found — did buy succeed?");
      log(`open ${chests.length} chests (batch)...`);
      const chestAddrs = chests.map(a => AccountAddress.fromString(a));
      await tx(account, `${MODULE}::fantasy_league::open_chest_batch`, [chestAddrs]);
      await sleep(DELAY_MS);
      patch(state, idx, { chestsOpened: true });
      log("chests opened ✓");
    }

    // Step 5: Lineup (first 5 cards)
    if (!s.initialLineup) {
      const cards = await getCards(addr);
      if (cards.length < 5) throw new Error(`only ${cards.length} cards, need 5`);
      log(`lineup with ${cards.length} cards (using first 5)...`);
      const lineupCards = cards.slice(0, 5);
      const lineupAddrs = lineupCards.map(a => AccountAddress.fromString(a));
      await tx(account, `${MODULE}::tournament::submit_lineup`, [lineupAddrs]);
      await sleep(DELAY_MS);
      const today = new Date().toISOString().slice(0, 10);
      patch(state, idx, { initialLineup: true, lineupCards, lastLineupDate: today });
      log("lineup ✓");

      // Step 6: List 6th card
      if (cards.length >= 6) {
        const sellCard = cards[5];
        const price    = listPrice(g);
        log(`list card[5] @ ${(price / 1e8).toFixed(2)} MOVE...`);
        await tx(account, `${MODULE}::marketplace::list_card`, [
          AccountAddress.fromString(sellCard),
          String(price),
        ]);
        await sleep(DELAY_MS);
        patch(state, idx, { listed: true, listedCard: sellCard });
        log("listed ✓");
      } else {
        log("only 5 cards — no listing");
        patch(state, idx, { listed: true });
      }
    }

    log("ALL DONE ✓");

  } catch (e) {
    const msg = e.message ?? String(e);
    log(`ERROR: ${msg}`);
    patch(state, idx, { lastError: msg });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (TOTAL > 300) {
    console.error("Max 300 bots. Usage: node sim-bot.js [count=1] [concurrency=3]");
    process.exit(1);
  }

  const nicks = buildNickList(300);
  const state = loadState();

  const existing = Object.keys(state).length;
  console.log(`sim-bot: ${TOTAL} bots, concurrency ${CONCURR}${existing ? ` (${existing} existing in state)` : ""}`);
  console.log(`  0-99:   Common chests → list 0.10-0.30 MOVE`);
  console.log(`  100-199: Rare chests  → list 1.00-2.00 MOVE`);
  console.log(`  200-299: Epic chests  → list 0.30-0.50 MOVE`);
  console.log();

  for (let i = 0; i < TOTAL; i += CONCURR) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURR, TOTAL); j++) {
      batch.push(runBot(j, nicks[j], state));
    }
    await Promise.all(batch);
    if (i + CONCURR < TOTAL) await sleep(500);
  }

  const done   = Object.values(state).filter(s => s.initialLineup).length;
  const errors = Object.values(state).filter(s => s.lastError).length;
  console.log(`\nDone. ${done} completed, ${errors} errors. State: ${STATE_FILE}`);
})();
