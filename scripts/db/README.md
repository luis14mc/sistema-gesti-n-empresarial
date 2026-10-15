# Database scripts (N0)

Convenciones y reglas de PR: [docs/database/conventions.md](../docs/database/conventions.md).

| Script | Uso |
|--------|-----|
| `inventory-counts.sql` | Solo lectura: conteos por tabla. Producción: `railway run psql "$DATABASE_URL" -f scripts/db/inventory-counts.sql`. **No corre en CI.** |
| `check-drift.sh` | CI/local: (1) `main` monolítico vs `prisma/schema` sin cambio de datamodel; (2) hash de drift migraciones→schema vs baseline. Requiere `SHADOW_DATABASE_URL` (Postgres vacío). |
| `migration-drift-baseline.sha256` | Huella del drift migraciones→datamodel en esta rama; no debe cambiar hasta PR de alineación (N2). |
