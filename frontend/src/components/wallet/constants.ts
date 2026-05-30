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
  { color: "#9CA3AF", border: "rgba(156,163,175,0.45)", glow: "rgba(156,163,175,0.35)", gradient: "linear-gradient(180deg,rgba(156,163,175,0.18),rgba(156,163,175,0.02))", label: "МАЛЕНЬКОЕ",  enLabel: "SMALL" },
  { color: "#60A5FA", border: "rgba(59,130,246,0.6)",   glow: "rgba(59,130,246,0.45)",  gradient: "linear-gradient(180deg,rgba(59,130,246,0.25),rgba(59,130,246,0.03))",   label: "СРЕДНЕЕ",    enLabel: "MEDIUM" },
  { color: "#C084FC", border: "rgba(168,85,247,0.65)",  glow: "rgba(168,85,247,0.55)",  gradient: "linear-gradient(180deg,rgba(168,85,247,0.28),rgba(168,85,247,0.03))",   label: "БОЛЬШОЕ",    enLabel: "HEAVY" },
  { color: "#FBBF24", border: "rgba(245,158,11,0.85)",  glow: "rgba(245,158,11,0.7)",   gradient: "linear-gradient(180deg,rgba(245,158,11,0.32),rgba(245,158,11,0.04))",   label: "ТЯЖЁЛОЕ",    enLabel: "SUPER HEAVY" },
];

export const TIER_NAMES = ["Маленькое", "Среднее", "Большое", "Тяжёлое"];
export const TIER_HEX = ["#71717a", "#3b82f6", "#a855f7", "#f59e0b"];
export const TIER_COLORS = [
  { border: "border-zinc-500/40", badge: "bg-zinc-800/80 text-zinc-300", glow: "" },
  { border: "border-blue-500/40",   badge: "bg-blue-900/80 text-blue-300 ring-1 ring-blue-500/40",     glow: "shadow-[0_0_12px_rgba(59,130,246,0.25)]" },
  { border: "border-purple-500/40", badge: "bg-purple-900/80 text-purple-300 ring-1 ring-purple-500/40", glow: "shadow-[0_0_16px_rgba(168,85,247,0.3)]" },
  { border: "border-amber-500/40",  badge: "bg-amber-900/80 text-amber-300 ring-1 ring-amber-500/40",   glow: "shadow-[0_0_20px_rgba(245,158,11,0.4)]" },
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
