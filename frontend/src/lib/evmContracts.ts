import { writeContract, readContract, waitForTransactionReceipt, getAccount } from "@wagmi/core";
import type { Config, WriteContractParameters } from "@wagmi/core";
import { abstractTestnet } from "viem/chains";
import { keccak256, encodeAbiParameters, encodePacked } from "viem";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

// AdminControl action type constants (must match AdminControl.sol)
const ACTION_SET_BASE_URIS          = 0;
const ACTION_SET_EGG_PRICES         = 1;
const ACTION_ADMIN_MINT_TO          = 2;
const ACTION_RESET_ALL_ORACLE_DAYS  = 3;
const ACTION_TREASURY_WITHDRAW      = 4;
const ACTION_SET_CLAIM_DAYS         = 5;
const ACTION_SET_CLAIM_LIST         = 6;
const ACTION_START_CLAIM            = 7;
const ACTION_CLOSE_CLAIM            = 8;
const ACTION_STOP_AND_RESET         = 9;

function wc(config: Config, params: Omit<WriteContractParameters, "chain">) {
  return writeContract(config, { chain: abstractTestnet, ...params } as WriteContractParameters);
}

// ── Minimal write-only ABIs ────────────────────────────────────────────────

export const TOURNAMENT_ABI = [
  { name: "startEpoch",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "startTimestamp", type: "uint256" }], outputs: [] },
  { name: "stopAndReset",     type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "adminClearEpochs", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "submitWeighing",     type: "function", stateMutability: "payable",    inputs: [{ name: "cardIds", type: "uint256[5]" }], outputs: [] },
  { name: "cancelWeighing",     type: "function", stateMutability: "payable",    inputs: [], outputs: [] },
  { name: "setConfig",        type: "function", stateMutability: "nonpayable", inputs: [{ name: "_changeLineupFee", type: "uint256" }, { name: "_cancelWeighingFee", type: "uint256" }], outputs: [] },
  { name: "withdrawTo",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

export const ORACLE_ABI = [
  { name: "setPosted",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "day", type: "uint256" }, { name: "posted", type: "bool" }], outputs: [] },
  { name: "resetAllDays",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "daysToReset", type: "uint256[]" }], outputs: [] },
  { name: "postDayScores",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "day", type: "uint256" }, { name: "playerIds", type: "uint8[]" }, { name: "basePoints", type: "uint256[]" }], outputs: [] },
  { name: "getDayScores",   type: "function", stateMutability: "view", inputs: [{ name: "day", type: "uint256" }], outputs: [
    { name: "playerIds", type: "uint8[]" },
    { name: "points", type: "uint256[]" },
    { name: "posted", type: "bool" },
  ]},
] as const;

