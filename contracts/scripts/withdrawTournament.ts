import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Provider, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const ADMIN        = "0xeE2a1267C3CE8a7C4ABB89c2098a39073D326DC0";
const TOURNAMENT   = "0x0d7c2d6A5C9E2B2988B2071f2e0a345692d06112";

async function main() {
  const provider  = new Provider((hre.network.config as any).url);
  const wallet    = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const deployer  = new Deployer(hre, wallet);
  const artifact  = await deployer.loadArtifact("Tournament");
  const tournament = new Contract(TOURNAMENT, artifact.abi, wallet);

  const bal = await provider.getBalance(TOURNAMENT);
  console.log(`Tournament balance: ${(Number(bal) / 1e18).toFixed(6)} ETH`);

  if (bal === 0n) {
    console.log("Nothing to withdraw");
    return;
  }

  console.log(`Withdrawing ${(Number(bal) / 1e18).toFixed(6)} ETH to ${ADMIN}...`);
  const tx = await tournament.withdrawTo(ADMIN, bal);
  const receipt = await tx.wait();
  console.log(`Done: ${receipt.hash}`);

  const newBal = await provider.getBalance(TOURNAMENT);
  console.log(`Tournament balance after: ${(Number(newBal) / 1e18).toFixed(6)} ETH`);
}

main().catch((e) => { console.error(e); process.exit(1); });
