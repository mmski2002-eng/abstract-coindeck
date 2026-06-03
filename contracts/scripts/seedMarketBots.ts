import { Contract, Provider, Wallet } from "zksync-ethers";
import { ethers } from "ethers";
import * as hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import projectAddresses from "../../frontend/src/config/project-addresses.json";

const ACTION_ADMIN_MINT_TO = 2;
const WALLET_COUNT = 90;
const GAS_PER_WALLET = ethers.parseEther("0.001");
const PRICE_MIN = ethers.parseEther("0.0001");
const PRICE_MAX = ethers.parseEther("0.0003");
const STATE_FILE = process.env.BOT_STATE_FILE || path.join(__dirname, "data", "seed-market-bot-wallets.json");

const WORDS = [
  "Amber", "Anchor", "Apple", "Arbor", "Ash", "Atlas", "Aurora", "Autumn", "Baker", "Bamboo",
  "Bay", "Beacon", "Berry", "Birch", "Blaze", "Bloom", "Blue", "Breeze", "Brook", "Canyon",
  "Cedar", "Chalk", "Cinder", "Citrus", "Cloud", "Clover", "Cobalt", "Comet", "Copper", "Coral",
  "Cove", "Crane", "Crown", "Crystal", "Dawn", "Delta", "Dew", "Drift", "Dune", "Eagle",
  "Echo", "Elm", "Ember", "Falcon", "Fern", "Field", "Flame", "Flint", "Flora", "Forest",
  "Frost", "Gale", "Garden", "Glade", "Glass", "Glow", "Gold", "Granite", "Grove", "Harbor",
  "Harvest", "Hazel", "Hill", "Honey", "Horizon", "Ice", "Indigo", "Iris", "Ivory", "Jade",
  "Jet", "Juniper", "Keystone", "Kingfisher", "Lake", "Laurel", "Leaf", "Lemon", "Lily", "Linden",
  "Maple", "Marble", "Marina", "Meadow", "Mercury", "Mint", "Mistral", "Moon", "Morning", "Moss",
  "Needle", "Nova", "Oak", "Ocean", "Olive", "Onyx", "Opal", "Orbit", "Orchid", "Pebble",
  "Pearl", "Pine", "Plume", "Prairie", "Quartz", "Raven", "Reef", "River", "Robin", "Rose",
  "Ruby", "Saffron", "Sage", "Sail", "Sand", "Scarlet", "Shadow", "Shell", "Silver", "Sky",
  "Slate", "Snow", "Solstice", "Sparrow", "Spring", "Spruce", "Star", "Stone", "Storm", "Summer",
  "Summit", "Sunset", "Swift", "Thistle", "Thunder", "Timber", "Topaz", "Torch", "Vale", "Velvet",
  "Violet", "Willow", "Wind", "Winter", "Wren", "Zephyr"
];

const ADMIN_CONTROL_ABI = [
  { name: "getActionDelay", type: "function", stateMutability: "view", inputs: [{ name: "actionType", type: "uint8" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "setActionDelay", type: "function", stateMutability: "nonpayable", inputs: [{ name: "actionType", type: "uint8" }, { name: "delaySecs", type: "uint256" }], outputs: [] },
] as const;

const NFT_ABI = [
  { name: "adminMintEggMonet", type: "function", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "playerId", type: "uint8" }, { name: "tier", type: "uint8" }, { name: "count", type: "uint256" }], outputs: [] },
  { name: "getUserEggMonets", type: "function", stateMutability: "view", inputs: [{ name: "owner_", type: "address" }], outputs: [{ name: "", type: "uint256[]" }] },
  { name: "nicknames", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "string" }] },
  { name: "setNickname", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nick", type: "string" }], outputs: [] },
  { name: "setApprovalForAll", type: "function", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  { name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "isEggMonetLocked", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

const MARKETPLACE_ABI = [
  { name: "listEggMonet", type: "function", stateMutability: "nonpayable", inputs: [{ name: "eggMonetId", type: "uint256" }, { name: "price", type: "uint256" }], outputs: [] },
  { name: "listingCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "getListingsPage", type: "function", stateMutability: "view", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [
    { name: "ids", type: "uint256[]" },
    { name: "sellers", type: "address[]" },
    { name: "eggMonetIds", type: "uint256[]" },
    { name: "playerIds", type: "uint8[]" },
    { name: "tiers", type: "uint8[]" },
    { name: "prices", type: "uint256[]" },
  ] },
] as const;

const TOURNAMENT_ABI = [
  { name: "getCurrentEpochDay", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "epoch", type: "uint256" }, { name: "day", type: "uint256" }, { name: "isRest", type: "bool" }] },
  { name: "submitWeighing", type: "function", stateMutability: "payable", inputs: [{ name: "eggMonetIds", type: "uint256[5]" }], outputs: [] },
] as const;