export const TOURNAMENT_VIEW_ABI = [
  { name: "getState", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "running", type: "bool" },
    { name: "epoch", type: "uint256" },
    { name: "day", type: "uint256" },
    { name: "isRestDay", type: "bool" },
    { name: "startTimestamp", type: "uint256" },
    { name: "prizePool", type: "uint256" },
    { name: "changeFee", type: "uint256" },
    { name: "firstVisibleEpoch", type: "uint256" },
  ]},
  { name: "getWeighingSlots", type: "function", stateMutability: "view", inputs: [
    { name: "player", type: "address" },
    { name: "epoch", type: "uint256" },
    { name: "day", type: "uint256" },
  ], outputs: [
    { name: "playerIds", type: "uint8[5]" },
    { name: "tiers", type: "uint8[5]" },
  ]},
  { name: "getPlayerWeighings", type: "function", stateMutability: "view", inputs: [
    { name: "player", type: "address" },
    { name: "epoch", type: "uint256" },
  ], outputs: [
    { name: "epochDays", type: "uint256[]" },
    { name: "leagues", type: "uint8[]" },
  ]},
  { name: "getCancelFee", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "", type: "uint256" },
  ]},
  { name: "getDayWeighingsPaginated", type: "function", stateMutability: "view",
    inputs: [
      { name: "epoch", type: "uint256" },
      { name: "day", type: "uint256" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "addrs", type: "address[]" },
      { name: "playerIds", type: "uint8[]" },
      { name: "tiers", type: "uint8[]" },
      { name: "total", type: "uint256" },
    ],
  },
  { name: "participantsCount", type: "function", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const NFT_NICKNAME_ABI = [
  { name: "nicknames", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export const MARKETPLACE_ABI = [
  { name: "listEggMonet", type: "function", stateMutability: "nonpayable", inputs: [{ name: "cardId", type: "uint256" }, { name: "price", type: "uint256" }], outputs: [] },
  { name: "buyEggMonet", type: "function", stateMutability: "payable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { name: "buyEggMonetsBatch", type: "function", stateMutability: "payable", inputs: [{ name: "ids", type: "uint256[]" }], outputs: [] },
  { name: "cancelListing", type: "function", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { name: "getListingsPage", type: "function", stateMutability: "view", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [
    { name: "ids", type: "uint256[]" },
    { name: "sellers", type: "address[]" },
    { name: "cardIds", type: "uint256[]" },
    { name: "playerIds", type: "uint8[]" },
    { name: "tiers", type: "uint8[]" },
    { name: "prices", type: "uint256[]" },
  ]},
  { name: "listingCount", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "", type: "uint256" },
  ]},
] as const;

export const ADMIN_CONTROL_ABI = [
  { name: "grantRole",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr", type: "address" }, { name: "roleMask", type: "uint8" }], outputs: [] },
  { name: "revokeRole",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr", type: "address" }, { name: "roleMask", type: "uint8" }], outputs: [] },
  { name: "queueAction",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "actionType", type: "uint8" }, { name: "payloadHash", type: "bytes32" }], outputs: [] },
  { name: "getActionDelay", type: "function", stateMutability: "view",     inputs: [{ name: "actionType", type: "uint8" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getPendingActions", type: "function", stateMutability: "view",  inputs: [], outputs: [
    { name: "actionTypes",   type: "uint8[]" },
    { name: "executeAfters", type: "uint256[]" },
    { name: "hashes",        type: "bytes32[]" },
  ]},
  { name: "withdrawalPolicy", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "enabled",    type: "bool" },
    { name: "perTxLimit", type: "uint256" },
    { name: "dailyLimit", type: "uint256" },
    { name: "spentToday", type: "uint256" },
    { name: "dayIndex",   type: "uint256" },
  ]},
  { name: "epochGuard", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "freezeDuringEpoch", type: "bool" },
    { name: "epochActive",       type: "bool" },
  ]},
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "setActionDelay",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "actionType", type: "uint8" }, { name: "delaySecs", type: "uint256" }], outputs: [] },
  { name: "setEpochGuard",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "freezeDuringEpoch", type: "bool" }], outputs: [] },
  { name: "setWithdrawalPolicy", type: "function", stateMutability: "nonpayable", inputs: [{ name: "enabled", type: "bool" }, { name: "perTxLimit", type: "uint256" }, { name: "dailyLimit", type: "uint256" }], outputs: [] },
] as const;

const ADMIN_CONTROL_COUNT = 11; // ACTION_COUNT

export async function readEvmGovernanceState(config: Config): Promise<{
  actionDelays: number[];
  pending: { actionTypes: number[]; executeAfters: number[]; hashes: `0x${string}`[] };
  withdrawalPolicy: { enabled: boolean; perTxLimit: bigint; dailyLimit: bigint; spentToday: bigint; dayIndex: bigint };
  epochGuard: { freezeDuringEpoch: boolean; epochActive: boolean };
  owner: string;
}> {
  const addr = getRuntimeProjectAddresses().adminControl as `0x${string}`;

  const delayReads = Array.from({ length: ADMIN_CONTROL_COUNT }, (_, i) =>
    readContract(config, { address: addr, abi: ADMIN_CONTROL_ABI, functionName: "getActionDelay", args: [i] })
  );

  const [delays, pendingRaw, wpRaw, egRaw, ownerRaw] = await Promise.all([
    Promise.all(delayReads),
    readContract(config, { address: addr, abi: ADMIN_CONTROL_ABI, functionName: "getPendingActions" }),
    readContract(config, { address: addr, abi: ADMIN_CONTROL_ABI, functionName: "withdrawalPolicy" }),
    readContract(config, { address: addr, abi: ADMIN_CONTROL_ABI, functionName: "epochGuard" }),
    readContract(config, { address: addr, abi: ADMIN_CONTROL_ABI, functionName: "owner" }),
  ]);

  const [actionTypes, executeAfters, hashes] = pendingRaw as readonly [readonly number[], readonly bigint[], readonly `0x${string}`[]];
  const [enabled, perTxLimit, dailyLimit, spentToday, dayIndex] = wpRaw as readonly [boolean, bigint, bigint, bigint, bigint];
  const [freezeDuringEpoch, epochActive] = egRaw as readonly [boolean, boolean];

  return {
    actionDelays: (delays as bigint[]).map(Number),
    pending: {
      actionTypes: Array.from(actionTypes).map(Number),
      executeAfters: Array.from(executeAfters).map(Number),
      hashes: Array.from(hashes) as `0x${string}`[],
    },
    withdrawalPolicy: { enabled, perTxLimit, dailyLimit, spentToday, dayIndex },
    epochGuard: { freezeDuringEpoch, epochActive },
    owner: ownerRaw as string,
  };
}

