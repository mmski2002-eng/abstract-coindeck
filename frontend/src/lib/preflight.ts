import { getRuntimeProjectAddresses } from "@/config/projectAddresses";

const ZERO_ADDR = "0x" + "0".repeat(64);
const ADDR_RE = /^0x[0-9a-fA-F]{1,64}$/;

function warn(msg: string) {
  console.warn(`[preflight] WARN: ${msg}`);
}

function fatal(msg: string) {
  console.error(`[preflight] FATAL: ${msg}`);
}

function checkAddr(label: string, addr: string): boolean {
  if (!ADDR_RE.test(addr)) {
    fatal(`${label} is not a valid address: "${addr}"`);
    return false;
  }
  if (addr === ZERO_ADDR) {
    fatal(`${label} is the zero address — set it for this network`);
    return false;
  }
  return true;
}

export async function runPreflight(): Promise<void> {
  const addrs = getRuntimeProjectAddresses();

  console.info(`[preflight] network: ${addrs.networkLabel} (${addrs.activeNetwork})`);
  console.info(`[preflight] restUrl: ${addrs.restUrl}`);
  console.info(`[preflight] moduleAddress: ${addrs.moduleAddress}`);

  // Critical address checks.
  let ok = true;
  ok = checkAddr("moduleAddress", addrs.moduleAddress) && ok;
  ok = checkAddr("adminAddress", addrs.adminAddress) && ok;
  ok = checkAddr("prizeVaultAddress", addrs.prizeVaultAddress) && ok;
  ok = checkAddr("claimVaultAddress", addrs.claimVaultAddress) && ok;

  // Required secrets.
  if (!process.env.DATABASE_URL) {
    fatal("DATABASE_URL is not set");
    ok = false;
  }
  if (!process.env.ADMIN_SECRET) {
    fatal("ADMIN_SECRET is not set");
    ok = false;
  } else if (process.env.ADMIN_SECRET === "your_secret_here") {
    fatal("ADMIN_SECRET is still the example placeholder — replace it");
    ok = false;
  }

  // Mainnet-specific checks.
  if (addrs.activeNetwork === "movementMainnet") {
    if (!process.env.INDEXER_URL) {
      warn("INDEXER_URL is not set — leaderboard will fall back to bulk view calls (slow at scale)");
    }
    if (addrs.moduleAddress === ZERO_ADDR) {
      fatal("Mainnet moduleAddress is zero — deploy contract first and set CONTRACT_ADDRESS env");
      ok = false;
    }
    if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length < 32) {
      warn("ADMIN_SECRET is shorter than 32 chars — use a high-entropy secret for mainnet");
    }
  }

  // Verify REST endpoint reachable (non-blocking — logs only).
  fetch(`${addrs.restUrl}`)
    .then((r) => r.json())
    .then((json: unknown) => {
      const chainId = (json as { chain_id?: unknown })?.chain_id;
      console.info(`[preflight] chain_id: ${String(chainId)}`);
    })
    .catch((e: unknown) => {
      warn(`REST endpoint unreachable (${addrs.restUrl}): ${String(e)}`);
    });

  if (!ok) {
    console.error("[preflight] One or more critical checks failed — review errors above.");
  } else {
    console.info("[preflight] All critical checks passed.");
  }
}
