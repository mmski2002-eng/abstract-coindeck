import { ethers } from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import * as hre from "hardhat";

async function main() {
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const owner = wallet.address;
  console.log("Deploying from:", owner);

  // ── 1. AdminControl ───────────────────────────────────────────────────────
  console.log("\n[1/6] AdminControl...");
  const AdminControl = await deployer.loadArtifact("AdminControl");
  const adminControl = await deployer.deploy(AdminControl, [owner]);
  await adminControl.waitForDeployment();
  const adminControlAddr = await adminControl.getAddress();
  console.log("AdminControl:", adminControlAddr);

  // ── 2. CoinDeckNFT ────────────────────────────────────────────────────────
  console.log("\n[2/6] CoinDeckNFT...");
  const CoinDeckNFT = await deployer.loadArtifact("CoinDeckNFT");
  const nft = await deployer.deploy(CoinDeckNFT, [adminControlAddr]);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("CoinDeckNFT:", nftAddr);

  // ── 3. Tournament ─────────────────────────────────────────────────────────
  console.log("\n[3/6] Tournament...");
  const Tournament = await deployer.loadArtifact("Tournament");
  const tournament = await deployer.deploy(Tournament, [adminControlAddr, nftAddr]);
  await tournament.waitForDeployment();
  const tournamentAddr = await tournament.getAddress();
  console.log("Tournament:", tournamentAddr);

  // Wire: NFT needs to know Tournament for lock/unlock
  console.log("  → setTournamentContract on NFT...");
  const tx1 = await nft.setTournamentContract(tournamentAddr);
  await tx1.wait();

  // ── 4. Oracle ─────────────────────────────────────────────────────────────
  console.log("\n[4/6] Oracle...");
  const Oracle = await deployer.loadArtifact("Oracle");
  const oracle = await deployer.deploy(Oracle, [adminControlAddr]);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("Oracle:", oracleAddr);

  // ── 5. Claim ──────────────────────────────────────────────────────────────
  console.log("\n[5/6] Claim...");
  const Claim = await deployer.loadArtifact("Claim");
  const claim = await deployer.deploy(Claim, [adminControlAddr]);
  await claim.waitForDeployment();
  const claimAddr = await claim.getAddress();
  console.log("Claim:", claimAddr);

  // ── 6. Marketplace ────────────────────────────────────────────────────────
  console.log("\n[6/6] Marketplace...");
  const Marketplace = await deployer.loadArtifact("Marketplace");
  const marketplace = await deployer.deploy(Marketplace, [adminControlAddr, nftAddr]);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("Marketplace:", marketplaceAddr);

  // ── Wire: NFT needs to approve marketplace for transfers ──────────────────
  // Marketplace calls nft.transferFrom(seller, this, cardId) — needs approval per listing
  // No global approval needed — sellers call approve(marketplace, tokenId) before listing

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══ DEPLOYED ADDRESSES ═══");
  console.log(`ADMIN_CONTROL="${adminControlAddr}"`);
  console.log(`COIN_DECK_NFT="${nftAddr}"`);
  console.log(`TOURNAMENT="${tournamentAddr}"`);
  console.log(`ORACLE="${oracleAddr}"`);
  console.log(`CLAIM="${claimAddr}"`);
  console.log(`MARKETPLACE="${marketplaceAddr}"`);
  console.log("\nUpdate frontend/src/components/wallet/constants.ts with these addresses.");

  // ── Verify (optional, set VERIFY=true) ───────────────────────────────────
  if (process.env.VERIFY === "true") {
    console.log("\nVerifying...");
    for (const [name, addr, args] of [
      ["AdminControl", adminControlAddr, [owner]],
      ["CoinDeckNFT",  nftAddr,          [adminControlAddr]],
      ["Tournament",   tournamentAddr,   [adminControlAddr, nftAddr]],
      ["Oracle",       oracleAddr,       [adminControlAddr]],
      ["Claim",        claimAddr,        [adminControlAddr]],
      ["Marketplace",  marketplaceAddr,  [adminControlAddr, nftAddr]],
    ] as [string, string, unknown[]][]) {
      try {
        await hre.run("verify:verify", { address: addr, constructorArguments: args });
        console.log(`  ✓ ${name}`);
      } catch (e: any) {
        console.log(`  ✗ ${name}: ${e.message}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
