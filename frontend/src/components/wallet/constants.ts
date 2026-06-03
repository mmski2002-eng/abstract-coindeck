import { projectAddresses } from "@/config/projectAddresses";
import {
  ASSET_NAMES,
  ASSET_TICKERS,
  ASSET_BRAND_COLORS,
  ASSET_ICON_PATHS,
  ASSET_TEAMS,
  ASSET_ROLES,
  ASSET_ROLE_IDS,
  ASSET_CGK_IDS,
  ASSET_CGK_IMAGES,
  ASSET_GITHUB_REPOS,
} from "@/config/assetUniverse";
export { ASSET_SET_VERSION } from "@/config/assetUniverse";

export const HEROES          = ASSET_NAMES;
export const COIN_TICKERS    = ASSET_TICKERS;
export const COIN_BRAND_COLORS = ASSET_BRAND_COLORS;
export const COIN_ICONS      = ASSET_ICON_PATHS;
export const PLAYER_TEAMS    = ASSET_TEAMS;
export const PLAYER_ROLES    = ASSET_ROLES;
export const PLAYER_ROLE_IDS = ASSET_ROLE_IDS;
export const CGK_IDS         = ASSET_CGK_IDS;
export const HERO_IMAGES     = ASSET_CGK_IMAGES;
export const GITHUB_REPOS    = ASSET_GITHUB_REPOS;

export const TIER_MULTS = [100, 140, 190, 250];

export const CARD_TIER_STYLES = [
  { color: "var(--rarity-common)", border: "var(--ink)", glow: "var(--shadow-sticker-sm)", gradient: "var(--paper-2)", label: "Маленькое",     enLabel: "Small" },
  { color: "var(--rarity-rare)", border: "var(--ink)", glow: "var(--shadow-sticker-sm)", gradient: "var(--sky-soft)", label: "Среднее",       enLabel: "Medium" },
  { color: "var(--rarity-epic)", border: "var(--ink)", glow: "var(--shadow-sticker-sm)", gradient: "var(--mint-soft)", label: "Тяжелое",       enLabel: "Heavy" },
  { color: "var(--rarity-legendary)", border: "var(--ink)", glow: "var(--shadow-sticker-sm)", gradient: "var(--warn-soft)", label: "Супер тяжёлое", enLabel: "Super heavy" },
];

export const TIER_NAMES = ["Маленькое", "Среднее", "Тяжелое", "Супер Тяжелое"];
export const TIER_HEX = ["var(--rarity-common)", "var(--rarity-rare)", "var(--rarity-epic)", "var(--rarity-legendary)"];
export const TIER_COLORS = [
  { border: "", badge: "chip-sticker", glow: "" },
  { border: "", badge: "chip-sticker", glow: "" },
  { border: "", badge: "chip-sticker", glow: "" },
  { border: "", badge: "chip-sticker", glow: "" },
];

export const ALL_TEAMS = Array.from(new Set(PLAYER_TEAMS));

export const MODULE_ADDRESS      = projectAddresses.moduleAddress;
export const ADMIN_ADDRESS       = projectAddresses.adminAddress;
export const VAULT_ADDRESS       = projectAddresses.prizeVaultAddress;
export const CLAIM_VAULT_ADDRESS = projectAddresses.claimVaultAddress;
export const REST_URL            = projectAddresses.restUrl;

export const ADMIN_CONTROL  = projectAddresses.adminControl;
export const COIN_DECK_NFT  = projectAddresses.coinDeckNFT;
export const TOURNAMENT     = projectAddresses.tournament;
export const ORACLE         = projectAddresses.oracle;
export const CLAIM          = projectAddresses.claim;
export const MARKETPLACE    = projectAddresses.marketplace;
