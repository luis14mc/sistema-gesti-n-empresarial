# Guía para agentes (SGE)

## Regla de base de datos

Todo **modelo nuevo** o **migración nueva** debe cumplir [docs/database/conventions.md](docs/database/conventions.md).

**Prohibido:**

- `Float` para **dinero** (usar `Decimal(14,2)`).
- Modelos o campos de dominio nuevos en **español** (inglés en schema; UI/i18n para etiquetas).
- **Borrar o renombrar** tablas/columnas en el mismo PR en el que el código deja de usarlas — patrón **expandir → migrar datos → contraer** en PRs separados.

**PR con migración:** incluir SQL generado (`prisma migrate diff` o `migration.sql`) y **plan de reversión** en la descripción.

Schema Prisma: carpeta [prisma/schema/](prisma/schema/) (multi-archivo). Inventario: [docs/database/inventory.md](docs/database/inventory.md).

No modificar pruebas RBAC protegidas ni unificar/redefinir el enum `OrganizationRole` / modelo `Role` sin tarea explícita.

## Regla de despliegue (Railway)

Cada **merge a `main`** despliega a **producción** y ejecuta `prisma migrate deploy` ([railway-predeploy.sh](railway-predeploy.sh)).

- Migraciones **aditivas**, **idempotentes** (`IF NOT EXISTS` / `IF EXISTS`) y **sin pérdida de datos**; sin `DROP TABLE` / `DROP COLUMN` salvo fase contraer ya desplegada.
- **PR con migración:** probar en **PR Environment / staging** de Railway; SQL + plan de reversión en el PR; **backup manual** Postgres (Railway → Backups) antes de aprobar.
- Detalle: [docs/deployment/railway.md](docs/deployment/railway.md).

Verificación local habitual: `pnpm prisma validate`, `pnpm prisma generate`, `scripts/db/check-drift.sh` (con `SHADOW_DATABASE_URL` cuando aplique).
