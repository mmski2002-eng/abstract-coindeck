#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-}"
RUNTIME_DIR="${RUNTIME_DIR:-/var/www/moveinvestor-repo/frontend}"
SHARED_ENV_FILE="${SHARED_ENV_FILE:-/var/www/moveinvestor-shared/.env.local}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-/var/www/moveinvestor-repo/frontend/.env.local}"

if [[ -z "${DB_URL}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

for file in "${FRONTEND_ENV_FILE}" "${SHARED_ENV_FILE}"; do
  mkdir -p "$(dirname "${file}")"
  touch "${file}"
  if grep -q '^DATABASE_URL=' "${file}"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" "${file}"
  else
    printf '\nDATABASE_URL=%s\n' "${DB_URL}" >> "${file}"
  fi
done

cd /var/www/moveinvestor-repo/frontend
DATABASE_URL="${DB_URL}" node ../database/scripts/import-runtime-data.mjs --runtime-dir="${RUNTIME_DIR}"
