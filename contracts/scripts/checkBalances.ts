import { Provider } from "zksync-ethers";
import * as hre from "hardhat";

const addrs: Record<string, string> = {
  coinDeckNFT:  "0x557eFCE8F63a57cFAF97e25e8c07698fA71D4FA3",
  tournament:   "0x0d7c2d6A5C9E2B2988B2071f2e0a345692d06112",
  oracle:       "0x6E4719dc2B733A6705a1684aA746F44197a72aEB",
  claim:        "0x8760A2DA7477D82B1359B614aE55cb10a1ef39D8",
  adminControl: "0x5d3df95aF1997fE71935078f56E325438Fe2d440",
  marketplace:  "0x542dfa5Eb1C5AE07E62d7423Ed374825Fbf0Ac5A",
};

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  for (const [name, addr] of Object.entries(addrs)) {
    const bal = await provider.getBalance(addr);
    console.log(`${name}: ${(Number(bal) / 1e18).toFixed(6)} ETH  (${bal.toString()} wei)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
