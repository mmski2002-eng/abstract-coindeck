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
  { color: "#D9D3C2", border: "rgba(217,211,194,0.55)", glow: "rgba(217,211,194,0.4)",  gradient: "linear-gradient(180deg,rgba(217,211,194,0.20),rgba(217,211,194,0.02))", label: "МАЛЕНЬКОЕ",     enLabel: "SMALL" },
  { color: "#7AC7E8", border: "rgba(122,199,232,0.60)", glow: "rgba(122,199,232,0.45)", gradient: "linear-gradient(180deg,rgba(122,199,232,0.25),rgba(122,199,232,0.03))", label: "СРЕДНЕЕ",       enLabel: "MEDIUM" },
  { color: "#26C6A8", border: "rgba(38,198,168,0.65)",  glow: "rgba(38,198,168,0.50)",  gradient: "linear-gradient(180deg,rgba(38,198,168,0.28),rgba(38,198,168,0.03))",   label: "ТЯЖЕЛОЕ",       enLabel: "HEAVY" },
  { color: "#88FC00", border: "rgba(136,252,0,0.80)",   glow: "rgba(136,252,0,0.65)",   gradient: "linear-gradient(180deg,rgba(136,252,0,0.30),rgba(136,252,0,0.03))",     label: "СУПЕР ТЯЖЁЛОЕ", enLabel: "SUPER HEAVY" },
];

export const TIER_NAMES = ["Маленькое", "Среднее", "Тяжелое", "Супер Тяжелое"];
export const TIER_HEX = ["#D9D3C2", "#7AC7E8", "#26C6A8", "#88FC00"];
export const TIER_COLORS = [
  { border: "border-[#D9D3C2]/60", badge: "bg-[#D9D3C2]/25 text-[var(--ink-2)]",                                        glow: "" },
  { border: "border-[#7AC7E8]/60", badge: "bg-[#7AC7E8]/20 text-[var(--ink)] ring-1 ring-[#7AC7E8]/40",                 glow: "shadow-[0_0_12px_rgba(122,199,232,0.25)]" },
  { border: "border-[#26C6A8]/60", badge: "bg-[#26C6A8]/20 text-[var(--ink)] ring-1 ring-[#26C6A8]/40",                 glow: "shadow-[0_0_16px_rgba(38,198,168,0.30)]" },
  { border: "border-[#88FC00]/60", badge: "bg-[#88FC00]/20 text-[var(--ink)] ring-1 ring-[#88FC00]/40",                 glow: "shadow-[0_0_20px_rgba(136,252,0,0.40)]" },
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
