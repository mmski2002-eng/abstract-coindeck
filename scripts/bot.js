#!/usr/bin/env node
// Bot: generates N wallets, funds, registers, buys+opens 6 chests, submits 5-card lineup,
// lists 6th card on marketplace.
// Bots 1-100:   Wooden Chest (type 0) — Common/Rare cards
// Bots 101-200: Iron Chest   (type 1) — Rare/Epic cards
// Bots 201-300: Silver Chest (type 2) — Epic/Legendary cards
// Listing prices: tier 0 → 0.1-0.2 MOVE, tier 1 → 0.3-0.5 MOVE, tier 2-3 → 1-2 MOVE
//
// Wallets saved to scripts/data/bot-wallets.json after generation.
// Re-run: existing wallets are reused (skip create_inventory, get fresh faucet funds).

const fs   = require("fs");
const path = require("path");
const sdk  = require(path.join(__dirname, "../frontend/node_modules/@aptos-labs/ts-sdk"));
const addressBook = require(path.join(__dirname, "../frontend/src/config/project-addresses.json"));
const { Aptos, AptosConfig, Network, Account, AccountAddress, Ed25519PrivateKey } = sdk;
const activeNetwork = addressBook.networks[addressBook.activeNetwork];

const MODULE   = process.env.MODULE_ADDR || process.env.CONTRACT_ADDRESS || activeNetwork.contracts.moduleAddress;
const REST_URL = process.env.REST_URL || activeNetwork.urls.restUrl;
const FAUCET   = process.env.FAUCET_URL || activeNetwork.urls.faucetUrl;
const BOTS     = parseInt(process.argv[2] ?? "300", 10);
const DELAY_MS = 600;

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: REST_URL }));

const ADJS = [
  "Red","Blue","Dark","Fast","Gold","Iron","Wild","Bold","Keen","Cool",
  "Grim","Jade","Sage","Rust","Cyan","Lime","Snow","Warm","Cold","Neon",
  "Void","Grey","Teal","Navy","Rose","Salt","Dusk","Dawn","Dust","Ash",
  "Fog","Oak","Ink","Ice","Tar","Wax","Dry","Raw","Old","New",
];
const NOUNS = [
  "Fox","Wolf","Bear","Hawk","Bull","Lion","Stag","Crow","Lynx","Swan",
  "Boar","Hare","Kite","Wren","Deer","Dove","Wasp","Crab","Moth","Toad",
  "Pike","Mink","Drake","Bison","Raven","Finch","Viper","Crane","Otter","Bison",
  "Moose","Eagle","Shark","Trout","Bream","Stoat","Badger","Gecko","Ibis","Quail",
];

function randomNick() {
  const adj  = ADJS[Math.floor(Math.random() * ADJS.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const nick = adj + noun;
  return nick.length <= 10 ? nick : nick.slice(0, 10);
}

// price in octas: tier 0 → 0.1-0.2 MOVE, tier 1 → 0.3-0.5 MOVE, tier 2-3 → 1-2 MOVE
function listingPrice(tier) {
  const rand = Math.random();
  if (tier === 0) return Math.floor((0.1 + rand * 0.1) * 1e8);
  if (tier === 1) return Math.floor((0.3 + rand * 0.2) * 1e8);
  return Math.floor((1.0 + rand * 1.0) * 1e8);
}

function chestTypeForBot(idx) {
  if (idx <= 100) return 0; // Wooden
  if (idx <= 200) return 1; // Iron
  return 2;                 // Silver
}

const CHEST_NAMES = ["Wooden", "Iron", "Silver"];
const WALLETS_FILE = path.join(__dirname, "data", "bot-wallets.json");

function loadWallets() {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      const list = JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
      // index by idx for fast lookup
      const map = new Map();
      for (const w of list) map.set(w.idx, w);
      return map;
    }
  } catch {}
  return new Map();
}

function saveWallets(map) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  const list = Array.from(map.values()).sort((a, b) => a.idx - b.idx);
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(list, null, 2), "utf8");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function faucet(address) {
  const res = await fetch(`${FAUCET}/mint?amount=200000000&address=${address}`, { method: "POST" });
  if (!res.ok) throw new Error(`Faucet HTTP ${res.status}`);
  const hashes = await res.json();
  for (const h of hashes) {
    try { await aptos.waitForTransaction({ transactionHash: h, options: { timeoutSecs: 30 } }); }
    catch { /* faucet txs sometimes already finalized */ }
  }
}

