import { createConfig, http } from "wagmi";
import { abstractTestnet } from "viem/chains";
import { injected } from "wagmi/connectors";

export function createWagmiConfig() {
  return createConfig({
    chains: [abstractTestnet],
    connectors: [injected({ shimDisconnect: true })],
    transports: {
      [abstractTestnet.id]: http("https://api.testnet.abs.xyz"),
    },
    ssr: true,
  });
}
