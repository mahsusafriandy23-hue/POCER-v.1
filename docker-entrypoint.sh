#!/bin/sh
set -e

echo "[entrypoint] syncing database schema (prisma db push)..."
npx prisma db push --skip-generate

if [ "$SEED_ON_START" = "true" ]; then
  echo "[entrypoint] seeding catalog..."
  node_modules/.bin/ts-node --transpile-only prisma/seed.ts || echo "[entrypoint] seed skipped/failed (continuing)"
fi

echo "[entrypoint] starting API..."
exec node dist/main.js