async function tx(account, fn, args) {
  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: fn, typeArguments: [], functionArguments: args },
  });
  const signed = aptos.transaction.sign({ signer: account, transaction: txn });
  const res = await aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: signed });
  await aptos.waitForTransaction({ transactionHash: res.hash, options: { timeoutSecs: 30 } });
  return res.hash;
}

async function view(fn, args = []) {
  const res = await fetch(`${REST_URL}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
  });
  return res.json();
}

async function getChests(addr) {
  const res = await view(`${MODULE}::fantasy_league::get_chest_nft_addrs`, [addr]);
  return res[0] ?? [];
}

async function getCards(addr) {
  const res = await view(`${MODULE}::fantasy_league::get_user_card_addrs`, [addr]);
  return res[0] ?? [];
}

async function getCardTier(cardAddr) {
  try {
    const res = await view(`${MODULE}::fantasy_league::get_card_info`, [cardAddr]);
    return Number(res[1] ?? 0);
  } catch {
    return 0;
  }
}

async function runBot(idx, walletMap) {
  const saved     = walletMap.get(idx);
  let   account;
  let   nick;

  if (saved) {
    account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(saved.privateKey) });
    nick    = saved.nick;
  } else {
    account = Account.generate();
    nick    = randomNick();
    // Save immediately so wallet is never lost even if bot fails later
    walletMap.set(idx, { idx, address: account.accountAddress.toString(), privateKey: account.privateKey.toString(), nick });
    saveWallets(walletMap);
  }

  const addr      = account.accountAddress.toString();
  const nickHex   = '0x' + Buffer.from(nick).toString('hex');
  const chestType = chestTypeForBot(idx);
  const log       = (msg) => console.log(`[bot${idx}] ${msg}`);

  try {
    log(`addr=${addr} nick=${nick} chest=${CHEST_NAMES[chestType]}${saved ? " [reuse]" : " [new]"}`);

    // 1. Fund
    await faucet(addr);
    await sleep(DELAY_MS);

    // 2. Register (new wallets only — existing ones already have inventory)
    if (!saved) {
      await tx(account, `${MODULE}::fantasy_league::create_inventory`, [nickHex]);
      await sleep(DELAY_MS);
    }

    // 3. Buy 6 chests
    await tx(account, `${MODULE}::fantasy_league::buy_chest`, [chestType, "6"]);
    await sleep(DELAY_MS);

    // 4. Open all 6 chests
    const chests = await getChests(addr);
    log(`opening ${chests.length} chests...`);
    for (const chestAddr of chests) {
      await tx(account, `${MODULE}::fantasy_league::open_chest`, [chestAddr]);
      await sleep(DELAY_MS);
    }

    // 5. Submit lineup with first 5 cards
    const cards = await getCards(addr);
    if (cards.length < 5) { log(`only ${cards.length} cards — skipping lineup`); return; }
    const lineup = cards.slice(0, 5).map(a => AccountAddress.fromString(a));
    await tx(account, `${MODULE}::tournament::submit_lineup`, [lineup]);
    await sleep(DELAY_MS);

    // 6. List 6th card on marketplace
    if (cards.length >= 6) {
      const sellCard = cards[5];
      const tier     = await getCardTier(sellCard);
      const price    = listingPrice(tier);
      await tx(account, `${MODULE}::marketplace::list_card`, [
        AccountAddress.fromString(sellCard),
        String(price),
      ]);
      log(`listed card ${sellCard.slice(0, 8)} tier=${tier} price=${(price / 1e8).toFixed(2)} MOVE`);
    } else {
      log("only 5 cards — no listing");
    }

    log("✓ done");
  } catch (e) {
    console.error(`[bot${idx}] ERROR: ${e.message ?? e}`);
  }
}

(async () => {
  console.log(`Launching ${BOTS} bots on testnet...`);
  console.log(`  bots   1-100: Wooden Chest`);
  console.log(`  bots 101-200: Iron Chest`);
  console.log(`  bots 201-300: Silver Chest`);

  const walletMap = loadWallets();
  const existing  = walletMap.size;
  if (existing > 0) console.log(`  loaded ${existing} existing wallets from ${WALLETS_FILE}`);

  const CONCURRENCY = 3;
  for (let i = 0; i < BOTS; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, BOTS); j++) {
      batch.push(runBot(j + 1, walletMap));
    }
    await Promise.all(batch);
    if (i + CONCURRENCY < BOTS) await sleep(1000);
  }

  console.log("All bots finished.");
  console.log(`Wallets saved to ${WALLETS_FILE}`);
})();
