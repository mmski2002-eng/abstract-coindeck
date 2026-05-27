import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __moveInvestorPgPool: Pool | undefined;
}

function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "";
}

export function isDatabaseEnabled(): boolean {
  return databaseUrl().length > 0;
}

export function getPool(): Pool {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!global.__moveInvestorPgPool) {
    global.__moveInvestorPgPool = new Pool({
      connectionString: databaseUrl(),
      max: 10,
      statement_timeout: 30_000,
    });
  }

  return global.__moveInvestorPgPool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function withDbTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
