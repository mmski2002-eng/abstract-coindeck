## Local database

This project now supports a local Postgres instance for development and a self-hosted Postgres instance on the same server as the app in production.

### Structure

- `schema.sql` - base schema for a fresh database
- `migrations/` - forward-only SQL migrations
- `scripts/` - one-off import helpers and operational notes
- `postgres-data/` - local Docker volume mount, ignored by git

### Local start

1. Create `frontend/.env.local` with `DATABASE_URL=postgres://moveinvestor:moveinvestor@127.0.0.1:5432/moveinvestor`
2. Run `docker compose up -d postgres`
3. Apply schema:

```powershell
psql postgresql://moveinvestor:moveinvestor@127.0.0.1:5432/moveinvestor -f database/schema.sql
```

### Production note

On the server, Postgres should listen on `127.0.0.1` only. Do not expose port `5432` publicly.

### Server bootstrap

You can bootstrap Postgres directly on the server with:

```bash
cd /var/www/moveinvestor-repo
chmod +x database/scripts/setup-postgres.sh
APP_DB_PASSWORD='<strong-password>' ./database/scripts/setup-postgres.sh
```

This installs Postgres, creates the app database and user, locks listening to `127.0.0.1`, and applies `database/schema.sql`.

### Server import

After deploying the code and creating the production database, import the live runtime files that already exist on the server:

```powershell
cd /var/www/moveinvestor-repo/frontend
$env:DATABASE_URL="postgres://moveinvestor_app:<password>@127.0.0.1:5432/moveinvestor"
node ../database/scripts/import-runtime-data.mjs --runtime-dir=/var/www/moveinvestor-repo/frontend
```

If the runtime data lives in the shared folder instead:

```powershell
node ../database/scripts/import-runtime-data.mjs --runtime-dir=/var/www/moveinvestor-shared
```

The script is idempotent for the main cache/state tables and is intended to be run on the hosting server, not on a local workstation.
