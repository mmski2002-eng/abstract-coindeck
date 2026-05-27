#!/usr/bin/env node
/**
 * MoveInvestor daily lineup bot.
 * Submits lineup for all 300 sim-wallets once per day.
 * Skips rest days (day 7 / isRestDay=true) and inactive tournaments.
 * Safe to run multiple times — checks has_lineup_for_day before submitting.
 *
 * Usage (cron, daily):
 *   node scripts/daily_lineup_bot.js --execute
 */

const fs = require("fs");
const path = require("path");
const sdk = require(path.join(__dirname, "../frontend/node_modules/@aptos-labs/ts-sdk"));
const addressBook = require(path.join(__dirname, "../frontend/src/config/project-addresses.json"));

const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } = sdk;
const activeNetwork = addressBook.networks[addressBook.activeNetwork];

const MODULE   = process.env.MODULE_ADDR || process.env.CONTRACT_ADDRESS || activeNetwork.contracts.moduleAddress;
const REST_URL = process.env.REST_URL    || activeNetwork.urls.restUrl;
const STATE_FILE = process.env.BOT_STATE_FILE || path.join(__dirname, "data", "loadtest-wallets.json");
const CONCURRENCY  = parseInt(process.env.BOT_CONCURRENCY   || "8",  10);
const TX_WAIT_SECS = parseInt(process.env.BOT_TX_WAIT_SECS  || "40", 10);
const BETWEEN_MS   = parseInt(process.env.BOT_BETWEEN_TX_MS || "400", 10);
const LINEUP_COUNT = 5;

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: REST_URL }));

// ── helpers ──────────────────────────────────────────────────────────────────

async function view(fn, args = []) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(`${REST_URL}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${REST_URL}/view: ${await resp.text()}`);
      const json = await resp.json();
      return Array.isArray(json) ? json : json?.value ?? [];
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(500 * (attempt + 1));
    }
  }
}

async function getTournamentState() {
  const r = await view(`${MODULE}::tournament::get_state`);
  return {
    running:   !!r[0],
    epoch:     parseInt(r[1], 10),
    day:       parseInt(r[2], 10),
    isRestDay: !!r[3],
  };
}

async function hasLineupForDay(address, day) {
  const r = await view(`${MODULE}::tournament::has_lineup_for_day`, [address, String(day)]);
  return !!r[0];
}

async function getCardAddrs(address) {
  const r = await view(`${MODULE}::fantasy_league::get_user_card_addrs`, [address]);
  return r[0] ?? [];
}

async function submitTx(account, fnId, args) {
  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: fnId, typeArguments: [], functionArguments: args },
  });
  const auth = aptos.transaction.sign({ signer: account, transaction: txn });
  const submitted = await aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: auth });
  await aptos.waitForTransaction({ transactionHash: submitted.hash, options: { timeoutSecs: TX_WAIT_SECS } });
  return submitted.hash;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(walletId, msg) {
  console.log(`[${walletId}] ${msg}`);
}

// ── per-wallet ────────────────────────────────────────────────────────────────

async function processWallet(record, day, execute) {
  const privKey = new Ed25519PrivateKey(record.privateKey);
  const account = Account.fromPrivateKey({ privateKey: privKey });
  const address = account.accountAddress.toString();

  const already = await hasLineupForDay(address, day);
  if (already) {
    log(record.id, `lineup already submitted for day ${day}, skipping`);
    return;
  }

  const cards = await getCardAddrs(address);
  if (cards.length < LINEUP_COUNT) {
    log(record.id, `only ${cards.length} cards, need ${LINEUP_COUNT} — skipping`);
    return;
  }

  const lineup = cards.slice(0, LINEUP_COUNT);
  log(record.id, `submit_lineup day=${day} cards=${lineup.length}`);

  if (!execute) {
    log(record.id, "[dry-run] submit_lineup");
    return;
  }

  const hash = await submitTx(account, `${MODULE}::tournament::submit_lineup`, [lineup]);
  log(record.id, `done hash=${hash.slice(0, 12)}...`);
}

// ── pool ──────────────────────────────────────────────────────────────────────

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      await worker(items[idx]);
      await sleep(BETWEEN_MS);
    }
  }));
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const execute = process.argv.includes("--execute");

  if (!fs.existsSync(STATE_FILE)) {
    console.error(`State file not found: ${STATE_FILE}`);
    process.exit(1);
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  const wallets = (state.wallets ?? []).filter(w => w.privateKey);
  console.log(`Loaded ${wallets.length} wallets from ${STATE_FILE}`);

  const tn = await getTournamentState();
  console.log(`Tournament: running=${tn.running}, epoch=${tn.epoch}, day=${tn.day}, restDay=${tn.isRestDay}`);

  if (!tn.running) { console.log("Tournament not running — exiting."); return; }
  if (tn.isRestDay) { console.log("Rest day — skipping lineup."); return; }
  if (tn.day < 1)  { console.log(`Day ${tn.day} not yet playable — exiting.`); return; }

  if (!execute) {
    console.log(`\nDry-run. Would submit lineup for day ${tn.day} for ${wallets.length} wallets.`);
    console.log("Run with --execute to submit for real.");
    return;
  }

  console.log(`\nSubmitting lineups for day ${tn.day}...`);
  let ok = 0, skip = 0, err = 0;

  await runPool(wallets, CONCURRENCY, async (record) => {
    try {
      const before = ok + skip;
      await processWallet(record, tn.day, execute);
      if (ok + skip === before) skip++;
      else ok++;
    } catch (e) {
      err++;
      console.error(`[${record.id}] ERROR: ${e?.message ?? e}`);
    }
  });

  console.log(`\nFinished: submitted=${ok}, skipped=${skip}, errors=${err}`);
}

main().catch(e => { console.error(e?.stack || e?.message || e); process.exit(1); });
