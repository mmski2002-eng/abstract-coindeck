import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Provider, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const ADMIN = "0xeE2a1267C3CE8a7C4ABB89c2098a39073D326DC0";

const TARGETS = [
  "0x1b5f18bc201C91A39dC53090A9a152155ebAdCB0",
  "0x0A8904D0699CA161450F6fade08Ba328f87f6Cae",
  "0xb69753cbBa15f2cc536469dcC6dE6fDb5a051BdC",
  "0x8A304B3519717634a5FB7F883Dbc43E3948ec536",
];

const WITHDRAW_TO_ABI = [{
  name: "withdrawTo",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [],
}];

const WITHDRAW_FEES_ABI = [{
  name: "withdrawFees",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }],
  outputs: [],
}];

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  const wallet   = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

  for (const addr of TARGETS) {
    const bal = await provider.getBalance(addr);
    if (bal === 0n) { console.log(`${addr}: 0 ETH, skip`); continue; }
    console.log(`\n${addr}: ${(Number(bal) / 1e18).toFixed(6)} ETH`);

    // try withdrawTo (Tournament)
    try {
      const c = new Contract(addr, WITHDRAW_TO_ABI, wallet);
      const tx = await c.withdrawTo(ADMIN, bal);
      await tx.wait();
      console.log(`  ✓ withdrawTo OK  tx=${tx.hash}`);
      continue;
    } catch (e: any) {
      console.log(`  withdrawTo failed: ${e.message?.slice(0,80)}`);
    }

    // try withdrawFees (Marketplace)
    try {
      const c = new Contract(addr, WITHDRAW_FEES_ABI, wallet);
      const tx = await c.withdrawFees(ADMIN);
      await tx.wait();
      console.log(`  ✓ withdrawFees OK  tx=${tx.hash}`);
      continue;
    } catch (e: any) {
      console.log(`  withdrawFees failed: ${e.message?.slice(0,80)}`);
    }

    console.log(`  ✗ could not withdraw from ${addr}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
