#!/usr/bin/env node
/**
 * MoveInvestor Oracle Script
 * Fetches 24h price change % from CoinGecko for 50 crypto coins,
 * calculates base_points per coin_id (player_id 0-49), posts to oracle.
 *
 * Usage:
 *   node oracle_post.js --day <N> [--finalize] [--dry-run]
 *
 * Scoring: score = max(0, round(50 + pct_change * 5))
 *   0% change = 50 pts, +10% = 100 pts, -10% = 0 pts
 */

const https = require("https");
const path = require("path");
const { execSync } = require("child_process");
const addressBook = require(path.join(__dirname, "../frontend/src/config/project-addresses.json"));

// ── Config ────────────────────────────────────────────────────────────────────

const activeNetwork = addressBook.networks[addressBook.activeNetwork];
const MODULE_ADDR = process.env.MODULE_ADDR || process.env.CONTRACT_ADDRESS || activeNetwork.contracts.moduleAddress;
const REST_URL    = process.env.REST_URL || activeNetwork.urls.restUrl;
const PROFILE     = process.env.ORACLE_PROFILE || "moveinvestor";

// coin_id (player_id) → CoinGecko coin id, matches HEROES order in WalletApp.tsx
const COIN_IDS = [
  "bitcoin",              // 0  BTC
  "ethereum",             // 1  ETH
  "binancecoin",          // 2  BNB
  "ripple",               // 3  XRP
  "solana",               // 4  SOL
  "dogecoin",             // 5  DOGE
  "cardano",              // 6  ADA
  "tron",                 // 7  TRX
  "avalanche-2",          // 8  AVAX
  "shiba-inu",            // 9  SHIB
  "polkadot",             // 10 DOT
  "bitcoin-cash",         // 11 BCH
  "chainlink",            // 12 LINK
  "near",                 // 13 NEAR
  "litecoin",             // 14 LTC
  "uniswap",              // 15 UNI
  "aptos",                // 16 APT
  "hedera-hashgraph",     // 17 HBAR
  "monero",               // 18 XMR
  "internet-computer",    // 19 ICP
  "ethereum-classic",     // 20 ETC
  "okb",                  // 21 OKB
  "cosmos",               // 22 ATOM
  "filecoin",             // 23 FIL
  "arbitrum",             // 24 ARB
  "matic-network",        // 25 MATIC
  "stellar",              // 26 XLM
  "optimism",             // 27 OP
  "immutable-x",          // 28 IMX
  "mantle",               // 29 MNT
  "vechain",              // 30 VET
  "crypto-com-chain",     // 31 CRO
  "blockstack",           // 32 STX
  "algorand",             // 33 ALGO
  "render-token",         // 34 RNDR
  "injective-protocol",   // 35 INJ
  "the-graph",            // 36 GRT
  "sui",                  // 37 SUI
  "fantom",               // 38 FTM
  "theta-token",          // 39 THETA
  "eos",                  // 40 EOS
  "aave",                 // 41 AAVE
  "maker",                // 42 MKR
  "lido-dao",             // 43 LDO
  "sei-network",          // 44 SEI
  "kaspa",                // 45 KAS
  "pepe",                 // 46 PEPE
  "bonk",                 // 47 BONK
  "dogwifcoin",           // 48 WIF
  "movement",             // 49 MOVE
];

// ── Scoring ───────────────────────────────────────────────────────────────────
// pct: 24h price change percentage (e.g. 5.3 for +5.3%)
function calcScore(pct) {
  return Math.max(0, Math.round(50 + pct * 5));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "moveinvestor-oracle/1.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${data.slice(0, 200)}`)); }
      });
    }).on("error", reject);
  });
}

// ── Fetch 24h price changes from CoinGecko ────────────────────────────────────
async function fetchPriceChanges() {
  const ids = COIN_IDS.join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  console.log("Fetching CoinGecko prices...");
  const data = await get(url);

  const changes = {};
  for (let i = 0; i < COIN_IDS.length; i++) {
    const cgId = COIN_IDS[i];
    const pct = data[cgId]?.usd_24h_change ?? 0;
    changes[i] = pct;
  }
  return changes;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args     = process.argv.slice(2);
  const day      = parseInt(args[args.indexOf("--day") + 1] || "1");
  const finalize = args.includes("--finalize");
  const dryRun   = args.includes("--dry-run");

  console.log(`Day ${day} | Finalize: ${finalize} | DryRun: ${dryRun}`);

  let coinChanges;
  if (dryRun) {
    console.log("⚠  Dry-run: using mock data (all coins +5%)");
    coinChanges = {};
    for (let i = 0; i < COIN_IDS.length; i++) coinChanges[i] = 5.0;
  } else {
    coinChanges = await fetchPriceChanges();
  }

  const playerIds  = [];
  const basePoints = [];

  console.log("\nScores:");
  for (let pid = 0; pid < COIN_IDS.length; pid++) {
    const pct   = coinChanges[pid] ?? 0;
    const score = calcScore(pct);
    playerIds.push(pid);
    basePoints.push(score);
    console.log(`  ${String(pid).padStart(2)} ${COIN_IDS[pid].padEnd(22)} ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%  →  ${score} pts`);
  }

  if (dryRun) {
    console.log("\n[dry-run] Would post — skipping on-chain tx");
    return;
  }

  // Post to oracle via aptos CLI
  const pidArg = `[${playerIds.join(",")}]`;
  const ptsArg = `[${basePoints.join(",")}]`;

  console.log("\nPosting to oracle...");
  const postCmd = [
    `aptos move run`,
    `--profile ${PROFILE}`,
    `--function-id "${MODULE_ADDR}::oracle::post_day_scores"`,
    `--args u64:${day} "u8:${pidArg}" "u64:${ptsArg}"`,
    `--assume-yes`,
  ].join(" ");

  try {
    const out = execSync(postCmd, { encoding: "utf8" });
    console.log("✓ Posted:", JSON.parse(out).Result?.transaction_hash);
  } catch (e) {
    console.error("post failed:", e.stderr || e.message);
    process.exit(1);
  }

  if (finalize) {
    console.log("Finalizing day...");
    const finalCmd = [
      `aptos move run`,
      `--profile ${PROFILE}`,
      `--function-id "${MODULE_ADDR}::oracle::finalize_day"`,
      `--args u64:${day}`,
      `--assume-yes`,
    ].join(" ");
    try {
      const out = execSync(finalCmd, { encoding: "utf8" });
      console.log("✓ Finalized:", JSON.parse(out).Result?.transaction_hash);
    } catch (e) {
      console.error("finalize failed:", e.stderr || e.message);
    }
  }
}

main().catch(console.error);
