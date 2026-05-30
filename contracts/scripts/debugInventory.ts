import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Provider, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const ADMIN   = "0xeE2a1267C3CE8a7C4ABB89c2098a39073D326DC0";
const NFT_ADDR = "0x557eFCE8F63a57cFAF97e25e8c07698fA71D4FA3";

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  const wallet   = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact("CoinDeckNFT");
  const nft = new Contract(NFT_ADDR, artifact.abi, wallet);

  const cardIds  = await nft.getUserCards(ADMIN);
  const chestIds = await nft.getUserChests(ADMIN);

  console.log("cardIds:", cardIds.map(String));
  console.log("chestIds:", chestIds.map(String));

  for (const id of chestIds) {
    const chest = await nft.chests(id);
    const owner = await nft.ownerOf(id);
    console.log(`chest #${id}: chestType=${chest.chestType} owner=${owner}`);
  }

  for (const id of cardIds) {
    const card = await nft.cards(id);
    const owner = await nft.ownerOf(id);
    console.log(`card #${id}: playerId=${card.playerId} tier=${card.tier} owner=${owner}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
