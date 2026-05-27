<!-- Parent: ../../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# db

## Purpose
Database client and connection pooling. Provides postgres pool, query helpers, and transaction utilities for backend API routes.

## Key Files
| File | Description |
|------|-------------|
| `client.ts` | Global postgres pool; dbQuery() helper for parameterized queries; withDbTransaction() for ACID transactions |

## For AI Agents

### Working In This Directory
- **Pool initialization**: Lazy-initialized on first dbQuery() call; stored in global.__moveInvestorPgPool to avoid recreating
- **Query function**: dbQuery<T>(text, values) returns Promise<QueryResult<T>>; fully parameterized (no SQL injection)
- **Transactions**: withDbTransaction(async (client) => {...}) auto-commits on success, rolls back on error
- **Error handling**: Throw errors from queries; caller responsible for try/catch
- **Configuration**: DATABASE_URL from .env.local; requires postgres 11+; max 10 connections

### Common Patterns
- **Parameterized queries**: Use $1, $2, etc. placeholders; never interpolate values
- **Row results**: await dbQuery(...).then(r => r.rows[0]) for single row; r.rows for multiple
- **Row count**: Check result.rowCount to verify INSERT/UPDATE/DELETE affected rows
- **Transaction safety**: Use withDbTransaction for multi-statement operations that must all succeed or all fail

## Dependencies

### Internal
- None

### External
- `pg@8.16.3` – Pool, PoolClient, QueryResult, QueryResultRow types

<!-- MANUAL: Ensure DATABASE_URL is set in .env.local for local development. Connection pooling uses max 10 concurrent connections; monitor pool saturation if API gets high traffic. Statement timeout is 30 seconds; adjust if queries are slower. -->
