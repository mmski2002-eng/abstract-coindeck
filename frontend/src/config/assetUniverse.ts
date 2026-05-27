// Single source of truth for all 50 game assets.
// Bump ASSET_SET_VERSION whenever the list or role assignments change.
export const ASSET_SET_VERSION = 1;

// roleId: 0=L1, 1=L2, 2=DeFi, 3=Exchange, 4=Meme/Infra
type Asset = {
  name: string;
  ticker: string;
  cgkId: string;
  roleId: number;
  team: string;
  role: string;
  brandColor: string;
  cgkSlug: string;
  iconPath: string;
  githubRepo: string | null;
};

const CGK = "https://assets.coingecko.com/coins/images/";

export const ASSETS: Asset[] = [
  { name: "Bitcoin",           ticker: "BTC",   cgkId: "bitcoin",                  roleId: 0, team: "Layer 1",        role: "PoW",        brandColor: "#F7931A", cgkSlug: "1/small/bitcoin.png",                               iconPath: "/coins/0_BTC.webp",   githubRepo: "bitcoin/bitcoin" },
  { name: "Ethereum",          ticker: "ETH",   cgkId: "ethereum",                 roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#627EEA", cgkSlug: "279/small/ethereum.png",                            iconPath: "/coins/1_ETH.webp",   githubRepo: "ethereum/go-ethereum" },
  { name: "BNB",               ticker: "BNB",   cgkId: "binancecoin",              roleId: 3, team: "Exchange",       role: "BEP-20",     brandColor: "#F3BA2F", cgkSlug: "825/small/bnb-icon2_2x.png",                        iconPath: "/coins/2_BNB.webp",   githubRepo: null },
  { name: "XRP",               ticker: "XRP",   cgkId: "ripple",                   roleId: 0, team: "Layer 1",        role: "XRPL",       brandColor: "#00AAE4", cgkSlug: "44/small/xrp-symbol-white-128.png",                 iconPath: "/coins/3_XRP.webp",   githubRepo: "XRPLF/rippled" },
  { name: "Solana",            ticker: "SOL",   cgkId: "solana",                   roleId: 0, team: "Layer 1",        role: "PoH",        brandColor: "#9945FF", cgkSlug: "4128/small/solana.png",                             iconPath: "/coins/4_SOL.webp",   githubRepo: "solana-labs/solana" },
  { name: "Dogecoin",          ticker: "DOGE",  cgkId: "dogecoin",                 roleId: 4, team: "Meme",           role: "Meme",       brandColor: "#C2A633", cgkSlug: "5/small/dogecoin.png",                              iconPath: "/coins/5_DOGE.webp",  githubRepo: "dogecoin/dogecoin" },
  { name: "Cardano",           ticker: "ADA",   cgkId: "cardano",                  roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#0033AD", cgkSlug: "975/small/cardano.png",                             iconPath: "/coins/6_ADA.webp",   githubRepo: "input-output-hk/cardano-node" },
  { name: "TRON",              ticker: "TRX",   cgkId: "tron",                     roleId: 0, team: "Layer 1",        role: "DPoS",       brandColor: "#EF0027", cgkSlug: "1094/small/tronix.png",                             iconPath: "/coins/7_TRX.webp",   githubRepo: "tronprotocol/java-tron" },
  { name: "Avalanche",         ticker: "AVAX",  cgkId: "avalanche-2",              roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#E84142", cgkSlug: "12559/small/Avalanche_Circle_RedWhite_Trans.png",   iconPath: "/coins/8_AVAX.webp",  githubRepo: "ava-labs/avalanchego" },
  { name: "Shiba Inu",         ticker: "SHIB",  cgkId: "shiba-inu",                roleId: 4, team: "Meme",           role: "Meme",       brandColor: "#FFA409", cgkSlug: "11939/small/shiba.png",                             iconPath: "/coins/9_SHIB.webp",  githubRepo: null },
  { name: "Polkadot",          ticker: "DOT",   cgkId: "polkadot",                 roleId: 4, team: "Infrastructure", role: "Relay",      brandColor: "#E6007A", cgkSlug: "12171/small/polkadot.png",                          iconPath: "/coins/10_DOT.webp",  githubRepo: "paritytech/polkadot-sdk" },
  { name: "Bitcoin Cash",      ticker: "BCH",   cgkId: "bitcoin-cash",             roleId: 0, team: "Layer 1",        role: "PoW",        brandColor: "#4CC947", cgkSlug: "780/small/bitcoin-cash-circle.png",                 iconPath: "/coins/11_BCH.webp",  githubRepo: "bitcoin-cash-node/bitcoin-cash-node" },
  { name: "Chainlink",         ticker: "LINK",  cgkId: "chainlink",                roleId: 4, team: "Infrastructure", role: "Oracle",     brandColor: "#375BD2", cgkSlug: "877/small/chainlink-new-logo.png",                  iconPath: "/coins/12_LINK.webp", githubRepo: "smartcontractkit/chainlink" },
  { name: "NEAR Protocol",     ticker: "NEAR",  cgkId: "near",                     roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#00C08B", cgkSlug: "10365/small/near.jpg",                              iconPath: "/coins/13_NEAR.webp", githubRepo: "near/nearcore" },
  { name: "Litecoin",          ticker: "LTC",   cgkId: "litecoin",                 roleId: 0, team: "Layer 1",        role: "PoW",        brandColor: "#BFBBBB", cgkSlug: "2/small/litecoin.png",                              iconPath: "/coins/14_LTC.webp",  githubRepo: "litecoin-project/litecoin" },
  { name: "Uniswap",           ticker: "UNI",   cgkId: "uniswap",                  roleId: 2, team: "DeFi",           role: "AMM DEX",    brandColor: "#FF007A", cgkSlug: "12504/small/uniswap-uni-logo.png",                  iconPath: "/coins/15_UNI.webp",  githubRepo: "Uniswap/v3-core" },
  { name: "Aptos",             ticker: "APT",   cgkId: "aptos",                    roleId: 0, team: "Layer 1",        role: "Move VM",    brandColor: "#00B5C7", cgkSlug: "26455/small/aptos_round.png",                       iconPath: "/coins/16_APT.webp",  githubRepo: "aptos-labs/aptos-core" },
  { name: "Hedera",            ticker: "HBAR",  cgkId: "hedera-hashgraph",         roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#00C89A", cgkSlug: "3688/small/hbar.png",                               iconPath: "/coins/17_HBAR.webp", githubRepo: "hashgraph/hedera-services" },
  { name: "Monero",            ticker: "XMR",   cgkId: "monero",                   roleId: 0, team: "Layer 1",        role: "PoW",        brandColor: "#FF6600", cgkSlug: "69/small/monero_logo.png",                          iconPath: "/coins/18_XMR.webp",  githubRepo: "monero-project/monero" },
  { name: "Internet Computer", ticker: "ICP",   cgkId: "internet-computer",        roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#3B00B9", cgkSlug: "14495/small/Internet_Computer_logo.png",            iconPath: "/coins/19_ICP.webp",  githubRepo: "dfinity/ic" },
  { name: "Ethereum Classic",  ticker: "ETC",   cgkId: "ethereum-classic",         roleId: 0, team: "Layer 1",        role: "PoW",        brandColor: "#328332", cgkSlug: "328/small/ethereum-classic.png",                    iconPath: "/coins/20_ETC.webp",  githubRepo: "ethereumclassic/go-ethereum" },
  { name: "OKB",               ticker: "OKB",   cgkId: "okb",                      roleId: 3, team: "Exchange",       role: "Utility",    brandColor: "#6FAEEB", cgkSlug: "4463/small/WeChat_Image_20220118095654.png",         iconPath: "/coins/21_OKB.webp",  githubRepo: null },
  { name: "Cosmos",            ticker: "ATOM",  cgkId: "cosmos",                   roleId: 4, team: "Infrastructure", role: "IBC",        brandColor: "#2E3148", cgkSlug: "1481/small/cosmos_hub.png",                         iconPath: "/coins/22_ATOM.webp", githubRepo: "cosmos/cosmos-sdk" },
  { name: "Filecoin",          ticker: "FIL",   cgkId: "filecoin",                 roleId: 4, team: "Infrastructure", role: "Storage",    brandColor: "#0290FF", cgkSlug: "12817/small/filecoin.png",                          iconPath: "/coins/23_FIL.webp",  githubRepo: "filecoin-project/lotus" },
  { name: "Arbitrum",          ticker: "ARB",   cgkId: "arbitrum",                 roleId: 1, team: "Layer 2",        role: "Rollup",     brandColor: "#2D374B", cgkSlug: "16547/small/photo_2023-03-29_21.47.00.jpeg",        iconPath: "/coins/24_ARB.webp",  githubRepo: "OffchainLabs/nitro" },
  { name: "Polygon",           ticker: "POL",   cgkId: "polygon-ecosystem-token",  roleId: 1, team: "Layer 2",        role: "Rollup",     brandColor: "#8247E5", cgkSlug: "26575/small/pol-polygon-new-logo.png",               iconPath: "/coins/25_POL.webp",  githubRepo: "maticnetwork/bor" },
  { name: "Stellar",           ticker: "XLM",   cgkId: "stellar",                  roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#000000", cgkSlug: "100/small/Stellar_symbol_black_RGB.png",            iconPath: "/coins/26_XLM.webp",  githubRepo: "stellar/stellar-core" },
  { name: "Optimism",          ticker: "OP",    cgkId: "optimism",                 roleId: 1, team: "Layer 2",        role: "Rollup",     brandColor: "#FF0420", cgkSlug: "25244/small/Optimism.png",                          iconPath: "/coins/27_OP.webp",   githubRepo: "ethereum-optimism/optimism" },
  { name: "Immutable",         ticker: "IMX",   cgkId: "immutable-x",              roleId: 1, team: "Layer 2",        role: "Rollup",     brandColor: "#17B5EB", cgkSlug: "17500/small/imx.png",                               iconPath: "/coins/28_IMX.webp",  githubRepo: "immutable/imx-contracts" },
  { name: "Mantle",            ticker: "MNT",   cgkId: "mantle",                   roleId: 1, team: "Layer 2",        role: "Rollup",     brandColor: "#00B4E5", cgkSlug: "27075/small/mantle-seeklogo.png",                   iconPath: "/coins/29_MNT.webp",  githubRepo: null },
  { name: "VeChain",           ticker: "VET",   cgkId: "vechain",                  roleId: 4, team: "Infrastructure", role: "PoA",        brandColor: "#40A578", cgkSlug: "1167/small/VET_Token_Icon.png",                     iconPath: "/coins/30_VET.webp",  githubRepo: "vechain/thor" },
  { name: "Cronos",            ticker: "CRO",   cgkId: "crypto-com-chain",         roleId: 3, team: "Exchange",       role: "PoS",        brandColor: "#002D74", cgkSlug: "7310/small/cro_token_logo.png",                     iconPath: "/coins/31_CRO.webp",  githubRepo: null },
  { name: "Stacks",            ticker: "STX",   cgkId: "blockstack",               roleId: 1, team: "Layer 2",        role: "PoX",        brandColor: "#5546FF", cgkSlug: "4847/small/Stacks_logo_full.png",                   iconPath: "/coins/32_STX.webp",  githubRepo: "stacks-network/stacks-core" },
  { name: "Algorand",          ticker: "ALGO",  cgkId: "algorand",                 roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#009B77", cgkSlug: "4380/small/download.png",                           iconPath: "/coins/33_ALGO.webp", githubRepo: "algorand/go-algorand" },
  { name: "Render",            ticker: "RNDR",  cgkId: "render-token",             roleId: 4, team: "Infrastructure", role: "Compute",    brandColor: "#FF4500", cgkSlug: "11636/small/rndr.png",                              iconPath: "/coins/34_RNDR.webp", githubRepo: "rendernetwork/contracts" },
  { name: "Injective",         ticker: "INJ",   cgkId: "injective-protocol",       roleId: 2, team: "DeFi",           role: "PoS",        brandColor: "#00ADD8", cgkSlug: "12882/small/Secondary_Symbol.png",                  iconPath: "/coins/35_INJ.webp",  githubRepo: "InjectiveLabs/injective-core" },
  { name: "The Graph",         ticker: "GRT",   cgkId: "the-graph",                roleId: 4, team: "Infrastructure", role: "Indexer",    brandColor: "#6747ED", cgkSlug: "13397/small/Graph_Token.png",                       iconPath: "/coins/36_GRT.webp",  githubRepo: "graphprotocol/graph-node" },
  { name: "Sui",               ticker: "SUI",   cgkId: "sui",                      roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#6FBCF0", cgkSlug: "26375/small/sui-ocean-square.png",                  iconPath: "/coins/37_SUI.webp",  githubRepo: "MystenLabs/sui" },
  { name: "Fantom",            ticker: "FTM",   cgkId: "fantom",                   roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#1969FF", cgkSlug: "4001/small/Fantom_round.png",                       iconPath: "/coins/38_FTM.webp",  githubRepo: "Fantom-Foundation/go-opera" },
  { name: "Theta",             ticker: "THETA", cgkId: "theta-token",              roleId: 4, team: "Infrastructure", role: "PoS",        brandColor: "#2BB673", cgkSlug: "2416/small/theta-token-logo.png",                   iconPath: "/coins/39_THETA.webp",githubRepo: "thetatoken/theta-protocol-ledger" },
  { name: "EOS",               ticker: "EOS",   cgkId: "eos",                      roleId: 0, team: "Layer 1",        role: "DPoS",       brandColor: "#00B0EB", cgkSlug: "738/small/eos-eos-logo.png",                        iconPath: "/coins/40_EOS.webp",  githubRepo: "EOSIO/eos" },
  { name: "Aave",              ticker: "AAVE",  cgkId: "aave",                     roleId: 2, team: "DeFi",           role: "Lending",    brandColor: "#B6509E", cgkSlug: "12645/small/AAVE.png",                              iconPath: "/coins/41_AAVE.webp", githubRepo: "aave/aave-protocol" },
  { name: "Maker",             ticker: "MKR",   cgkId: "maker",                    roleId: 2, team: "DeFi",           role: "Governance", brandColor: "#1AAB9B", cgkSlug: "1364/small/Mark_Maker.png",                         iconPath: "/coins/42_MKR.webp",  githubRepo: "makerdao/dss" },
  { name: "Lido",              ticker: "LDO",   cgkId: "lido-dao",                 roleId: 2, team: "DeFi",           role: "Staking",    brandColor: "#00A3FF", cgkSlug: "13573/small/Lido_DAO.png",                          iconPath: "/coins/43_LDO.webp",  githubRepo: "lidofinance/lido-dao" },
  { name: "Sei",               ticker: "SEI",   cgkId: "sei-network",              roleId: 0, team: "Layer 1",        role: "PoS",        brandColor: "#9B2CE3", cgkSlug: "28205/small/Sei_Logo_-_Transparent.png",            iconPath: "/coins/44_SEI.webp",  githubRepo: "sei-protocol/sei-chain" },
  { name: "Kaspa",             ticker: "KAS",   cgkId: "kaspa",                    roleId: 0, team: "Layer 1",        role: "PoW",        brandColor: "#70C7BA", cgkSlug: "25751/small/kaspa-icon-exchanges.png",              iconPath: "/coins/45_KAS.webp",  githubRepo: null },
  { name: "Pepe",              ticker: "PEPE",  cgkId: "pepe",                     roleId: 4, team: "Meme",           role: "Meme",       brandColor: "#ED1EFF", cgkSlug: "29850/small/pepe-token.jpeg",                       iconPath: "/coins/46_PEPE.webp", githubRepo: null },
  { name: "Bonk",              ticker: "BONK",  cgkId: "bonk",                     roleId: 4, team: "Meme",           role: "Meme",       brandColor: "#FF9900", cgkSlug: "28600/small/bonk.jpg",                              iconPath: "/coins/47_BONK.webp", githubRepo: null },
  { name: "dogwifhat",         ticker: "WIF",   cgkId: "dogwifcoin",               roleId: 4, team: "Meme",           role: "Meme",       brandColor: "#FF6B35", cgkSlug: "33566/small/dogwifhat.jpg",                         iconPath: "/coins/48_WIF.webp",  githubRepo: null },
  { name: "Abstract",          ticker: "ABS",   cgkId: "movement",                 roleId: 0, team: "Layer 1",        role: "Move VM",    brandColor: "#00c2d7", cgkSlug: "32452/small/movement.jpg",                          iconPath: "/coins/49_MOVE.webp", githubRepo: "movementlabsxyz/movement" },
];

// Derived flat arrays — used as backward-compat exports and by workers.
export const ASSET_NAMES         = ASSETS.map((a) => a.name);
export const ASSET_TICKERS       = ASSETS.map((a) => a.ticker);
export const ASSET_CGK_IDS       = ASSETS.map((a) => a.cgkId);
export const ASSET_ROLE_IDS      = ASSETS.map((a) => a.roleId);
export const ASSET_TEAMS         = ASSETS.map((a) => a.team);
export const ASSET_ROLES         = ASSETS.map((a) => a.role);
export const ASSET_BRAND_COLORS  = ASSETS.map((a) => a.brandColor);
export const ASSET_CGK_BASE_URL  = CGK;
export const ASSET_CGK_SLUGS     = ASSETS.map((a) => a.cgkSlug);
export const ASSET_CGK_IMAGES    = ASSETS.map((a) => CGK + a.cgkSlug);
export const ASSET_ICON_PATHS    = ASSETS.map((a) => a.iconPath);
export const ASSET_GITHUB_REPOS  = ASSETS.map((a) => a.githubRepo);

// CoinGecko numeric image ID → player index (for NFT generation).
export const ASSET_CGK_IMG_ID_TO_PLAYER: Record<number, number> = Object.fromEntries(
  ASSETS.map((a, i) => [Number(a.cgkSlug.split("/")[0]), i]),
);
