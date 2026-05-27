import { writeContract, readContract, waitForTransactionReceipt } from "@wagmi/core";
import type { Config, WriteContractParameters } from "@wagmi/core";
import { abstractTestnet } from "viem/chains";
import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

function wc(config: Config, params: Omit<WriteContractParameters, "chain">) {
  return writeContract(config, { chain: abstractTestnet, ...params } as WriteContractParameters);
}

// ── Minimal write-only ABIs ────────────────────────────────────────────────

export const TOURNAMENT_ABI = [
  { name: "startEpoch",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "startTimestamp", type: "uint256" }], outputs: [] },
  { name: "stopAndReset",     type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "adminClearEpochs", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "submitLineup",     type: "function", stateMutability: "payable",    inputs: [{ name: "cardIds", type: "uint256[5]" }], outputs: [] },
  { name: "cancelLineup",     type: "function", stateMutability: "payable",    inputs: [], outputs: [] },
  { name: "setConfig",        type: "function", stateMutability: "nonpayable", inputs: [{ name: "_changeLineupFee", type: "uint256" }, { name: "_cancelLineupFee", type: "uint256" }], outputs: [] },
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
  { name: "getLineupSlots", type: "function", stateMutability: "view", inputs: [
    { name: "player", type: "address" },
    { name: "epoch", type: "uint256" },
    { name: "day", type: "uint256" },
  ], outputs: [
    { name: "playerIds", type: "uint8[5]" },
    { name: "tiers", type: "uint8[5]" },
  ]},
  { name: "getPlayerLineups", type: "function", stateMutability: "view", inputs: [
    { name: "player", type: "address" },
    { name: "epoch", type: "uint256" },
  ], outputs: [
    { name: "epochDays", type: "uint256[]" },
    { name: "leagues", type: "uint8[]" },
  ]},
  { name: "getCancelFee", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "", type: "uint256" },
  ]},
] as const;

export const MARKETPLACE_ABI = [
  { name: "listCard", type: "function", stateMutability: "nonpayable", inputs: [{ name: "cardId", type: "uint256" }, { name: "price", type: "uint256" }], outputs: [] },
  { name: "buyCard", type: "function", stateMutability: "payable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { name: "buyCardsBatch", type: "function", stateMutability: "payable", inputs: [{ name: "ids", type: "uint256[]" }], outputs: [] },
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
  { name: "grantRole",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr", type: "address" }, { name: "roleMask", type: "uint8" }], outputs: [] },
  { name: "revokeRole", type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr", type: "address" }, { name: "roleMask", type: "uint8" }], outputs: [] },
] as const;

export const COIN_DECK_NFT_ABI = [
  { name: "buyChest",       type: "function", stateMutability: "payable",    inputs: [{ name: "chestType", type: "uint8" }, { name: "count", type: "uint64" }], outputs: [] },
  { name: "openChest",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "chestId", type: "uint256" }], outputs: [] },
  { name: "mergeCards",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "playerId", type: "uint8" }, { name: "tier", type: "uint8" }, { name: "tokenIds", type: "uint256[]" }], outputs: [] },
  { name: "transferCard",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setBaseUris",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "cardUri", type: "string" }, { name: "chestUri", type: "string" }], outputs: [] },
  { name: "adminMintCard",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "playerId", type: "uint8" }, { name: "tier", type: "uint8" }, { name: "count", type: "uint256" }], outputs: [] },
  { name: "adminReissueCard", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setChestPrices",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "wooden", type: "uint256" }, { name: "iron", type: "uint256" }, { name: "silver", type: "uint256" }], outputs: [] },
] as const;

export const CLAIM_ABI = [
  { name: "claim",         type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "startClaim",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "returnAddr", type: "address" }], outputs: [] },
  { name: "closeClaim",    type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "setClaimDays",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "numDays", type: "uint256" }], outputs: [] },
  { name: "setClaimList",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "addrs", type: "address[]" }, { name: "amounts", type: "uint256[]" }], outputs: [] },
] as const;

const COIN_DECK_NFT_VIEW_ABI = [
  { name: "getChestPrices", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "wooden", type: "uint256" },
    { name: "iron",   type: "uint256" },
    { name: "silver", type: "uint256" },
  ]},
  { name: "getUserCards", type: "function", stateMutability: "view", inputs: [{ name: "owner_", type: "address" }], outputs: [
    { name: "", type: "uint256[]" },
  ]},
  { name: "getUserChests", type: "function", stateMutability: "view", inputs: [{ name: "owner_", type: "address" }], outputs: [
    { name: "", type: "uint256[]" },
  ]},
  { name: "getCardInfo", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [
    { name: "playerId", type: "uint8" },
    { name: "tier", type: "uint8" },
  ]},
  { name: "chests", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [
    { name: "chestType", type: "uint8" },
  ]},
] as const;

