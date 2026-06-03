import { createConfig, http } from "wagmi";
import type { EIP1193Provider } from "viem";
import { abstractTestnet } from "viem/chains";
import { injected, metaMask } from "wagmi/connectors";
import { abstractWalletConnector } from "@abstract-foundation/agw-react/connectors";

type OptionalWalletProvider = EIP1193Provider & {
  isRabby?: boolean;
};

function toWalletProvider(provider: unknown): EIP1193Provider | undefined {
  if (!provider || typeof provider !== "object" || !("request" in provider)) return undefined;
  return provider as EIP1193Provider;
}

export function createWagmiConfig() {
  return createConfig({
    chains: [abstractTestnet],
    connectors: [
      abstractWalletConnector(),
      metaMask(),
      injected({
        target: {
          name: "OKX Wallet",
          id: "okxWallet",
          provider: () =>
            typeof window !== "undefined"
              ? toWalletProvider((window as unknown as { okxwallet?: unknown }).okxwallet)
              : undefined,
        },
      }),
      injected({
        target: {
          name: "Rabby Wallet",
          id: "rabby",
          provider: () => {
            if (typeof window === "undefined") return undefined;
            const w = window as unknown as {
              rabby?: unknown;
              ethereum?: OptionalWalletProvider;
            };
            return toWalletProvider(w.rabby) ?? (w.ethereum?.isRabby ? w.ethereum : undefined);
          },
        },
      }),
    ],
    multiInjectedProviderDiscovery: false,
    transports: {
      [abstractTestnet.id]: http("https://api.testnet.abs.xyz"),
    },
    ssr: true,
  });
}
