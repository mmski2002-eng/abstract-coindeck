import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Provider, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const ADMIN   = "0xeE2a1267C3CE8a7C4ABB89c2098a39073D326DC0";
const OLD_NFT = "0xcfF1401d87e95CD56F4cc90B3d05E059D1834852";
const NEW_NFT = "0x557eFCE8F63a57cFAF97e25e8c07698fA71D4FA3";

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  const wallet   = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact("CoinDeckNFT");

  const oldNft = new Contract(OLD_NFT, artifact.abi, wallet);
  const newNft = new Contract(NEW_NFT, artifact.abi, wallet);

  const [oCards, oChests, nCards, nChests] = await Promise.all([
    oldNft.getUserCards(ADMIN),
    oldNft.getUserChests(ADMIN),
    newNft.getUserCards(ADMIN),
    newNft.getUserChests(ADMIN),
  ]);
  const cardUri  = await newNft.cardBaseUri();
  const chestUri = await newNft.chestBaseUri();

  console.log(`OLD: cards=${oCards.length} chests=${oChests.length}`);
  console.log(`NEW: cards=${nCards.length} chests=${nChests.length}`);
  console.log(`cardBaseUri:  ${cardUri}`);
  console.log(`chestBaseUri: ${chestUri}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
