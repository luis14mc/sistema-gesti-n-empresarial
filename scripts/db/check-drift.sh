#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${SHADOW_DATABASE_URL:-}" ]]; then
  echo "[check-drift] ERROR: SHADOW_DATABASE_URL is required (empty Postgres database)."
  exit 1
fi

echo "[check-drift] migrations → prisma/schema (shadow: SHADOW_DATABASE_URL via prisma.config.ts)"

# Prisma 7 applies shadowDatabaseUrl from prisma.config.ts when SHADOW_DATABASE_URL is set.
# Equivalent intent to: --shadow-database-url "\$SHADOW_DATABASE_URL"
pnpm exec prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema \
  --script \
  --exit-code

echo "[check-drift] OK: empty diff"
