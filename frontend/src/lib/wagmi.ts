import { createConfig, http } from "wagmi";
import { abstractTestnet } from "viem/chains";
import { injected } from "wagmi/connectors";
import { abstractWalletConnector } from "@abstract-foundation/agw-react/connectors";

export function createWagmiConfig() {
  return createConfig({
    chains: [abstractTestnet],
    connectors: [
      abstractWalletConnector(),
      injected({ shimDisconnect: true }),
    ],
    transports: {
      [abstractTestnet.id]: http("https://api.testnet.abs.xyz"),
    },
    ssr: true,
  });
}
