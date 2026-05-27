const path = require("path");
const addressBook = require(path.join(__dirname, "../frontend/src/config/project-addresses.json"));
const activeNetwork = addressBook.networks[addressBook.activeNetwork];
const MODULE = process.env.MODULE_ADDR || process.env.CONTRACT_ADDRESS || activeNetwork.contracts.moduleAddress;
const WALLETS = activeNetwork.wallets.debugWallets;
const REST = process.env.REST_URL || activeNetwork.urls.restUrl;

async function view(fn, args = []) {
  const r = await fetch(`${REST}/view`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ function: `${MODULE}::${fn}`, type_arguments: [], arguments: args }),
  });
  if (!r.ok) { console.error("  view ERR", fn, r.status, await r.text()); return null; }
  return r.json();
}

const LEAGUE = ["Bronze", "Silver", "Gold"];

async function main() {
  const state = await view("tournament::get_state");
  console.log("=== Epoch state ===", JSON.stringify(state));

  const epochRange = await view("tournament::get_epoch_range");
  const currentEpoch = epochRange ? Number(epochRange[1]) : null;
  console.log("epoch range:", epochRange, "=> current epoch:", currentEpoch);

  for (const addr of WALLETS) {
    console.log(`\n=== ${addr.slice(0,10)}... ===`);

    const lineups = await view("tournament::get_player_lineups", [addr]);
    if (!lineups) { console.log("  no lineups data"); continue; }
    console.log("  raw lineups:", JSON.stringify(lineups));
    const days = lineups[0] ?? [];
    // leagues is hex-encoded vector<u8>, e.g. "0x0201" => [2,1]
    const leagueHex = lineups[1] ?? "0x";
    const leagueBytes = leagueHex.replace("0x","").match(/.{2}/g)?.map(h => parseInt(h,16)) ?? [];
    console.log(`  days: ${JSON.stringify(days)}`);
    console.log(`  leagues raw: ${leagueHex} => ${JSON.stringify(leagueBytes)} (${leagueBytes.map(l => LEAGUE[l] ?? l).join(", ")})`);

    // Check slots for each day
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const slots = await view("tournament::get_lineup_slots", [addr, String(day)]);
      if (!slots) { console.log(`  day ${day}: no slots`); continue; }
      console.log(`  day ${day} raw slots:`, JSON.stringify(slots));
      // slots[0] = player_ids (hex vector<u8>), slots[1] = tiers (hex vector<u8>)
      const tiersHex = slots[1] ?? "0x";
      const tierBytes = tiersHex.replace("0x","").match(/.{2}/g)?.map(h => parseInt(h,16)) ?? [];
      const tierNames = tierBytes.map(t => t==0?"Common":t==1?"Rare":t==2?"Epic":"Legendary");
      const rareCount = tierBytes.filter(t => t==1).length;
      const epicCount = tierBytes.filter(t => t==2).length;
      const legCount  = tierBytes.filter(t => t==3).length;
      const expectedLeague = (epicCount>0||legCount>0||rareCount>2) ? 2 : rareCount>0 ? 1 : 0;
      console.log(`  day ${day}: tiers=${JSON.stringify(tierBytes)} (${tierNames.join(",")})`);
      console.log(`    rare=${rareCount} epic=${epicCount} legendary=${legCount}`);
      console.log(`    stored league=${LEAGUE[leagueBytes[i]]??leagueBytes[i]}, expected=${LEAGUE[expectedLeague]}`);
    }
  }
}

main().catch(console.error);