export async function readEvmChestPrices(config: Config): Promise<{ wooden: bigint; iron: bigint; silver: bigint }> {
  const addrs = getRuntimeProjectAddresses();
  const [wooden, iron, silver] = await readContract(config, {
    address: addrs.coinDeckNFT as `0x${string}`,
    abi: COIN_DECK_NFT_VIEW_ABI,
    functionName: "getChestPrices",
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
      functionName: "getUserCards",
      args: [owner],
    }),
    readContract(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_VIEW_ABI,
      functionName: "getUserChests",
      args: [owner],
    }),
  ]);

  const cards = await Promise.all(
    (cardIds as bigint[]).map(async (tokenId) => {
      const [playerId, tier] = await readContract(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_VIEW_ABI,
        functionName: "getCardInfo",
        args: [tokenId],
      });
      return { tokenId, playerId: Number(playerId), tier: Number(tier) };
    }),
  );

  const chests = await Promise.all(
    (chestIds as bigint[]).map(async (tokenId) => {
      const chestType = await readContract(config, {
        address: addrs.coinDeckNFT as `0x${string}`,
        abi: COIN_DECK_NFT_VIEW_ABI,
        functionName: "chests",
        args: [tokenId],
      });
      return { tokenId, chestType: Number(chestType) };
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
    functionName: "getPlayerLineups",
    args: [player, BigInt(epoch)],
  });

  return Promise.all(
    (days as bigint[]).map(async (rawDay, index) => {
      const day = Number(rawDay);
      const [playerIds, tiers] = await readContract(config, {
        address: addrs.tournament as `0x${string}`,
        abi: TOURNAMENT_VIEW_ABI,
        functionName: "getLineupSlots",
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
      functionName: "submitLineup",
      args: [ids],
    });
  } else if (fn.includes("::tournament::cancel_lineup")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "cancelLineup",
      args: [],
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
      functionName: "buyChest",
      args: [Number(args[0]), BigInt(args[1] as string | number | bigint)],
      value: payload.value ?? 0n,
    });
  } else if (fn.includes("::fantasy_league::open_chest_batch")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: [{
        name: "openChestBatch",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "chestIds", type: "uint256[]" }],
        outputs: [],
      }] as const,
      functionName: "openChestBatch",
      args: [(args[0] as (string | number | bigint)[]).map(BigInt)],
    });
  } else if (fn.includes("::fantasy_league::open_chest")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "openChest",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::fantasy_league::merge")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "mergeCards",
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
      functionName: "transferCard",
      args: [args[1] as `0x${string}`, BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::marketplace::list_card")) {
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "listCard",
      args: [
        BigInt(args[0] as string | number | bigint),
        BigInt(args[1] as string | number | bigint),
      ],
    });
  } else if (fn.includes("::marketplace::buy_cards_batch")) {
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "buyCardsBatch",
      args: [(args[0] as (string | number | bigint)[]).map(BigInt)],
      value: payload.value ?? 0n,
    });
  } else if (fn.includes("::marketplace::buy_card")) {
    hash = await wc(config, {
      address: addrs.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: "buyCard",
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
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "setBaseUris",
      args: [decodeArg(args[0]), decodeArg(args[1])],
    });
  } else if (fn.includes("::fantasy_league::admin_mint_to") || fn.includes("::fantasy_league::queue_admin_mint_to")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "adminMintCard",
      args: [
        args[0] as `0x${string}`,
        Number(args[1]),
        Number(args[2]),
        BigInt(args[3] as string | number | bigint),
      ],
    });
  } else if (fn.includes("::fantasy_league::admin_reissue_card")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "adminReissueCard",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::claim::start_claim") || fn.includes("::claim::queue_start_claim")) {
    hash = await wc(config, {
      address: addrs.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "startClaim",
      args: [args[0] as `0x${string}`],
    });
  } else if (fn.includes("::claim::close_claim") || fn.includes("::claim::queue_close_claim")) {
    hash = await wc(config, {
      address: addrs.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "closeClaim",
      args: [],
    });
  } else if (fn.includes("::claim::set_claim_days") || fn.includes("::claim::queue_set_claim_days")) {
    hash = await wc(config, {
      address: addrs.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "setClaimDays",
      args: [BigInt(args[0] as string | number | bigint)],
    });
  } else if (fn.includes("::claim::set_claim_list") || fn.includes("::claim::queue_set_claim_list")) {
    hash = await wc(config, {
      address: addrs.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "setClaimList",
      args: [
        args[0] as `0x${string}`[],
        (args[1] as (string | number | bigint)[]).map(BigInt),
      ],
    });
  } else if (fn.includes("::claim::claim")) {
    hash = await wc(config, {
      address: addrs.claim as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "claim",
      args: [],
    });
  } else if (fn.includes("::fantasy_league::set_chest_prices") || fn.includes("::fantasy_league::queue_set_chest_prices")) {
    hash = await wc(config, {
      address: addrs.coinDeckNFT as `0x${string}`,
      abi: COIN_DECK_NFT_ABI,
      functionName: "setChestPrices",
      args: [
        BigInt(args[0] as string | number | bigint),
        BigInt(args[1] as string | number | bigint),
        BigInt(args[2] as string | number | bigint),
      ],
    });
  } else if (fn.includes("::tournament::admin_withdraw_to") || fn.includes("::tournament::queue_admin_withdraw_to")) {
    hash = await wc(config, {
      address: addrs.tournament as `0x${string}`,
      abi: TOURNAMENT_ABI,
      functionName: "withdrawTo",
      args: [args[0] as `0x${string}`, BigInt(args[1] as string | number | bigint)],
    });
  } else if (fn.includes("::oracle::reset_all_days") || fn.includes("::oracle::queue_reset_all_days")) {
    hash = await wc(config, {
      address: addrs.oracle as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: "resetAllDays",
      args: [((args[0] ?? []) as (string | number | bigint)[]).map(BigInt)],
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