export const ORACLE_VIEW_ABI = [
  { name: "isDayPosted", type: "function", stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const COIN_DECK_NFT_ABI = [
  { name: "buyEgg",       type: "function", stateMutability: "payable",    inputs: [{ name: "chestType", type: "uint8" }, { name: "count", type: "uint64" }], outputs: [] },
  { name: "scratchEgg",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "chestId", type: "uint256" }], outputs: [] },
  { name: "mergeEggMonets",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "playerId", type: "uint8" }, { name: "tier", type: "uint8" }, { name: "tokenIds", type: "uint256[]" }], outputs: [] },
  { name: "transferEggMonet",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setBaseUris",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "cardUri", type: "string" }, { name: "chestUri", type: "string" }], outputs: [] },
  { name: "adminMintEggMonet",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "playerId", type: "uint8" }, { name: "tier", type: "uint8" }, { name: "count", type: "uint256" }], outputs: [] },
  { name: "adminReissueEggMonet", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setEggPrices",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "wooden", type: "uint256" }, { name: "iron", type: "uint256" }, { name: "silver", type: "uint256" }], outputs: [] },
  { name: "setApprovalForAll",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  { name: "isApprovedForAll",     type: "function", stateMutability: "view",       inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export const CLAIM_ABI = [
  { name: "claim",         type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "startClaim",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "returnAddr", type: "address" }], outputs: [] },
  { name: "closeClaim",    type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "setClaimDays",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "numDays", type: "uint256" }], outputs: [] },
  { name: "setClaimList",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "addrs", type: "address[]" }, { name: "amounts", type: "uint256[]" }], outputs: [] },
  { name: "getClaimState", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "_active",            type: "bool" },
    { name: "_startTimestamp",    type: "uint256" },
    { name: "_deadlineTimestamp", type: "uint256" },
    { name: "vaultBalance",       type: "uint256" },
    { name: "_claimDays",         type: "uint256" },
  ]},
] as const;

const COIN_DECK_NFT_VIEW_ABI = [
  { name: "getEggPrices", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "wooden", type: "uint256" },
    { name: "iron",   type: "uint256" },
    { name: "silver", type: "uint256" },
  ]},
  { name: "getUserEggMonets", type: "function", stateMutability: "view", inputs: [{ name: "owner_", type: "address" }], outputs: [
    { name: "", type: "uint256[]" },
  ]},
  { name: "getUserEggs", type: "function", stateMutability: "view", inputs: [{ name: "owner_", type: "address" }], outputs: [
    { name: "", type: "uint256[]" },
  ]},
  { name: "getEggMonetInfo", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [
    { name: "playerId", type: "uint8" },
    { name: "tier", type: "uint8" },
  ]},
  { name: "eggs", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [
    { name: "eggType", type: "uint8" },
  ]},
  { name: "eggMonetBaseUri", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "eggBaseUri",      type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

async function evmCall(rpc: string, contract: string, selector: string): Promise<string> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: contract, data: selector }, "latest"], id: 1 }),
  });
  const json = await res.json() as { result?: string; error?: unknown };
  if (json.error) { console.error("[evmCall] RPC error:", json.error); return ""; }
  const result = json.result ?? "";
  if (!result || result === "0x") return "";
  const hex = result.slice(2);
  const len = parseInt(hex.slice(64, 128), 16);
  const bytes = Uint8Array.from((hex.slice(128, 128 + len * 2).match(/.{2}/g) ?? []).map(b => parseInt(b, 16)));
  return new TextDecoder().decode(bytes);
}

