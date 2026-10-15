#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BASELINE="${ROOT}/scripts/db/migration-drift-baseline.sha256"
MAIN_SCHEMA="$(mktemp)"
trap 'rm -f "$MAIN_SCHEMA"' EXIT

echo "[check-drift] (1/2) Datamodel unchanged vs main (monolith → multi-file)"
git show main:prisma/schema.prisma > "$MAIN_SCHEMA"
pnpm exec prisma migrate diff \
  --from-schema "$MAIN_SCHEMA" \
  --to-schema prisma/schema \
  --script \
  --exit-code
echo "[check-drift] OK: main and prisma/schema are equivalent"

if [[ -z "${SHADOW_DATABASE_URL:-}" ]]; then
  echo "[check-drift] SKIP (2/2): SHADOW_DATABASE_URL not set (migrations vs datamodel baseline check)"
  exit 0
fi

echo "[check-drift] (2/2) Migrations folder vs datamodel (baseline guard until N2 alignment)"
DIFF_FILE="$(mktemp)"
trap 'rm -f "$MAIN_SCHEMA" "$DIFF_FILE"' EXIT

pnpm exec prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema \
  --script > "$DIFF_FILE"

HASH="$(sha256sum "$DIFF_FILE" | awk '{print $1}')"

if [[ ! -f "$BASELINE" ]]; then
  echo "[check-drift] ERROR: missing baseline $BASELINE"
  exit 1
fi

EXPECTED="$(tr -d '[:space:]' < "$BASELINE")"
if [[ "$HASH" != "$EXPECTED" ]]; then
  echo "[check-drift] FAIL: migration/schema drift hash changed (expected N2 alignment before changing)."
  echo "[check-drift] expected=$EXPECTED actual=$HASH"
  echo "[check-drift] diff preview (first 40 lines):"
  head -40 "$DIFF_FILE"
  exit 1
fi

echo "[check-drift] OK: migration/schema drift matches recorded baseline ($HASH)"
