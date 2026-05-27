import rawAddressBook from "./project-addresses.json";

type NetworkKey = keyof typeof rawAddressBook.networks;

type ProjectAddresses = {
  activeNetwork: NetworkKey;
  networkLabel: string;
  moduleAddress: string;
  adminAddress: string;
  prizeVaultAddress: string;
  claimVaultAddress: string;
  adminControl: string;
  coinDeckNFT: string;
  tournament: string;
  oracle: string;
  claim: string;
  marketplace: string;
  restUrl: string;
  faucetUrl: string;
  explorerUrl: string;
  debugWallets: string[];
};

function buildAddresses(network: NetworkKey): ProjectAddresses {
  const cfg = rawAddressBook.networks[network];
  return {
    activeNetwork: network,
    networkLabel: cfg.label,
    moduleAddress: cfg.contracts.moduleAddress,
    adminAddress: cfg.contracts.adminAddress,
    prizeVaultAddress: cfg.contracts.prizeVaultAddress,
    claimVaultAddress: cfg.contracts.claimVaultAddress,
    adminControl: cfg.contracts.adminControl,
    coinDeckNFT: cfg.contracts.coinDeckNFT,
    tournament: cfg.contracts.tournament,
    oracle: cfg.contracts.oracle,
    claim: cfg.contracts.claim,
    marketplace: cfg.contracts.marketplace,
    restUrl: cfg.urls.restUrl,
    faucetUrl: cfg.urls.faucetUrl,
    explorerUrl: cfg.urls.explorerUrl,
    debugWallets: [...cfg.wallets.debugWallets],
  };
}

const activeNetwork = rawAddressBook.activeNetwork as NetworkKey;
export const projectAddresses: ProjectAddresses = buildAddresses(activeNetwork);

export function getRuntimeProjectAddresses(env: NodeJS.ProcessEnv = process.env): ProjectAddresses {
  const networkOverride = env.ACTIVE_NETWORK as NetworkKey | undefined;
  const base = networkOverride && networkOverride in rawAddressBook.networks
    ? buildAddresses(networkOverride)
    : { ...projectAddresses };

  return {
    ...base,
    moduleAddress: env.CONTRACT_ADDRESS ?? env.MODULE_ADDR ?? base.moduleAddress,
    adminAddress: env.ADMIN_ADDRESS ?? base.adminAddress,
    prizeVaultAddress: env.VAULT_ADDRESS ?? env.PRIZE_VAULT_ADDRESS ?? base.prizeVaultAddress,
    claimVaultAddress: env.CLAIM_VAULT_ADDRESS ?? base.claimVaultAddress,
    adminControl: env.ADMIN_CONTROL ?? base.adminControl,
    coinDeckNFT: env.COIN_DECK_NFT ?? base.coinDeckNFT,
    tournament: env.TOURNAMENT ?? base.tournament,
    oracle: env.ORACLE ?? base.oracle,
    claim: env.CLAIM ?? base.claim,
    marketplace: env.MARKETPLACE ?? base.marketplace,
    restUrl: env.REST_URL ?? base.restUrl,
    faucetUrl: env.FAUCET_URL ?? base.faucetUrl,
  };
}