export async function readBaseUris(config?: Config): Promise<{ card: string; chest: string }> {
  const addrs = getRuntimeProjectAddresses();
  if (config) {
    try {
      const [card, chest] = await Promise.all([
        readContract(config, {
          address: addrs.coinDeckNFT as `0x${string}`,
          abi: COIN_DECK_NFT_VIEW_ABI,
          functionName: "eggMonetBaseUri",
        }),
        readContract(config, {
          address: addrs.coinDeckNFT as `0x${string}`,
          abi: COIN_DECK_NFT_VIEW_ABI,
          functionName: "eggBaseUri",
        }),
      ]);
      return { card: card as string, chest: chest as string };
    } catch {
      return { card: "", chest: "" };
    }
  }
  // Fallback: raw eth_call using correct selectors for eggMonetBaseUri() and eggBaseUri()
  const rpc = addrs.restUrl;
  const contract = addrs.coinDeckNFT;
  try {
    const [card, chest] = await Promise.all([
      evmCall(rpc, contract, "0xf6e3c7f5"), // keccak256("eggMonetBaseUri()")[:4]
      evmCall(rpc, contract, "0x26f1dc25"), // keccak256("eggBaseUri()")[:4]
    ]);
    return { card, chest };
  } catch {
    return { card: "", chest: "" };
  }
}

export async function readEvmChestPrices(config: Config): Promise<{ wooden: bigint; iron: bigint; silver: bigint }> {
  const addrs = getRuntimeProjectAddresses();
  const [wooden, iron, silver] = await readContract(config, {
    address: addrs.coinDeckNFT as `0x${string}`,
    abi: COIN_DECK_NFT_VIEW_ABI,
    functionName: "getEggPrices",
  });
  return { wooden, iron, silver };
}

export async function readEvmInventory(
  config: Config,
  owner: `0x${string}`,
): Promise<{
  cards: { tokenId: bigint; playerId: number; tier: number }[];
  chests: { tokenId: bigint; chestType: number }[];
}> {
  const addrs = getRuntimeProjectAddresses();
  const [cardIds, chestIds] = await Promise.all([
    readContract(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_VIEW_ABI,
      functionName: "getUserEggMonets",
      args: [owner],
    }),
    readContract(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_VIEW_ABI,
      functionName: "getUserEggs",
      args: [owner],
    }),
  ]);

  const cards = await Promise.all(
    (cardIds as bigint[]).map(async (tokenId) => {
      const [playerId, tier] = await readContract(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_VIEW_ABI,
        functionName: "getEggMonetInfo",
        args: [tokenId],
      });
      return { tokenId, playerId: Number(playerId), tier: Number(tier) };
    }),
  );

  const chests = await Promise.all(
    (chestIds as bigint[]).map(async (tokenId) => {
      const result = await readContract(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_VIEW_ABI,
        functionName: "eggs",
        args: [tokenId],
      });
      return { tokenId, chestType: Number(result as unknown as number) };
    }),
  );

  return { cards, chests };
}

export async function readEvmTournamentState(config: Config): Promise<{
  running: boolean;
  epoch: number;
  day: number;
  isRestDay: boolean;
  startTimestamp: number;
  prizePool: bigint;
  changeFee: bigint;
  firstVisibleEpoch: number;
}> {
  const addrs = getRuntimeProjectAddresses();
  const [running, epoch, day, isRestDay, startTimestamp, prizePool, changeFee, firstVisibleEpoch] = await readContract(config, {
    address: addrs.tournament as `0x${string}`,
    abi: TOURNAMENT_VIEW_ABI,
    functionName: "getState",
  });
  return {
    running,
    epoch: Number(epoch),
    day: Number(day),
    isRestDay,
    startTimestamp: Number(startTimestamp),
    prizePool,
    changeFee,
    firstVisibleEpoch: Number(firstVisibleEpoch),
  };
}

