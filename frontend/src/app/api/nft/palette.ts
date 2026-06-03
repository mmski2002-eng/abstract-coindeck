export const NFT_INK = "#0F1115";
export const NFT_DARK_SURFACE = "#0a0c18";
export const NFT_LIGHT_GLASS = "rgba(255,255,255,.55)";
export const NFT_LIGHT_GLASS_SOFT = "rgba(255,255,255,.45)";
export const NFT_DOT_PATTERN = "rgba(0,0,0,.18)";
export const NFT_SHADOW_SOFT = "rgba(0,0,0,.15)";
export const NFT_FOOTER_SHADE = "rgba(0,0,0,.07)";
export const NFT_EGG_GLOW = "rgba(255,255,255,.75)";
export const NFT_EGG_GLOW_MID = "rgba(255,255,255,.2)";
export const NFT_EGG_DROP_STRONG = "rgba(255,255,255,.9)";
export const NFT_EGG_DROP_SOFT = "rgba(255,255,255,.5)";
export const NFT_CHEST_BADGE_BG = "rgba(0,0,0,0.6)";
export const NFT_CHEST_BRAND_BORDER = "rgba(255,255,255,0.1)";
export const NFT_CHEST_BRAND_TEXT = "rgba(255,255,255,0.5)";
export const NFT_CHEST_MUTED_TEXT = "rgba(255,255,255,0.42)";
export const NFT_CHEST_IMAGE_SHADOW = "rgba(0,0,0,0.45)";
export const NFT_CHEST_FOOTER_GRADIENT = "linear-gradient(180deg, rgba(10,12,24,0) 0%, rgba(10,12,24,0.7) 24%, rgba(10,12,24,0.96) 100%)";

export function nftChestAccentRule(accent: string) {
  return `linear-gradient(90deg, transparent, ${accent}, transparent)`;
}

export const NFT_RARITY_STYLES = [
  { fill: "#D9D3C2", label: "COMMON", display: "Small" },
  { fill: "#7AC7E8", label: "RARE", display: "Medium" },
  { fill: "#26C6A8", label: "EPIC", display: "Heavy" },
  { fill: "#88FC00", label: "LEGENDARY", display: "Super Heavy" },
] as const;

export const NFT_CHEST_ANIM_STYLES = [
  { name: "Small Egg", label: "Small", file: "wooden_closed.png", fill: NFT_RARITY_STYLES[0].fill },
  { name: "Medium Egg", label: "Medium", file: "iron_closed.png", fill: NFT_RARITY_STYLES[1].fill },
  { name: "Large Egg", label: "Heavy", file: "silver_closed.png", fill: NFT_RARITY_STYLES[2].fill },
] as const;

export const NFT_CHEST_RENDER_STYLES = [
  {
    name: "Wooden Chest",
    label: "WOODEN",
    rarity: "Common",
    bg: "linear-gradient(180deg,rgba(120,80,40,0.35),rgba(10,12,24,0.1))",
    glow: "rgba(160,100,50,0.5)",
    border: "#8B5E2F",
    color: "#D4A574",
    accent: "#C4924A",
    image: "/chests/wooden_closed.png",
  },
  {
    name: "Iron Chest",
    label: "IRON",
    rarity: "Rare",
    bg: "linear-gradient(180deg,rgba(90,110,130,0.35),rgba(10,12,24,0.1))",
    glow: "rgba(100,130,160,0.5)",
    border: "#5A7A9A",
    color: "#8BB8D4",
    accent: "#7AAAC4",
    image: "/chests/iron_closed.png",
  },
  {
    name: "Silver Chest",
    label: "SILVER",
    rarity: "Epic",
    bg: "linear-gradient(180deg,rgba(160,160,180,0.35),rgba(10,12,24,0.1))",
    glow: "rgba(180,180,210,0.5)",
    border: "#9090B0",
    color: "#C8C8E8",
    accent: "#B0B0D0",
    image: "/chests/silver_closed.png",
  },
] as const;
