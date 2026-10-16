# Convenciones de schema (obligatorias para modelos nuevos)

Documento de la fase **N0** de normalización de BD. Aplica a todo modelo nuevo o ampliación futura; el schema existente se alinea de forma incremental en PRs posteriores (expandir → migrar datos → contraer).

## Regla de base de datos (obligatoria)

Todo **modelo nuevo** o **migración nueva** debe cumplir este documento.

**Prohibido:**

- `Float` (u otros tipos de punto flotante) para **dinero** — usar `Decimal @db.Decimal(14, 2)`.
- Modelos o campos de dominio en **español** — inglés en código (`PascalCase` / `camelCase`); nombres de negocio visibles al usuario van en UI/i18n, no en el schema.
- **Borrar o renombrar** tablas/columnas en el **mismo PR** en el que la aplicación deja de usarlas — separar en fases (expandir → migrar datos → contraer en PR distinto).

**Cada PR que incluya migración** (`prisma/migrations/*`) debe traer en la descripción:

1. Salida de `prisma migrate diff` relevante (p. ej. `--from-migrations prisma/migrations --to-schema prisma/schema --script` con shadow DB, o diff contra el estado previo acordado en el PR).
2. **Plan de reversión**: SQL o pasos para deshacer la migración en staging/producción si falla el deploy (incl. orden inverso, datos afectados, backups).

**Despliegue Railway:** probar la migración en PR Environment / staging antes del merge; respaldo manual Postgres en Railway antes de aprobar. Detalle en [docs/deployment/railway.md](../deployment/railway.md#regla-de-despliegue-obligatoria).

PRs **sin** migración nueva no deben alterar el SQL desplegado; verificar con `scripts/db/check-drift.sh` cuando aplique.

## Nomenclatura

- **Modelos** en inglés, `PascalCase`.
- **Campos** en inglés, `camelCase`.
- **Tablas físicas** en `snake_case` plural, con `@@map("nombre_tabla")`.
- **Enums** en inglés (`PascalCase` para el tipo); valores en `SCREAMING_SNAKE_CASE`.

## Multi-tenant y auditoría

Todo modelo de **negocio** (datos por organización) debe incluir:

- `id String @id @default(cuid())`
- `organizationId String` con índice (`@@index([organizationId])` o compuesto según consultas)
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

Cuando aplique trazabilidad humana:

- `createdById String?` / `updatedById String?` con relación explícita a `User` y `onDelete` definido (p. ej. `SetNull`).

## Tipos de datos

| Concepto | Tipo Prisma | Notas |
|----------|-------------|--------|
| Dinero | `Decimal @db.Decimal(14, 2)` | **Nunca** `Float` para montos. |
| Tasas / porcentajes | `Decimal @db.Decimal(5, 2)` | Almacenar como porcentaje (ej. `16.00` = 16%). |
| Fecha sin hora | `DateTime @db.Date` | Solo calendario; no mezclar con timestamps de evento. |
| Coordenadas | `Decimal` o tipos geoespaciales dedicados | Evitar `Float` en campos críticos si se exige precisión. |

## Borrado lógico

- Usar **`deletedAt DateTime?`** como único mecanismo de soft delete.
- No mezclar `isDeleted`, `active`, `status = deleted`, etc., en el mismo agregado.

## Integridad referencial

- Toda relación `@relation` debe declarar **`onDelete`** explícito (`Restrict`, `Cascade`, `SetNull`, …) acorde al dominio.
- Evitar FKs huérfanas sin índice en la columna hijo cuando haya listados por padre.

## Patrón de cambio en producción

1. **Expandir**: columnas/tablas nuevas, nullable o con default; sin romper lectores actuales.
2. **Migrar datos**: backfill en script o job; validar conteos e invariantes.
3. **Contraer**: eliminar columnas/tablas viejas en un PR **separado**, tras verificar que no queden lectores.

Cada fase en su propio PR con `prisma migrate diff` vacío respecto a lo ya desplegado, salvo en el PR que introduce la migración correspondiente.

## Organización del schema (N1)

El datamodel vive en `prisma/schema/` por dominio:

- `00-base.prisma` — generator y datasource (prefijo numérico fija el orden de merge)
- `10-platform.prisma`, `20-people.prisma`, `30-oficios.prisma`, `40-assets.prisma`, `50-procurement.prisma`, `60-payroll.prisma`, `70-audits.prisma`
- `90-legacy.prisma` — modelos marcados LEGACY; no usar en features nuevas

## Verificación local

```bash
pnpm prisma validate
pnpm prisma generate
SHADOW_DATABASE_URL="postgresql://..." scripts/db/check-drift.sh
```

- PR **sin** migraciones: `scripts/db/check-drift.sh` confirma equivalencia del datamodel vs `main` y que el drift migraciones→schema no empeora (baseline en `scripts/db/migration-drift-baseline.sha256`).
- PR **con** migraciones: incluir en la descripción el diff SQL generado y el plan de reversión; tras merge, actualizar el baseline solo si el equipo acordó alinear drift en ese PR.
