#!/bin/sh
set -eu

echo "[railway-start] Validating PostgreSQL/Prisma startup requirements"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[railway-start] ERROR: DATABASE_URL is not defined"
  exit 1
fi

if [ -n "${DIRECT_URL:-}" ]; then
  echo "[railway-start] DIRECT_URL detected; Prisma CLI will prefer it"
else
  echo "[railway-start] DIRECT_URL not defined; Prisma CLI will use DATABASE_URL"
fi

if [ ! -f prisma/schema.prisma ]; then
  echo "[railway-start] ERROR: prisma/schema.prisma is missing from runtime image"
  exit 1
fi

if [ ! -d prisma/migrations ]; then
  echo "[railway-start] ERROR: prisma/migrations is missing from runtime image"
  exit 1
fi

MIGRATION_COUNT=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
echo "[railway-start] Migration directories found: ${MIGRATION_COUNT}"

if [ "${MIGRATION_COUNT}" -eq 0 ]; then
  echo "[railway-start] ERROR: no Prisma migrations found; refusing to start with an empty schema"
  exit 1
fi

echo "[railway-start] Applying Prisma migrations to PostgreSQL"
pnpm exec prisma migrate deploy --schema=prisma/schema.prisma

echo "[railway-start] Prisma migrations completed successfully"

if [ "${BOOTSTRAP_ADMIN_ENABLED:-false}" = "true" ]; then
  echo "[railway-start] Running one-time admin bootstrap"
  node railway-bootstrap-admin.mjs
else
  echo "[railway-start] Admin bootstrap disabled"
fi

echo "[railway-start] Starting Next.js"

exec node server.js
