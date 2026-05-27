import rawAddressBook from "./project-addresses.json";

type NetworkKey = keyof typeof rawAddressBook.networks;

type ProjectAddresses = {
  activeNetwork: NetworkKey;
  networkLabel: string;
  moduleAddress: string;
  adminAddress: string;
  prizeVaultAddress: string;
  claimVaultAddress: string;
  restUrl: string;
  faucetUrl: string;
  explorerUrl: string;
  debugWallets: string[];
};

const activeNetwork = rawAddressBook.activeNetwork as NetworkKey;
const activeConfig = rawAddressBook.networks[activeNetwork];

export const projectAddresses: ProjectAddresses = {
  activeNetwork,
  networkLabel: activeConfig.label,
  moduleAddress: activeConfig.contracts.moduleAddress,
  adminAddress: activeConfig.contracts.adminAddress,
  prizeVaultAddress: activeConfig.contracts.prizeVaultAddress,
  claimVaultAddress: activeConfig.contracts.claimVaultAddress,
  restUrl: activeConfig.urls.restUrl,
  faucetUrl: activeConfig.urls.faucetUrl,
  explorerUrl: activeConfig.urls.explorerUrl,
  debugWallets: [...activeConfig.wallets.debugWallets],
};

export function getRuntimeProjectAddresses(env: NodeJS.ProcessEnv = process.env): ProjectAddresses {
  // ACTIVE_NETWORK env overrides the JSON activeNetwork field.
  const networkOverride = env.ACTIVE_NETWORK as NetworkKey | undefined;
  const base = networkOverride && networkOverride in rawAddressBook.networks
    ? {
        ...projectAddresses,
        activeNetwork: networkOverride,
        networkLabel: rawAddressBook.networks[networkOverride].label,
        moduleAddress: rawAddressBook.networks[networkOverride].contracts.moduleAddress,
        adminAddress: rawAddressBook.networks[networkOverride].contracts.adminAddress,
        prizeVaultAddress: rawAddressBook.networks[networkOverride].contracts.prizeVaultAddress,
        claimVaultAddress: rawAddressBook.networks[networkOverride].contracts.claimVaultAddress,
        restUrl: rawAddressBook.networks[networkOverride].urls.restUrl,
        faucetUrl: rawAddressBook.networks[networkOverride].urls.faucetUrl,
        explorerUrl: rawAddressBook.networks[networkOverride].urls.explorerUrl,
        debugWallets: [...rawAddressBook.networks[networkOverride].wallets.debugWallets],
      }
    : { ...projectAddresses };

  return {
    ...base,
    moduleAddress: env.CONTRACT_ADDRESS ?? env.MODULE_ADDR ?? base.moduleAddress,
    adminAddress: env.ADMIN_ADDRESS ?? base.adminAddress,
    prizeVaultAddress: env.VAULT_ADDRESS ?? env.PRIZE_VAULT_ADDRESS ?? base.prizeVaultAddress,
    claimVaultAddress: env.CLAIM_VAULT_ADDRESS ?? base.claimVaultAddress,
    restUrl: env.REST_URL ?? base.restUrl,
    faucetUrl: env.FAUCET_URL ?? base.faucetUrl,
  };
}
