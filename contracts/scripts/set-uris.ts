import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet, Contract } from "zksync-ethers";
import * as hre from "hardhat";

const ADMIN_CONTROL = "0x53D1f9C06A16E41d7A4e5876Ee9ee89Adb43ED7E";
const COIN_DECK_NFT = "0x5cFc10441a17F866f6DDF371D5B5905ddE5eca4A";

const EGGMONET_URI = "https://escape.isgood.host/api/nft/card-meta/";
const EGG_URI      = "https://escape.isgood.host/api/nft/chest-meta/";

const ACTION_SET_BASE_URIS = 0;

async function main() {
  const wallet   = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const acArtifact  = await deployer.loadArtifact("AdminControl");
  const nftArtifact = await deployer.loadArtifact("CoinDeckNFT");

  const adminControl = new Contract(ADMIN_CONTROL, acArtifact.abi,  deployer.zkWallet);
  const nft          = new Contract(COIN_DECK_NFT,  nftArtifact.abi, deployer.zkWallet);

  console.log("1. Set ACTION_SET_BASE_URIS delay → 0");
  const tx1 = await adminControl.setActionDelay(ACTION_SET_BASE_URIS, 0);
  await tx1.wait();
  console.log("   ✓", tx1.hash);

  console.log("2. setBaseUris");
  const tx2 = await nft.setBaseUris(EGGMONET_URI, EGG_URI);
  await tx2.wait();
  console.log("   ✓", tx2.hash);

  console.log("3. Restore delay → 10 min");
  const tx3 = await adminControl.setActionDelay(ACTION_SET_BASE_URIS, 10 * 60);
  await tx3.wait();
  console.log("   ✓", tx3.hash);

  console.log("\nURIs set:");
  console.log("  eggMonetBaseUri:", EGGMONET_URI);
  console.log("  eggBaseUri:     ", EGG_URI);
}

main().catch((e) => { console.error(e); process.exit(1); });
