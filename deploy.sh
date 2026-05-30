#!/bin/bash
set -e

SERVER="root@216.173.70.241"
REMOTE_DIR="/var/www/abstract-coindeck"
FRONTEND_DIR="$(dirname "$0")/frontend"

echo "[1/4] Building..."
cd "$FRONTEND_DIR"
npm run build

echo "[2/4] Copying static assets into standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "[3/4] Uploading..."
rsync -az --delete .next/standalone/ "$SERVER:$REMOTE_DIR/"

echo "[4/4] Restarting PM2..."
ssh "$SERVER" "pm2 restart abstract-coindeck && pm2 save"

echo "Done → https://escape.isgood.host"
