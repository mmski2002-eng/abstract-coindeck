#!/usr/bin/env node
/**
 * MoveInvestor load-test bot for Movement testnet.
 *
 * What it does when started with --execute:
 * 1. Generates and persists wallets for future reuse.
 * 2. Tops them up from faucet if balance is too low.
 * 3. Creates on-chain inventory with human-readable nicknames.
 * 4. Buys 6 chests per wallet:
 *    - 100 wallets of chest type 0 (Common)
 *    - 100 wallets of chest type 1 (Rare)
 *    - 100 wallets of chest type 2 (Epic)
 * 5. Opens all 6 chests.
 * 6. Submits 5 cards into the current tournament day.
 * 7. Lists the 6th card on the marketplace.
 *
 * Important:
 * - The script does NOTHING destructive by default.
 * - Real execution requires --execute.
 * - Generated private keys are stored locally in scripts/data/loadtest-wallets.json.
 */

const fs = require("fs");
const path = require("path");
const sdk = require(path.join(__dirname, "../frontend/node_modules/@aptos-labs/ts-sdk"));
const addressBook = require(path.join(__dirname, "../frontend/src/config/project-addresses.json"));

const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } = sdk;
const activeNetwork = addressBook.networks[addressBook.activeNetwork];

const MODULE = process.env.MODULE_ADDR || process.env.CONTRACT_ADDRESS || activeNetwork.contracts.moduleAddress;
const REST_URL = process.env.REST_URL || activeNetwork.urls.restUrl;
const FAUCET_URL = process.env.FAUCET_URL || activeNetwork.urls.faucetUrl;
const STATE_FILE = process.env.BOT_STATE_FILE || path.join(__dirname, "data", "loadtest-wallets.json");

const DEFAULT_COHORTS = [
  { key: "tier1", chestType: 0, wallets: 100, minListPriceMove: 0.1, maxListPriceMove: 0.2 },
  { key: "tier2", chestType: 1, wallets: 100, minListPriceMove: 0.5, maxListPriceMove: 1.0 },
  { key: "tier3", chestType: 2, wallets: 100, minListPriceMove: 5.0, maxListPriceMove: 20.0 },
];

const CHESTS_PER_WALLET = 6;
const LINEUP_CARD_COUNT = 5;
const DEFAULT_CONCURRENCY = parseInt(process.env.BOT_CONCURRENCY || "4", 10);
const DEFAULT_FAUCET_AMOUNT = parseInt(process.env.BOT_FAUCET_AMOUNT || "200000000", 10); // 2 MOVE
const GAS_RESERVE = parseInt(process.env.BOT_GAS_RESERVE || "30000000", 10); // 0.3 MOVE
const TX_WAIT_SECS = parseInt(process.env.BOT_TX_WAIT_SECS || "40", 10);
const BETWEEN_TX_MS = parseInt(process.env.BOT_BETWEEN_TX_MS || "800", 10);
const BETWEEN_WALLETS_MS = parseInt(process.env.BOT_BETWEEN_WALLETS_MS || "500", 10);
const NICK_MAX_BYTES = 14;

const WORD_LEFT = [
  "amber", "brave", "calm", "cedar", "delta", "ember", "frost", "gold", "harbor", "ivory",
  "jolly", "lunar", "mango", "navy", "olive", "proud", "quiet", "river", "solar", "velvet",
  "vivid", "wise", "young", "zesty", "urban", "noble", "swift", "fresh", "kind", "royal",
];

const WORD_RIGHT = [
  "ant", "bear", "bird", "cloud", "crest", "dawn", "drift", "field", "flame", "fox",
  "glade", "grove", "hawk", "jade", "leaf", "light", "mist", "otter", "pine", "ridge",
  "river", "stone", "trail", "wave", "whale", "wolf", "wood", "wren", "brook", "spark",
];

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: REST_URL }));