export async function readEvmPlayerLineups(
  config: Config,
  player: `0x${string}`,
  epoch: number,
): Promise<{ day: number; league: number; slots: { playerId: number; tier: number }[] }[]> {
  const addrs = getRuntimeProjectAddresses();
  const [days, leagues] = await readContract(config, {
    address: addrs.tournament as `0x${string}`,
    abi: TOURNAMENT_VIEW_ABI,
    functionName: "getPlayerWeighings",
    args: [player, BigInt(epoch)],
  });

  return Promise.all(
    (days as bigint[]).map(async (rawDay, index) => {
      const day = Number(rawDay);
      const [playerIds, tiers] = await readContract(config, {
        address: addrs.tournament as `0x${string}`,
        abi: TOURNAMENT_VIEW_ABI,
        functionName: "getWeighingSlots",
        args: [player, BigInt(epoch), BigInt(day)],
      });
      return {
        day,
        league: Number((leagues as number[])[index] ?? 0),
        slots: (playerIds as readonly number[]).map((playerId, slotIndex) => ({
          playerId: Number(playerId),
          tier: Number((tiers as readonly number[])[slotIndex] ?? 0),
        })),
      };
    }),
  );
}

export async function readEvmCancelFee(config: Config): Promise<bigint> {
  const addrs = getRuntimeProjectAddresses();
  return readContract(config, {
    address: addrs.tournament as `0x${string}`,
    abi: TOURNAMENT_VIEW_ABI,
    functionName: "getCancelFee",
  });
}