type NetworkKey = keyof typeof projectAddresses.networks;

type BotWalletRecord = {
  index: number;
  address: string;
  privateKey: string;
  nickname: string;
  playerId: number;
  tier: number;
};

type BotWalletState = {
  network: string;
  createdAt: string;
  wallets: BotWalletRecord[];
};

function sanitizeNickname(input: string): string {
  const asciiOnly = input.replace(/[^A-Za-z]/g, "");
  const trimmed = asciiOnly.slice(0, 30);
  if (!trimmed) {
    throw new Error(`Nickname became empty after ASCII sanitization: "${input}"`);
  }
  return trimmed;
}

function assertNicknameSafe(nickname: string, index: number) {
  if (!/^[A-Za-z]{1,30}$/.test(nickname)) {
    throw new Error(`[${index}] nickname is not leaderboard-safe ASCII: "${nickname}"`);
  }
}

function activeNetworkKey(): NetworkKey {
  return projectAddresses.activeNetwork as NetworkKey;
}

function runtimeAddresses() {
  const network = projectAddresses.networks[activeNetworkKey()];
  return {
    rpcUrl: network.urls.restUrl,
    adminControl: network.contracts.adminControl,
    coinDeckNFT: network.contracts.coinDeckNFT,
    tournament: network.contracts.tournament,
    marketplace: network.contracts.marketplace,
  };
}

function ensureStateDir() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function tierForIndex(index: number): number {
  if (index < 30) return 0;
  if (index < 60) return 1;
  return 2;
}

function randomPlayerId(): number {
  return Math.floor(Math.random() * 50);
}

function randomPrice(): bigint {
  const min = PRICE_MIN;
  const span = PRICE_MAX - PRICE_MIN;
  const steps = 20_000;
  const step = span / BigInt(steps);
  return min + step * BigInt(Math.floor(Math.random() * (steps + 1)));
}

