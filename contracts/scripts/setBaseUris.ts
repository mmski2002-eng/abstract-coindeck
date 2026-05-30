import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Provider, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const NFT_ADDR       = "0x557eFCE8F63a57cFAF97e25e8c07698fA71D4FA3";
const CARD_BASE_URI  = "https://escape.isgood.host/api/nft/card-meta/";
const CHEST_BASE_URI = "https://escape.isgood.host/api/nft/chest-meta/";

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const deployer = new Deployer(hre, wallet);
  console.log("Caller:", wallet.address);

  const artifact = await deployer.loadArtifact("CoinDeckNFT");
  const nft = new Contract(NFT_ADDR, artifact.abi, wallet);

  console.log("Current cardBaseUri: ", await nft.cardBaseUri());
  console.log("Current chestBaseUri:", await nft.chestBaseUri());

  console.log("\nCalling setBaseUris...");
  const tx = await nft.setBaseUris(CARD_BASE_URI, CHEST_BASE_URI);
  await tx.wait();
  console.log("Done. tx:", tx.hash);

  console.log("\nNew cardBaseUri: ", await nft.cardBaseUri());
  console.log("New chestBaseUri:", await nft.chestBaseUri());
}

main().catch((e) => { console.error(e); process.exit(1); });