export async function readEvmOracleDayScores(config: Config, day: number): Promise<{
  playerIds: number[];
  points: bigint[];
  posted: boolean;
}> {
  const addrs = getRuntimeProjectAddresses();
  const [playerIds, points, posted] = await readContract(config, {
    address: addrs.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "getDayScores",
    args: [BigInt(day)],
  });
  return {
    playerIds: [...(playerIds as readonly number[])].map(Number),
    points: [...(points as readonly bigint[])],
    posted,
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export async function submitEvmTx(
  config: Config,
  payload: { function: string; typeArguments: unknown[]; functionArguments: unknown[]; value?: bigint },
): Promise<void> {
  const addrs = getRuntimeProjectAddresses();
  const args = payload.functionArguments;
  const fn = payload.function;

  let hash: `0x${string}`;

  if (fn.includes("::tournament::start_epoch")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "startEpoch",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::tournament::stop_and_reset") || fn.includes("::tournament::queue_stop_and_reset")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "stopAndReset",
      args: [],
    });
  } else if (fn.includes("::tournament::admin_clear_epochs")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "adminClearEpochs",
      args: [],
    });
  } else if (fn.includes("::tournament::submit_lineup")) {
    const ids = (args[0] as (string | number | bigint)[]).map(BigInt) as [bigint, bigint, bigint, bigint, bigint];
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "submitWeighing",
      args: [ids],
    });
  } else if (fn.includes("::tournament::cancel_lineup")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "cancelWeighing",
      args: [],
      value: payload.value ?? 0n,
    });
  } else if (fn.includes("::tournament::set_cancel_fee")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "setConfig",
      args: [BigInt(0), BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::oracle::set_posted")) {
    hash = await wc(config, {
      address: addrs.oracle as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: "setPosted",
      args: [BigInt(args[0] as string | number | bigint), Boolean(args[1])],
    });
  } else if (fn.includes("::oracle::post_scores") || fn.includes("::oracle::post_day_scores")) {
    hash = await wc(config, {
      address: addrs.oracle as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: "postDayScores",
      args: [
        BigInt(args[0] as string | number | bigint),
        args[1] as number[],
        (args[2] as (string | number | bigint)[]).map(BigInt),
      ],
    });
  } else if (fn.includes("::admin_control::grant_role")) {
    hash = await wc(config, {
      address: addrs.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "grantRole",
      args: [args[0] as `0x${string}`, Number(args[1]) as number],
    });
  } else if (fn.includes("::admin_control::revoke_role")) {
    hash = await wc(config, {
      address: addrs.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "revokeRole",
      args: [args[0] as `0x${string}`, Number(args[1]) as number],
    });
  } else if (fn.includes("::fantasy_league::buy_chest")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "buyEgg",
      args: [Number(args[0]), BigInt(args[1] as string | number | bigint)],
      value: payload.value ?? 0n,
    });
  } else if (fn.includes("::fantasy_league::open_chest_batch")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: [{
        name: "scratchEggBatch",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "chestIds", type: "uint256[]" }],
        outputs: [],
      }] as const,
      functionName: "scratchEggBatch",
      args: [(args[0] as (string | number | bigint)[]).map(BigInt)],
    });
  } else if (fn.includes("::fantasy_league::open_chest")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "scratchEgg",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::fantasy_league::merge")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "mergeEggMonets",
      args: [
        Number(args[0]),
        Number(args[1]),
        (args[2] as (string | number | bigint)[]).map(BigInt),
      ],
    });
  } else if (fn.includes("::fantasy_league::transfer_card")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "transferEggMonet",
      args: [args[1] as `0x${string}`, BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::marketplace::list_card")) {
    const isApproved = await readContract(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "isApprovedForAll",
      args: [getAccount(config).address as `0x${string}`, addrs.marketplace as `0x${string}`],
    });
    if (!isApproved) {
      const approveHash = await wc(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_ABI,
        functionName: "setApprovalForAll",
        args: [addrs.marketplace as `0x${string}`, true],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });
    }
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "listEggMonet",
      args: [
        BigInt(args[0] as string | number | bigint),
        BigInt(args[1] as string | number | bigint),
      ],
    });
  } else if (fn.includes("::marketplace::buy_cards_batch")) {
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "buyEggMonetsBatch",
      args: [(args[0] as (string | number | bigint)[]).map(BigInt)],
      value: payload.value ?? 0n,
    });
  } else if (fn.includes("::marketplace::buy_card")) {
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "buyEggMonet",
      args: [BigInt(args[0] as string | number | bigint)],
      value: payload.value ?? 0n,
    });
  } else if (fn.includes("::marketplace::cancel_listing")) {
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::fantasy_league::set_base_uris") || fn.includes("::fantasy_league::queue_set_base_uris")) {
    const decodeArg = (v: unknown) =>
      Array.isArray(v) ? new TextDecoder().decode(new Uint8Array(v as number[])) : v as string;
    const uri0 = decodeArg(args[0]);
    const uri1 = decodeArg(args[1]);
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodePacked(["string", "string"], [uri0, uri1]));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_SET_BASE_URIS, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_ABI,
        functionName: "setBaseUris",
        args: [uri0, uri1],
      });
    }
  } else if (fn.includes("::fantasy_league::admin_mint_to") || fn.includes("::fantasy_league::queue_admin_mint_to")) {
    const mintRecipient = args[0] as `0x${string}`;
    const mintPlayerId  = Number(args[1]);
    const mintTier      = Number(args[2]);
    const mintCount     = BigInt(args[3] as string | number | bigint);
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters(
        [{ type: "address" }, { type: "uint8" }, { type: "uint8" }, { type: "uint256" }],
        [mintRecipient, mintPlayerId, mintTier, mintCount],
      ));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_ADMIN_MINT_TO, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_ABI,
        functionName: "adminMintEggMonet",
        args: [mintRecipient, mintPlayerId, mintTier, mintCount],
      });
    }
  } else if (fn.includes("::fantasy_league::admin_reissue_card")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "adminReissueEggMonet",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::claim::start_claim") || fn.includes("::claim::queue_start_claim")) {
    const returnAddr = args[0] as `0x${string}`;
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters([{ type: "address" }], [returnAddr]));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_START_CLAIM, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.claim as `0x${string}`,
        abi: CLAIM_ABI,
        functionName: "startClaim",
        args: [returnAddr],
      });
    }
  } else if (fn.includes("::claim::close_claim") || fn.includes("::claim::queue_close_claim")) {
    if (fn.includes("queue_")) {
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_CLOSE_CLAIM, keccak256("0x")],
      });
    } else {
      hash = await wc(config, {
        address: addrs.claim as `0x${string}`,
        abi: CLAIM_ABI,
        functionName: "closeClaim",
        args: [],
      });
    }
  } else if (fn.includes("::claim::set_claim_days") || fn.includes("::claim::queue_set_claim_days")) {
    const numDays = BigInt(args[0] as string | number | bigint);
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters([{ type: "uint256" }], [numDays]));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_SET_CLAIM_DAYS, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.claim as `0x${string}`,
        abi: CLAIM_ABI,
        functionName: "setClaimDays",
        args: [numDays],
      });
    }
  } else if (fn.includes("::claim::set_claim_list") || fn.includes("::claim::queue_set_claim_list")) {
    const claimAddrs   = args[0] as `0x${string}`[];
    const claimAmounts = (args[1] as (string | number | bigint)[]).map(BigInt);
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }],
        [claimAddrs, claimAmounts],
      ));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_SET_CLAIM_LIST, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.claim as `0x${string}`,
        abi: CLAIM_ABI,
        functionName: "setClaimList",
        args: [claimAddrs, claimAmounts],
      });
    }
  } else if (fn.includes("::claim::claim")) {
    hash = await wc(config, {
      address: addrs.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "claim",
      args: [],
    });
  } else if (fn.includes("::fantasy_league::set_chest_prices") || fn.includes("::fantasy_league::queue_set_chest_prices")) {
    const [priceW, priceI, priceS] = [
      BigInt(args[0] as string | number | bigint),
      BigInt(args[1] as string | number | bigint),
      BigInt(args[2] as string | number | bigint),
    ];
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
        [priceW, priceI, priceS],
      ));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_SET_EGG_PRICES, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_ABI,
        functionName: "setEggPrices",
        args: [priceW, priceI, priceS],
      });
    }
  } else if (fn.includes("::tournament::admin_withdraw_to") || fn.includes("::tournament::queue_admin_withdraw_to")) {
    const withdrawRecipient = args[0] as `0x${string}`;
    const withdrawAmount    = BigInt(args[1] as string | number | bigint);
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [withdrawRecipient, withdrawAmount],
      ));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_TREASURY_WITHDRAW, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.tournament as `0x${string}`,
        abi: TOURNAMENT_ABI,
        functionName: "withdrawTo",
        args: [withdrawRecipient, withdrawAmount],
      });
    }
  } else if (fn.includes("::oracle::reset_all_days") || fn.includes("::oracle::queue_reset_all_days")) {
    const daysToReset = ((args[0] ?? []) as (string | number | bigint)[]).map(BigInt);
    if (fn.includes("queue_")) {
      const payloadHash = keccak256(encodeAbiParameters(
        [{ type: "uint256[]" }],
        [daysToReset],
      ));
      hash = await wc(config, {
        address: addrs.adminControl as `0x${string}`,
        abi: ADMIN_CONTROL_ABI,
        functionName: "queueAction",
        args: [ACTION_RESET_ALL_ORACLE_DAYS, payloadHash],
      });
    } else {
      hash = await wc(config, {
        address: addrs.oracle as `0x${string}`,
        abi: ORACLE_ABI,
        functionName: "resetAllDays",
        args: [daysToReset],
      });
    }
  } else if (fn.includes("::admin_control::set_action_delay")) {
    hash = await wc(config, {
      address: addrs.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "setActionDelay",
      args: [Number(args[0]), BigInt(args[1] as string | number | bigint)],
    });
  } else if (fn.includes("::admin_control::set_epoch_guard")) {
    hash = await wc(config, {
      address: addrs.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "setEpochGuard",
      args: [Boolean(args[0])],
    });
  } else if (fn.includes("::admin_control::set_withdrawal_policy")) {
    hash = await wc(config, {
      address: addrs.adminControl as `0x${string}`,
      abi: ADMIN_CONTROL_ABI,
      functionName: "setWithdrawalPolicy",
      args: [Boolean(args[0]), BigInt(args[1] as string | number | bigint), BigInt(args[2] as string | number | bigint)],
    });
  } else if (
    fn.includes("::fantasy_league::add_admin") ||
    fn.includes("::fantasy_league::remove_admin") ||
    fn.includes("::admin_control::initialize") ||
    fn.includes("::admin_control::configure_governance")
  ) {
    throw new Error(`Функция "${fn.split("::").pop()}" не имеет аналога в EVM контрактах`);
  } else {
    throw new Error(`submitEvmTx: unmapped function "${fn}"`);
  }

  await waitForTransactionReceipt(config, { hash });
}
