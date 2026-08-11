#!/usr/bin/env bash
# scripts/release-quality-gates.sh
# Phase 10G — staging release-quality gates.
#
# Hard rules:
#   - Refuses to run if STAGING_BASE_URL looks like production.
#   - Only runs a read-only smoke + k6 load smoke against staging.
#   - Returns non-zero on any failure.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

: "${STAGING_BASE_URL:?STAGING_BASE_URL must be set to the staging URL}"
: "${STAGING_ADMIN_TOKEN:?STAGING_ADMIN_TOKEN must be set for the staging smoke}"

case "$STAGING_BASE_URL" in
  *prod*|*production*) echo "REFUSED: STAGING_BASE_URL looks like production." >&2; exit 64 ;;
esac

echo "[release-gates] running staging smoke"
pnpm exec tsx scripts/smoke-test.ts --base-url "$STAGING_BASE_URL" --read-only

echo "[release-gates] running k6 load smoke (3 minutes, 10 VUs)"
BASE_URL="$STAGING_BASE_URL" TOKEN="$STAGING_ADMIN_TOKEN" \
  k6 run --vus 10 --duration 3m tests/performance/k6/list-reads.js
