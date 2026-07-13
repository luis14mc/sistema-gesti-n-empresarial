#!/usr/bin/env bash
# =====================================================
# Smoke test contra producción AWS
# Verifica que endpoints críticos responden 2xx/3xx.
# Usar DESPUÉS del deploy.
# =====================================================

set -euo pipefail

BASE_URL="${1:?Uso: $0 <URL_BASE> [TOKEN]}"
TOKEN="${2:-}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

pass=0; fail=0

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" =~ ^($expected) ]]; then
    echo "  ✅ $desc  ($actual)"
    pass=$((pass + 1))
  else
    echo "  ❌ $desc  (esperado $expected, recibio $actual)"
    fail=$((fail + 1))
  fi
}

echo "==> Smoke test contra $BASE_URL"

# 1) Health check
status=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/health")
check "Health check" "200" "$status"

# 2) Login (solo si se pasa token no, probamos con admin@empresa.com / password123 dev)
if [[ -z "$TOKEN" ]]; then
  echo "  ℹ️  Sin TOKEN, intento login con credenciales seed..."
  login_resp=$(curl -sS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@empresa.com","password":"password123"}')
  TOKEN=$(echo "$login_resp" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [[ -z "$TOKEN" ]]; then
    echo "  ⚠️  No se pudo obtener token; saltando tests autenticados"
  else
    echo "  ✅ Login exitoso"
  fi
fi

if [[ -n "$TOKEN" ]]; then
  echo "  Tests autenticados:"

  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth/me")
  check "  GET /api/auth/me (perfil)" "200" "$status"

  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/oficios")
  check "  GET /api/oficios (lista)" "200" "$status"

  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/equipment")
  check "  GET /api/equipment" "200" "$status"

  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/users")
  check "  GET /api/users (ADMIN/RRHH)" "200" "$status"

  # Cabeceras de seguridad
  echo "  Cabeceras de seguridad:"
  for header in Content-Security-Policy X-Frame-Options Strict-Transport-Security; do
    val=$(curl -sSI "$BASE_URL/dashboard" -H "Authorization: Bearer $TOKEN" | grep -i "^$header:" | head -1)
    if [[ -n "$val" ]]; then
      echo "    ✅ $header presente"
    else
      echo "    ❌ $header AUSENTE"
      fail=$((fail + 1))
    fi
  done
fi

# 3) Rate limit en login
echo "  Rate limit en login (6 intentos):"
for i in 1 2 3 4 5 6; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"nope@invalid.test","password":"wrong"}')
  echo "    Intento $i: $status"
  if [[ "$status" == "429" ]]; then
    echo "    ✅ Rate limit funciona (bloqueado tras $i intentos)"
    pass=$((pass + 1))
    break
  fi
done

echo
echo "==> Resultado: $pass OK, $fail FAIL"

if [[ $fail -gt 0 ]]; then
  exit 1
fi
