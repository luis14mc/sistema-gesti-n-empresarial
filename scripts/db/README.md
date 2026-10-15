# Database scripts (N0)

Convenciones y reglas de PR: [docs/database/conventions.md](../docs/database/conventions.md).

| Script | Uso |
|--------|-----|
| `inventory-counts.sql` | Solo lectura: conteos por tabla (`public` + `archive`). Regenerar: `node scripts/db/generate-inventory-counts.mjs`. CI/local: `psql "$DATABASE_URL" -f scripts/db/inventory-counts.sql` |
| `generate-inventory-counts.mjs` | Genera `inventory-counts.sql` desde `prisma/schema` + tablas archivadas |
| `check-drift.sh` | CI/local: `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --script --exit-code`. Requiere `SHADOW_DATABASE_URL` (Postgres vacío; ver `prisma.config.ts`) |

Drift conocido documentado: [docs/database/drift-baseline.md](../docs/database/drift-baseline.md).
