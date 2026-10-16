# Drift migraciones ↔ schema (baseline fase 1)

Gate CI: `scripts/db/check-drift.sh` (`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --script --exit-code`) con `SHADOW_DATABASE_URL`.

## Resuelto en esta rama

| Tema | Causa | Acción |
|------|--------|--------|
| Tablas legacy compra en `archive` | Modelos quitados del client en fase 1 | `prisma/schema/91-archive.prisma` + `schemas = ["public", "archive"]`, modelos `@@ignore` |
| Enums `CompraOrdenEstado`, `CompraDocumentoTipo`, `CompraHistorialAccion` | Tipos siguen en PG (tablas archivadas) | Enums restaurados en `91-archive.prisma` |
| Índices `(organizationId, createdAt)` | Migración `20261015162000` vs schema | `@@index` en Equipment, CompraOrden, Oficio, Employee |
| Índices truncados (63 chars) | Nombres auto de Prisma vs PG | `map:` en domain_event_outbox, integration_executions, equipment_disposal_history |
| `employees_email_idx`, `employees_organizationId_hireDate_idx` | En migraciones, faltaban en schema | `@@index` + `map` en Employee |
| Default `organizations.status` | Phase 7a enum sin default en columna | Migración `20261015163000_align_schema_defaults` |
| `purchase_order_item_taxes.updatedAt` default | SQL `DEFAULT` vs `@updatedAt` Prisma | Misma migración (`DROP DEFAULT`) |
| `compras_solicitud_items` precio/total | Defaults en BD, no en schema | `@default(0)` en CompraSolicitudItem |
| `organizationId` FK `ON UPDATE` | Migraciones sin cláusula (= NO ACTION) vs default Prisma CASCADE | `onUpdate: NoAction` en relaciones `organizationId` |
| Archive idempotente | Re-aplicar shadow fallaba si tabla ya en archive | Guard `archive.*` en `20261015160000` |

## Si reaparece drift

Documentar aquí antes de congelar hashes. Preferir migraciones **aditivas e idempotentes** solo para índices/defaults seguros.

**No** incluir en alineación automática: drops de columnas, `DROP TYPE`, cambios RBAC, `OrganizationRole` / enum `Role`.
