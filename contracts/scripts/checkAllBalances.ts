import { Provider } from "zksync-ethers";
import * as hre from "hardhat";

const ALL_CONTRACTS = [
  "0x57069325D791e0B3707F54173a28CA05786Ab5d9",
  "0x1b5f18bc201C91A39dC53090A9a152155ebAdCB0",
  "0x0A8904D0699CA161450F6fade08Ba328f87f6Cae",
  "0xE372957a7Ed727D84c69a3fE21991246C01471eB",
  "0x389A8e16B96e007bd0276584B840F25A9c40a9b2",
  "0x174a6F8Fa6692065bBc434Fb6f8529692F9746Eb",
  "0x23c1aC601511E448e3BFb8Fc060cb974ca4692F3",
  "0x22195583Eb1D5ac7c7B4e06DBD9FB0B05DBe1b9F",
  "0xb69753cbBa15f2cc536469dcC6dE6fDb5a051BdC",
  "0x0bc42AeF25691A49C5Fea5FFAb38218dEA369c6c",
  "0x1833133eA0657D545b9251F5f7c5335F76F2e98a",
  "0xE2612Dd2FF6bd9800843DA2Cf88100f3e250456c",
  "0x8C19998Cb94d3295ba53BB41dC72cB70Abb68106",
  "0xcfF1401d87e95CD56F4cc90B3d05E059D1834852",
  "0x8A304B3519717634a5FB7F883Dbc43E3948ec536",
  "0x5A14F5aa9a0F18272f09B07a133422f1A9feAC84",
  "0x850Bf7E0D893995eC1ba883C8451E60A1dA71191",
  "0xc972A93a3E9fe13555feC78BdD2162847Ed889B7",
];

async function main() {
  const provider = new Provider((hre.network.config as any).url);
  for (const addr of ALL_CONTRACTS) {
    const bal = await provider.getBalance(addr);
    if (bal > 0n) console.log(`HAS ETH  ${addr}: ${(Number(bal) / 1e18).toFixed(6)} ETH`);
    else         console.log(`empty    ${addr}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
