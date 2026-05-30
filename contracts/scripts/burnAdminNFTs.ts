import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Provider, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const ADMIN = "0xeE2a1267C3CE8a7C4ABB89c2098a39073D326DC0";
const OLD_NFT = "0xcfF1401d87e95CD56F4cc90B3d05E059D1834852";
const NEW_NFT = "0x9f5B01B3ed2e5C715c5100971E991340c327D3e3";

async function burnAll(nft: Contract, label: string) {
  const cards  = await nft.getUserCards(ADMIN);
  const chests = await nft.getUserChests(ADMIN);
  const all    = [...cards, ...chests].map((id: bigint) => id.toString());

  console.log(`\n${label}: ${all.length} tokens`);
  if (all.length === 0) return;

  for (const id of all) {
    try {
      const tx = await nft.burn(id);
      await tx.wait();
      console.log(`  burned #${id} tx: ${tx.hash}`);
    } catch (e: any) {
      console.log(`  skip #${id}: ${e.message?.slice(0, 80)}`);
    }
  }
}

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  const wallet   = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const deployer = new Deployer(hre, wallet);
  console.log("Caller:", wallet.address);

  const artifact = await deployer.loadArtifact("CoinDeckNFT");
  const oldNft   = new Contract(OLD_NFT, artifact.abi, wallet);
  const newNft   = new Contract(NEW_NFT, artifact.abi, wallet);

  await burnAll(oldNft, `OLD (${OLD_NFT})`);
  await burnAll(newNft, `NEW (${NEW_NFT})`);

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
