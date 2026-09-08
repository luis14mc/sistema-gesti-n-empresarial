#!/bin/sh
set -eu

echo "[railway-predeploy] Starting PostgreSQL/Prisma pre-deploy checks"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[railway-predeploy] ERROR: DATABASE_URL is not defined"
  exit 1
fi

if [ -n "${DIRECT_URL:-}" ]; then
  echo "[railway-predeploy] DIRECT_URL detected; Prisma CLI will prefer it"
else
  echo "[railway-predeploy] DIRECT_URL not defined; Prisma CLI will use DATABASE_URL"
fi

if [ ! -f prisma/schema.prisma ]; then
  echo "[railway-predeploy] ERROR: prisma/schema.prisma is missing from runtime image"
  exit 1
fi

if [ ! -d prisma/migrations ]; then
  echo "[railway-predeploy] ERROR: prisma/migrations is missing from runtime image"
  exit 1
fi

MIGRATION_COUNT=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
echo "[railway-predeploy] Migration directories found: ${MIGRATION_COUNT}"

if [ "${MIGRATION_COUNT}" -eq 0 ]; then
  echo "[railway-predeploy] ERROR: no Prisma migrations found; refusing to start with an empty schema"
  exit 1
fi

echo "[railway-predeploy] Prisma version:"
pnpm exec prisma --version

echo "[railway-predeploy] Applying migrations to PostgreSQL"
pnpm exec prisma migrate deploy --schema=prisma/schema.prisma

echo "[railway-predeploy] Prisma migrations completed successfully"

# Master data seeding is intentionally opt-in. Enable it only for the controlled
# deployment that should load/update the versioned CNI provider/employee catalog,
# then set SEED_CNI_MASTER_DATA=false (or remove the variable) afterwards.
if [ "${SEED_CNI_MASTER_DATA:-false}" = "true" ]; then
  if [ ! -f prisma/seed-railway.ts ]; then
    echo "[railway-predeploy] ERROR: prisma/seed-railway.ts missing while SEED_CNI_MASTER_DATA=true"
    exit 1
  elif [ ! -f prisma/data/proveedores-cni.json ] || [ ! -f prisma/data/empleados-cni.json ]; then
    echo "[railway-predeploy] ERROR: CNI master data JSON missing while SEED_CNI_MASTER_DATA=true"
    exit 1
  else
    echo "[railway-predeploy] Running controlled CNI master data seed (proveedores + empleados)"
    ALLOW_PRODUCTION_SEED=true pnpm exec tsx prisma/seed-railway.ts
    echo "[railway-predeploy] CNI master data seed completed"
  fi
else
  echo "[railway-predeploy] CNI master data seed disabled (set SEED_CNI_MASTER_DATA=true only for a controlled seed deploy)"
fi
