import { randomBytes } from "crypto";
import { dbQuery, withDbTransaction } from "@/lib/db/client";

export async function createAdminNonce(action: string, domain: string, ttlMs: number, chainId: number) {
  const now = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = now + ttlMs;

  await dbQuery(
    `insert into admin_nonces (nonce, action, domain, issued_at, expires_at, used_at)
     values ($1, $2, $3, $4, $5, null)`,
    [nonce, action, domain, now, expiresAt],
  );
  return { nonce, issuedAt: now, expiresAt, chainId };
}

export async function consumeAdminNonce(nonce: string, action: string, domain: string): Promise<boolean> {
  const now = Date.now();

  return withDbTransaction(async (client) => {
    const found = await client.query<{ used_at: number | null; expires_at: number }>(
      `select used_at, expires_at from admin_nonces
       where nonce = $1 and action = $2 and domain = $3
       for update`,
      [nonce, action, domain],
    );
    const row = found.rows[0];
    if (!row || row.used_at !== null || Number(row.expires_at) < now) return false;
    await client.query("update admin_nonces set used_at = $2 where nonce = $1", [nonce, now]);
    return true;
  });
}

export async function cleanupExpiredNonces(): Promise<void> {
  const now = Date.now();
  await dbQuery(
    `delete from admin_nonces where expires_at < $1 or (used_at is not null and issued_at < $2)`,
    [now, now - 24 * 60 * 60 * 1000],
  );
}

export async function appendAuditEntry(scope: string, payload: Record<string, unknown>): Promise<void> {
  await dbQuery(
    "insert into audit_log (scope, payload) values ($1, $2::jsonb)",
    [scope, JSON.stringify(payload)],
  );
}

export async function readAuditEntries(limit: number): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ scope: string; payload: Record<string, unknown>; created_at: string }>(
    `select scope, payload, created_at
     from audit_log
     order by id desc
     limit $1`,
    [limit],
  );
  return result.rows.map((row) => ({ scope: row.scope, ...row.payload, at: row.created_at }));
}