function loadOrCreateWallets(provider: Provider): BotWalletState {
  ensureStateDir();
  if (fs.existsSync(STATE_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as BotWalletState;
    if (Array.isArray(parsed.wallets) && parsed.wallets.length === WALLET_COUNT) {
      return parsed;
    }
  }

  const words = shuffle(WORDS);
  if (words.length < WALLET_COUNT) {
    throw new Error(`WORDS length is too small: need ${WALLET_COUNT}, got ${words.length}`);
  }

  const wallets: BotWalletRecord[] = [];
  for (let i = 0; i < WALLET_COUNT; i++) {
    const wallet = Wallet.createRandom().connect(provider);
    wallets.push({
      index: i + 1,
      address: wallet.address,
      privateKey: wallet.privateKey,
      nickname: sanitizeNickname(words[i]),
      playerId: randomPlayerId(),
      tier: tierForIndex(i),
    });
  }

  const state: BotWalletState = {
    network: activeNetworkKey(),
    createdAt: new Date().toISOString(),
    wallets,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

function saveState(state: BotWalletState) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function waitTx(tx: { wait: () => Promise<unknown>; hash?: string }, label: string) {
  await tx.wait();
  if (tx.hash) {
    console.log(`${label} tx=${tx.hash}`);
  } else {
    console.log(label);
  }
}

async function ensureMintDelayZero(adminControl: Contract): Promise<bigint> {
  const currentDelay = await adminControl.getActionDelay(ACTION_ADMIN_MINT_TO) as bigint;
  if (currentDelay > 0n) {
    const tx = await adminControl.setActionDelay(ACTION_ADMIN_MINT_TO, 0);
    await waitTx(tx, `ACTION_ADMIN_MINT_TO delay set to 0 (was ${currentDelay}s)`);
  }
  return currentDelay;
}

async function restoreMintDelay(adminControl: Contract, delay: bigint) {
  const currentDelay = await adminControl.getActionDelay(ACTION_ADMIN_MINT_TO) as bigint;
  if (currentDelay !== delay) {
    const tx = await adminControl.setActionDelay(ACTION_ADMIN_MINT_TO, delay);
    await waitTx(tx, `ACTION_ADMIN_MINT_TO delay restored to ${delay}s`);
  }
}

async function ensureGas(adminWallet: Wallet, provider: Provider, record: BotWalletRecord) {
  const balance = await provider.getBalance(record.address);
  if (balance >= GAS_PER_WALLET) return;
  const delta = GAS_PER_WALLET - balance;
  const tx = await adminWallet.sendTransaction({ to: record.address, value: delta });
  await waitTx(tx, `[${record.index}] gas top-up ${ethers.formatEther(delta)} ETH -> ${record.address}`);
}

async function hasListingForSeller(marketplace: Contract, seller: string): Promise<boolean> {
  const total = Number(await marketplace.listingCount() as bigint);
  if (total === 0) return false;
  const pageSize = Math.min(total, 200);
  for (let offset = 0; offset < total; offset += pageSize) {
    const [, sellers] = await marketplace.getListingsPage(offset, pageSize) as [
      bigint[],
      string[],
      bigint[],
      number[],
      number[],
      bigint[]
    ];
    if (sellers.some((addr) => addr.toLowerCase() === seller.toLowerCase())) {
      return true;
    }
  }
  return false;
}

async function ensureInventory(adminNft: Contract, marketplace: Contract, record: BotWalletRecord) {
  const current = await adminNft.getUserEggMonets(record.address) as bigint[];
  const alreadyListed = await hasListingForSeller(marketplace, record.address);
  const targetOwned = alreadyListed ? 5 : 6;
  if (current.length >= targetOwned) return;
  const missing = targetOwned - current.length;
  const tx = await adminNft.adminMintEggMonet(record.address, record.playerId, record.tier, missing);
  await waitTx(tx, `[${record.index}] minted ${missing} NFT tier=${record.tier} playerId=${record.playerId}`);
}

async function ensureNickname(botNft: Contract, record: BotWalletRecord) {
  assertNicknameSafe(record.nickname, record.index);
  const current = await botNft.nicknames(record.address) as string;
  if (current === record.nickname) return;
  const tx = await botNft.setNickname(record.nickname);
  await waitTx(tx, `[${record.index}] nickname=${record.nickname}`);
}

async function ensureApproval(botNft: Contract, owner: string, marketplace: string, index: number) {
  const approved = await botNft.isApprovedForAll(owner, marketplace) as boolean;
  if (approved) return;
  const tx = await botNft.setApprovalForAll(marketplace, true);
  await waitTx(tx, `[${index}] marketplace approval enabled`);
}

async function getInventory(nft: Contract, owner: string): Promise<bigint[]> {
  const raw = await nft.getUserEggMonets(owner) as bigint[];
  return Array.from(raw, (value) => BigInt(value));
}

async function pickUnlockedToken(nft: Contract, tokenIds: bigint[]): Promise<bigint | null> {
  for (const tokenId of tokenIds) {
    const locked = await nft.isEggMonetLocked(tokenId) as boolean;
    if (!locked) return tokenId;
  }
  return null;
}

async function submitLineup(botTournament: Contract, lineup: bigint[], index: number) {
  if (lineup.length !== 5) {
    throw new Error(`[${index}] lineup length must be 5, got ${lineup.length}`);
  }
  const fixedLineup = [lineup[0], lineup[1], lineup[2], lineup[3], lineup[4]] as [bigint, bigint, bigint, bigint, bigint];
  const tx = await botTournament.submitWeighing(fixedLineup);
  await waitTx(tx, `[${index}] lineup submitted`);
}

async function listToken(botMarketplace: Contract, tokenId: bigint, index: number): Promise<bigint> {
  const price = randomPrice();
  const tx = await botMarketplace.listEggMonet(tokenId, price);
  await waitTx(tx, `[${index}] listed token ${tokenId.toString()} for ${ethers.formatEther(price)} ETH`);
  return price;
}

async function processWallet(
  provider: Provider,
  record: BotWalletRecord,
  addresses: ReturnType<typeof runtimeAddresses>
) {
  const wallet = new Wallet(record.privateKey, provider);
  const nft = new Contract(addresses.coinDeckNFT, NFT_ABI, wallet);
  const tournament = new Contract(addresses.tournament, TOURNAMENT_ABI, wallet);
  const marketplace = new Contract(addresses.marketplace, MARKETPLACE_ABI, wallet);
  const alreadyListed = await hasListingForSeller(marketplace, wallet.address);

  await ensureNickname(nft, record);
  await ensureApproval(nft, wallet.address, addresses.marketplace, record.index);

  let tokenIds = await getInventory(nft, wallet.address);
  const minRequired = alreadyListed ? 5 : 6;
  if (tokenIds.length < minRequired) {
    throw new Error(`[${record.index}] inventory has ${tokenIds.length} NFT, expected at least ${minRequired}`);
  }

  if (alreadyListed) {
    const lineup = tokenIds.slice(0, 5);
    await submitLineup(tournament, lineup, record.index);
    return;
  }

  let listTokenId = await pickUnlockedToken(nft, tokenIds);
  if (listTokenId) {
    const lineup = tokenIds.filter((id) => id !== listTokenId).slice(0, 5);
    await listToken(marketplace, listTokenId, record.index);
    await submitLineup(tournament, lineup, record.index);
    return;
  }

  const lineup = tokenIds.slice(0, 5);
  await submitLineup(tournament, lineup, record.index);

  tokenIds = await getInventory(nft, wallet.address);
  listTokenId = await pickUnlockedToken(nft, tokenIds);
  if (!listTokenId) {
    throw new Error(`[${record.index}] no unlocked NFT left for marketplace listing after lineup`);
  }
  await listToken(marketplace, listTokenId, record.index);
}

async function ensureTournamentIsActive(addresses: ReturnType<typeof runtimeAddresses>) {
  const provider = new Provider(addresses.rpcUrl);
  const tournament = new Contract(addresses.tournament, TOURNAMENT_ABI, provider);
  const [epoch, day, isRest] = await tournament.getCurrentEpochDay() as [bigint, bigint, boolean];
  if (day < 1n) {
    throw new Error(`Tournament day is ${day.toString()} for epoch ${epoch.toString()}. Start the epoch first.`);
  }
  if (isRest) {
    throw new Error(`Today is a rest day for epoch ${epoch.toString()}. The bot should run on an active day.`);
  }
}

async function main() {
  const addresses = runtimeAddresses();
  const provider = new Provider(addresses.rpcUrl);

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not set");
  }

  await ensureTournamentIsActive(addresses);

  const adminWallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const adminControl = new Contract(addresses.adminControl, ADMIN_CONTROL_ABI, adminWallet);
  const adminNft = new Contract(addresses.coinDeckNFT, NFT_ABI, adminWallet);
  const adminMarketplace = new Contract(addresses.marketplace, MARKETPLACE_ABI, adminWallet);
  const state = loadOrCreateWallets(provider);
  state.wallets.forEach((record) => {
    record.nickname = sanitizeNickname(record.nickname);
    assertNicknameSafe(record.nickname, record.index);
  });
  saveState(state);

  console.log(`Admin wallet: ${adminWallet.address}`);
  console.log(`State file: ${STATE_FILE}`);
  console.log(`Using network: ${state.network}`);
  console.log(`Wallets loaded: ${state.wallets.length}`);

  const originalDelay = await ensureMintDelayZero(adminControl);

  try {
    for (const record of state.wallets) {
      await ensureGas(adminWallet, provider, record);
      await ensureInventory(adminNft, adminMarketplace, record);
    }

    for (const record of state.wallets) {
      await processWallet(provider, record, addresses);
    }
  } finally {
    await restoreMintDelay(adminControl, originalDelay);
  }

  console.log("Seed bot finished successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