function parseArgs(argv) {
  const out = {
    execute: false,
    stateFile: STATE_FILE,
    concurrency: DEFAULT_CONCURRENCY,
    faucetAmount: DEFAULT_FAUCET_AMOUNT,
    allowNoTournament: false,
    cohort: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") out.execute = true;
    else if (arg === "--allow-no-tournament") out.allowNoTournament = true;
    else if (arg === "--state-file" && argv[i + 1]) out.stateFile = argv[++i];
    else if (arg === "--concurrency" && argv[i + 1]) out.concurrency = parseInt(argv[++i], 10);
    else if (arg === "--faucet-amount" && argv[i + 1]) out.faucetAmount = parseInt(argv[++i], 10);
    else if (arg === "--cohort" && argv[i + 1]) out.cohort = argv[++i];
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function loadState(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      version: 1,
      module: MODULE,
      restUrl: REST_URL,
      faucetUrl: FAUCET_URL,
      createdAt: nowIso(),
      wallets: [],
    };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walletFromRecord(record) {
  const privateKey = new Ed25519PrivateKey(record.privateKey);
  return Account.fromPrivateKey({ privateKey, legacy: true });
}

function utf8ByteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function makeNickname(seed) {
  const left = WORD_LEFT[seed % WORD_LEFT.length];
  const right = WORD_RIGHT[Math.floor(seed / WORD_LEFT.length) % WORD_RIGHT.length];
  const suffix = String((seed % 90) + 10);
  let nick = `${left}${right}${suffix}`;
  if (utf8ByteLength(nick) > NICK_MAX_BYTES) {
    nick = `${left.slice(0, 5)}${right.slice(0, 4)}${suffix}`;
  }
  if (utf8ByteLength(nick) > NICK_MAX_BYTES) {
    nick = `${left.slice(0, 4)}${suffix}${right.slice(0, 3)}`;
  }
  return nick;
}

function computeListPriceOctas(cohort, seed) {
  const min = Math.round(cohort.minListPriceMove * 1e8);
  const max = Math.round(cohort.maxListPriceMove * 1e8);
  if (min >= max) return min;
  const span = max - min;
  const offset = seed % (span + 1);
  return min + offset;
}

function createWalletRecord(index, cohort, seed) {
  const account = Account.generate();
  return {
    id: `bot-${cohort.key}-${String(index + 1).padStart(3, "0")}`,
    cohort: cohort.key,
    chestType: cohort.chestType,
    targetChestCount: CHESTS_PER_WALLET,
    targetLineupCount: LINEUP_CARD_COUNT,
    listPriceOctas: computeListPriceOctas(cohort, seed),
    nickname: makeNickname(seed),
    address: account.accountAddress.toString(),
    privateKey: account.privateKey.toAIP80String(),
    createdAt: nowIso(),
    lastUpdatedAt: nowIso(),
    stage: "created",
    notes: [],
    txHashes: {
      faucet: [],
      createInventory: null,
      buyChest: null,
      openChestBatch: null,
      submitLineup: null,
      listCard: null,
    },
    assets: {
      cardAddrs: [],
      chestAddrs: [],
      lineupCardAddrs: [],
      listedCardAddr: null,
      listingId: null,
    },
  };
}

function ensureWalletPool(state) {
  let seed = state.wallets.length;
  for (const cohort of DEFAULT_COHORTS) {
    const current = state.wallets.filter((w) => w.cohort === cohort.key);
    for (let i = current.length; i < cohort.wallets; i += 1) {
      state.wallets.push(createWalletRecord(i, cohort, seed));
      seed += 1;
    }
  }
  state.lastUpdatedAt = nowIso();
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 300)}`);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`JSON parse failed for ${url}: ${text.slice(0, 300)}`);
  }
}

async function view(functionName, args = []) {
  return fetchJson(`${REST_URL}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ function: functionName, type_arguments: [], arguments: args }),
  });
}

