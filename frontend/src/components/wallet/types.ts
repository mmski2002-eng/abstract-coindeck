export type Tab = "roster" | "marketplace" | "tournament" | "rankings" | "admin";

export type TransactionPayload = { function: string; typeArguments: unknown[]; functionArguments: unknown[] };
export type TxOptions = { maxGasAmount?: number; gasUnitPrice?: number; skipSimulation?: boolean };
export type HeroStats = { priceChg: number; vol24h: number; high24h: number; low24h: number; tempRatio: number; hype: boolean };
export type ClaimState = { active: boolean; startTs: number; deadline: number; vaultBalance: number; claimDays: number } | null;
export type BaseUris = { card: string; chest: string };
export type GovernancePolicy = {
  initialized: boolean;
  freezeDuringEpoch: boolean;
  epochActive: boolean;
  withdrawEnabled: boolean;
  perTxLimit: number;
  dailyLimit: number;
  spentToday: number;
  dayIndex: number;
  actionDelays: number[];
};
export type PendingAdminAction = {
  actionType: number;
  executeAfter: number;
  payloadHashHex: string;
};
export type AdminRoleEntry = { addr: string; roles: number };

export const ROLE_ORACLE = 1;
export const ROLE_TREASURY = 2;
export const ROLE_NFT = 4;
export const ROLE_CLAIM = 8;
export const ROLE_EMERGENCY = 16;
export const ROLE_FULL = 31;
export const ROLE_NAMES: { bit: number; key: string; label: string }[] = [
  { bit: ROLE_ORACLE,    key: "oracle",    label: "Oracle" },
  { bit: ROLE_TREASURY,  key: "treasury",  label: "Treasury" },
  { bit: ROLE_NFT,       key: "nft",       label: "NFT" },
  { bit: ROLE_CLAIM,     key: "claim",     label: "Claim" },
  { bit: ROLE_EMERGENCY, key: "emergency", label: "Emergency" },
];

export type PrizeConfig = {
  goldPct: number;
  silverPct: number;
  bronzePct: number;
  pos1: number;
  pos2: number;
  pos3: number;
  pos4_9: number;
  pos10_19: number;
  pos20_49: number;
  pos50_99: number;
};

export type TournamentStateData = {
  active: boolean;
  currentDay: number;
  startTimestamp: number;
  prizePool: number;
  ended: boolean;
  epoch: number;
  totalDays: number;
} | null;

export type LineupSlot = { playerId: number; tier: number };
export type LineupEntry = { day: number; league: number; slots?: LineupSlot[] };

export type RankRow = { addr: string; score: number; league: number; days: number; nickname?: string; prevDayTiers?: number[]; prevDayPids?: number[] };

export type CardData = { playerId: number; tier: number; cardAddr: string };

export type Listing = { id: number; seller: string; playerId: number; tier: number; price: number };

export type QuickBuyMergeData = {
  playerId: number;
  tier: number;
  ownedCount: number;
  neededCount: number;
};
