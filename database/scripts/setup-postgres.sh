#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${APP_DB_NAME:-moveinvestor}"
DB_USER="${APP_DB_USER:-moveinvestor_app}"
DB_PASSWORD="${APP_DB_PASSWORD:-}"
SCHEMA_PATH="${SCHEMA_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/schema.sql}"

if [[ -z "${DB_PASSWORD}" ]]; then
  echo "APP_DB_PASSWORD is required"
  exit 1
fi

if [[ ! -f "${SCHEMA_PATH}" ]]; then
  echo "Schema file not found: ${SCHEMA_PATH}"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y postgresql postgresql-contrib

PG_VERSION="$(psql --version | awk '{print $3}' | cut -d. -f1)"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"

if [[ -f "${PG_CONF}" ]]; then
  sed -i "s/^#\?listen_addresses.*/listen_addresses = '127.0.0.1'/" "${PG_CONF}"
fi

systemctl start postgresql

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';"
else
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

if [[ -f "${PG_HBA}" ]]; then
  if ! grep -q "^host[[:space:]]\+${DB_NAME}[[:space:]]\+${DB_USER}[[:space:]]\+127.0.0.1/32[[:space:]]\+scram-sha-256" "${PG_HBA}"; then
    printf "\nhost %s %s 127.0.0.1/32 scram-sha-256\n" "${DB_NAME}" "${DB_USER}" >> "${PG_HBA}"
  fi
fi

systemctl restart postgresql

PGPASSWORD="${DB_PASSWORD}" psql "postgresql://${DB_USER}@127.0.0.1:5432/${DB_NAME}" -f "${SCHEMA_PATH}"

echo "Postgres is ready."
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
