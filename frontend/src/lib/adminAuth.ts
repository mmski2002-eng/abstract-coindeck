export const ADMIN_NONCE_TTL_MS = 5 * 60 * 1000;
export const ADMIN_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ADMIN_CHAIN_ID ?? "250");
export const ADMIN_AUDIT_ACTION = "admin-audit-read";
export const LEADERBOARD_CONFIG_ACTION = "leaderboard-config";
export const LEADERBOARD_REFRESH_ACTION = "leaderboard-refresh";
export const MARKET_DATA_PARSE_ACTION = "market-data-parse";
export const MARKET_SNAPSHOT_SAVE_ACTION = "market-snapshot-save";
export const BOT_CONTROL_ACTION = "bot-control";
export const CLAIM_LIST_PREVIEW_ACTION = "claim-list-preview";
export const PALETTE_ACTION = "admin-palette";

export type AdminAuthResult = {
  action: string; nonce: string; timestamp: number; domain: string;
  chainId: number; payloadHash: string; signature: string; publicKey: string; fullMessage: string;
};

export function normalizeAdminDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

export function buildAdminActionMessage(args: {
  domain: string;
  chainId: number;
  action: string;
  timestamp: number;
  nonce: string;
  payloadHash: string;
}): string {
  return [
    "moveinvestor-admin",
    `domain:${normalizeAdminDomain(args.domain)}`,
    `chainId:${args.chainId}`,
    `action:${args.action}`,
    `timestamp:${args.timestamp}`,
    `nonce:${args.nonce}`,
    `payloadHash:${args.payloadHash}`,
  ].join("\n");
}

export function buildWalletFullMessage(message: string, _nonce: string): string {
  return message;
}