async function getCoinBalance(address) {
  const type = encodeURIComponent("0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
  const url = `${REST_URL}/accounts/${address}/resource/${type}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return 0;
  if (!res.ok) {
    throw new Error(`Balance fetch failed for ${address}: HTTP ${res.status}`);
  }
  const json = await res.json();
  return parseInt(json?.data?.coin?.value ?? "0", 10);
}

async function getChestPrices() {
  const result = await view(`${MODULE}::fantasy_league::get_chest_prices`);
  return {
    0: parseInt(result[0], 10),
    1: parseInt(result[1], 10),
    2: parseInt(result[2], 10),
  };
}

async function getTournamentState() {
  const result = await view(`${MODULE}::tournament::get_state`);
  return {
    running: !!result[0],
    epoch: parseInt(result[1], 10),
    day: parseInt(result[2], 10),
    isRestDay: !!result[3],
    startTimestamp: parseInt(result[4], 10),
    prizePool: parseInt(result[5], 10),
    changeFee: parseInt(result[6], 10),
    firstVisibleEpoch: parseInt(result[7], 10),
  };
}

async function hasLineupForDay(address, day) {
  const result = await view(`${MODULE}::tournament::has_lineup_for_day`, [address, String(day)]);
  return !!result[0];
}

async function getCardAddrs(address) {
  const result = await view(`${MODULE}::fantasy_league::get_user_card_addrs`, [address]);
  return result[0] ?? [];
}

async function getChestAddrs(address) {
  const result = await view(`${MODULE}::fantasy_league::get_chest_nft_addrs`, [address]);
  return result[0] ?? [];
}

async function getListings() {
  const countResult = await view(`${MODULE}::marketplace::listing_count`);
  const total = parseInt(countResult?.[0] ?? "0", 10);
  if (!total) return [];
  const PAGE = 500;
  const out = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const page = await view(`${MODULE}::marketplace::get_listings_page`, [String(offset), String(PAGE)]);
    const [ids, sellers, cardAddrs, rawPids, rawTiers, prices] = page;
    const pids = Array.isArray(rawPids) ? rawPids.map(Number)
      : typeof rawPids === "string" ? [...Buffer.from(rawPids.replace(/^0x/, ""), "hex")].map(Number) : [];
    const tiers = Array.isArray(rawTiers) ? rawTiers.map(Number)
      : typeof rawTiers === "string" ? [...Buffer.from(rawTiers.replace(/^0x/, ""), "hex")].map(Number) : [];
    (ids ?? []).forEach((id, idx) => {
      out.push({
        id: parseInt(id, 10),
        seller: sellers[idx],
        cardAddr: cardAddrs[idx],
        playerId: pids[idx] ?? 0,
        tier: tiers[idx] ?? 0,
        price: parseInt(prices[idx], 10),
      });
    });
    if ((ids ?? []).length < PAGE) break;
  }
  return out;
}

async function faucet(address, amount) {
  const url = `${FAUCET_URL}/mint?amount=${amount}&address=${address}`;
  const hashes = await fetchJson(url, { method: "POST" });
  if (!Array.isArray(hashes)) return [];
  for (const hash of hashes) {
    try {
      await aptos.waitForTransaction({ transactionHash: hash, options: { timeoutSecs: TX_WAIT_SECS } });
    } catch {
      // Faucet can finalize before polling starts.
    }
  }
  return hashes;
}

async function sendTx(account, functionName, functionArguments) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: functionName,
      typeArguments: [],
      functionArguments,
    },
  });
  const auth = aptos.transaction.sign({ signer: account, transaction: tx });
  const submitted = await aptos.transaction.submit.simple({
    transaction: tx,
    senderAuthenticator: auth,
  });
  await aptos.waitForTransaction({
    transactionHash: submitted.hash,
    options: { timeoutSecs: TX_WAIT_SECS },
  });
  return submitted.hash;
}

function stageRank(stage) {
  return ["created", "funded", "initialized", "bought", "opened", "lineup_submitted", "listed", "done"].indexOf(stage);
}

function bumpStage(record, nextStage) {
  if (stageRank(nextStage) > stageRank(record.stage)) record.stage = nextStage;
  record.lastUpdatedAt = nowIso();
}

async function processWallet(record, runtime, chestPrices, tournamentStateAtStart) {
  const { execute, faucetAmount, state, stateFile } = runtime;
  const account = walletFromRecord(record);
  const address = record.address;
  const cohort = DEFAULT_COHORTS.find((item) => item.key === record.cohort);
  const log = (msg) => console.log(`[${record.id}] ${msg}`);
  const persist = () => atomicWriteJson(stateFile, state);

  record.lastUpdatedAt = nowIso();
  persist();

  const requiredBalance = chestPrices[record.chestType] * CHESTS_PER_WALLET + GAS_RESERVE;
  const balance = await getCoinBalance(address);
  if (balance < requiredBalance) {
    log(`balance ${balance} < required ${requiredBalance}, requesting faucet`);
    if (!execute) {
      log(`[dry-run] faucet ${faucetAmount}`);
    } else {
      const hashes = await faucet(address, faucetAmount);
      record.txHashes.faucet.push(...hashes);
      bumpStage(record, "funded");
      persist();
      await sleep(BETWEEN_TX_MS);
    }
  } else {
    bumpStage(record, "funded");
    persist();
  }

  const initialized = await view(`${MODULE}::fantasy_league::is_initialized`, [address]).then((r) => !!r[0]);
  if (!initialized) {
    log(`create_inventory nickname=${record.nickname}`);
    if (!execute) {
      log("[dry-run] create_inventory");
    } else {
      // Send nickname directly as string; SDK will handle vector<u8> conversion properly
      record.txHashes.createInventory = await sendTx(
        account,
        `${MODULE}::fantasy_league::create_inventory`,
        [record.nickname],
      );
      bumpStage(record, "initialized");
      persist();
      await sleep(BETWEEN_TX_MS);
    }
  } else {
    bumpStage(record, "initialized");
    persist();
  }

  let chests = await getChestAddrs(address);
  record.assets.chestAddrs = chests;
  persist();

  if (chests.length < CHESTS_PER_WALLET) {
    const missing = CHESTS_PER_WALLET - chests.length;
    log(`buy_chest type=${record.chestType} count=${missing}`);
    if (!execute) {
      log("[dry-run] buy_chest");
    } else {
      record.txHashes.buyChest = await sendTx(
        account,
        `${MODULE}::fantasy_league::buy_chest`,
        [record.chestType, String(missing)],
      );
      bumpStage(record, "bought");
      persist();
      await sleep(BETWEEN_TX_MS);
      chests = await getChestAddrs(address);
      record.assets.chestAddrs = chests;
      persist();
    }
  } else {
    bumpStage(record, "bought");
    persist();
  }

  let cards = await getCardAddrs(address);
  record.assets.cardAddrs = cards;
  persist();

  if (cards.length < CHESTS_PER_WALLET && chests.length > 0) {
    log(`open_chest_batch count=${chests.length}`);
    if (!execute) {
      log("[dry-run] open_chest_batch");
    } else {
      record.txHashes.openChestBatch = await sendTx(
        account,
        `${MODULE}::fantasy_league::open_chest_batch`,
        [chests],
      );
      bumpStage(record, "opened");
      persist();
      await sleep(BETWEEN_TX_MS);
      cards = await getCardAddrs(address);
      chests = await getChestAddrs(address);
      record.assets.cardAddrs = cards;
      record.assets.chestAddrs = chests;
      persist();
    }
  } else if (cards.length >= CHESTS_PER_WALLET) {
    bumpStage(record, "opened");
    persist();
  }

  if (cards.length < CHESTS_PER_WALLET) {
    throw new Error(`expected at least ${CHESTS_PER_WALLET} cards, got ${cards.length}`);
  }

  if (!tournamentStateAtStart.running || tournamentStateAtStart.isRestDay || tournamentStateAtStart.day < 1) {
    if (!runtime.allowNoTournament) {
      throw new Error("tournament is inactive or current day is not playable");
    }
    log("tournament inactive/rest day, skipping lineup submission by flag");
  } else {
    const alreadySubmitted = await hasLineupForDay(address, tournamentStateAtStart.day);
    if (!alreadySubmitted) {
      const lineupCards = cards.slice(0, LINEUP_CARD_COUNT);
      log(`submit_lineup day=${tournamentStateAtStart.day} cards=${lineupCards.length}`);
      if (!execute) {
        log("[dry-run] submit_lineup");
      } else {
        record.txHashes.submitLineup = await sendTx(
          account,
          `${MODULE}::tournament::submit_lineup`,
          [lineupCards],
        );
        record.assets.lineupCardAddrs = lineupCards;
        bumpStage(record, "lineup_submitted");
        persist();
        await sleep(BETWEEN_TX_MS);
      }
    } else {
      record.assets.lineupCardAddrs = cards.slice(0, LINEUP_CARD_COUNT);
      bumpStage(record, "lineup_submitted");
      persist();
    }
  }

  const listings = await getListings();
  const existingListing = listings.find((item) => item.seller.toLowerCase() === address.toLowerCase());
  if (existingListing) {
    record.assets.listedCardAddr = existingListing.cardAddr;
    record.assets.listingId = existingListing.id;
    bumpStage(record, "listed");
    persist();
  } else {
    const listedCardAddr = cards[LINEUP_CARD_COUNT];
    if (!listedCardAddr) throw new Error("missing 6th card for marketplace listing");
    log(`list_card price=${record.listPriceOctas} card=${listedCardAddr.slice(0, 10)}...`);
    if (!execute) {
      log("[dry-run] list_card");
    } else {
      record.txHashes.listCard = await sendTx(
        account,
        `${MODULE}::marketplace::list_card`,
        [listedCardAddr, String(record.listPriceOctas)],
      );
      await sleep(BETWEEN_TX_MS);
      const freshListings = await getListings();
      const mine = freshListings.find((item) => item.seller.toLowerCase() === address.toLowerCase() && item.cardAddr === listedCardAddr);
      record.assets.listedCardAddr = listedCardAddr;
      record.assets.listingId = mine?.id ?? null;
      bumpStage(record, "listed");
      persist();
    }
  }

  if (record.stage === "listed") {
    record.stage = "done";
    record.lastUpdatedAt = nowIso();
    persist();
  }

  const label = cohort ? `${cohort.key}/type${cohort.chestType}` : record.cohort;
  log(`done (${label})`);
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) break;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function printPlan(state, args, chestPrices, tournamentState) {
  const summary = DEFAULT_COHORTS.map((cohort) => {
    const count = state.wallets.filter((w) => w.cohort === cohort.key).length;
    return `  - ${cohort.key}: ${count} wallets, chestType=${cohort.chestType}, listPrice=${cohort.minListPriceMove}-${cohort.maxListPriceMove} MOVE`;
  }).join("\n");

  console.log("Load-test bot is ready but not started.");
  console.log("");
  console.log(`State file: ${args.stateFile}`);
  console.log(`Wallets total: ${state.wallets.length}`);
  console.log(summary);
  console.log("");
  console.log("Preflight:");
  console.log(`  - chest prices (octas): wooden=${chestPrices[0]}, iron=${chestPrices[1]}, silver=${chestPrices[2]}`);
  console.log(`  - tournament running=${tournamentState.running}, day=${tournamentState.day}, restDay=${tournamentState.isRestDay}`);
  console.log("");
  console.log("To run for real:");
  console.log(`  node scripts/loadtest_bot.js --execute`);
  console.log("");
  console.log("Optional flags:");
  console.log("  --concurrency <n>");
  console.log("  --faucet-amount <octas>");
  console.log("  --state-file <path>");
  console.log("  --cohort <tier1|tier2|tier3>");
  console.log("  --allow-no-tournament");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = loadState(args.stateFile);
  ensureWalletPool(state);
  atomicWriteJson(args.stateFile, state);

  const chestPrices = await getChestPrices();
  const tournamentState = await getTournamentState();

  if (!args.execute) {
    printPlan(state, args, chestPrices, tournamentState);
    return;
  }

  if ((!tournamentState.running || tournamentState.isRestDay || tournamentState.day < 1) && !args.allowNoTournament) {
    throw new Error("Tournament is inactive or current day is unavailable. Use --allow-no-tournament to skip lineup submission.");
  }

  const runtime = {
    execute: args.execute,
    allowNoTournament: args.allowNoTournament,
    faucetAmount: args.faucetAmount,
    state,
    stateFile: args.stateFile,
  };

  const wallets = args.cohort ? state.wallets.filter((record) => record.cohort === args.cohort) : state.wallets.slice();
  if (args.cohort) {
    console.log(`Filtering wallets by cohort=${args.cohort}: ${wallets.length} wallets`);
  }
  await runPool(wallets, args.concurrency, async (record) => {
    try {
      await processWallet(record, runtime, chestPrices, tournamentState);
    } catch (error) {
      record.lastUpdatedAt = nowIso();
      record.notes.push(`[${record.lastUpdatedAt}] ${String(error?.message ?? error)}`);
      atomicWriteJson(args.stateFile, state);
      console.error(`[${record.id}] ERROR: ${String(error?.message ?? error)}`);
    }
    await sleep(BETWEEN_WALLETS_MS);
  });

  console.log("Load-test bot finished.");
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
