#!/usr/bin/env bash
# scripts/performance/check-browser-leaks.sh
# Phase 11D — Chromium leak detection.
#
# Counts the number of chrome / chromium processes before and after a
# burst of PDF jobs. Emits a non-zero exit code when the count grows
# beyond the documented threshold.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

BASELINE_FILE="${BASELINE_FILE:-/tmp/sge-chromium-baseline.txt}"
CURRENT_FILE="${CURRENT_FILE:-/tmp/sge-chromium-current.txt}"

if [ -z "${THRESHOLD:-}" ]; then
  THRESHOLD=0
fi

count_browsers() {
  pgrep -af 'chrome|chromium' 2>/dev/null | wc -l | tr -d ' '
}

echo "[browser-leak] baseline:"
echo "$(count_browsers)" > "$BASELINE_FILE"
cat "$BASELINE_FILE"

echo "[browser-leak] running PDF burst via k6"
BASE_URL="${BASE_URL:-http://localhost:3000}" \
  TOKEN="${TOKEN:-}" \
  k6 run --vus 2 --duration 30s tests/performance/scenarios/pdf-generation.js

echo "[browser-leak] current:"
echo "$(count_browsers)" > "$CURRENT_FILE"
cat "$CURRENT_FILE"

baseline=$(cat "$BASELINE_FILE")
current=$(cat "$CURRENT_FILE")
delta=$((current - baseline))

echo "[browser-leak] delta: $delta (threshold: ${THRESHOLD})"

if [ "$delta" -gt "$THRESHOLD" ]; then
  echo "[browser-leak] FAIL: ${delta} extra Chromium processes after the burst." >&2
  exit 2
fi

echo "[browser-leak] OK"
