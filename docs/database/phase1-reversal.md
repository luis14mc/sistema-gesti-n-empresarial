# Plan de reversión — migraciones fase 1

Ejecutar en **staging** antes que producción. Requiere ventana de mantenimiento si se revierte en prod.

## `20261015160000_archive_legacy_compra_ordenes`

```sql
ALTER TABLE archive.compras_orden_sequences SET SCHEMA public;
ALTER TABLE archive.compras_orden_historial SET SCHEMA public;
ALTER TABLE archive.compras_orden_documentos SET SCHEMA public;
ALTER TABLE archive.compras_orden_items SET SCHEMA public;
ALTER TABLE archive.compras_ordenes_legacy SET SCHEMA public;
-- Redeploy commit anterior (restaura modelos Prisma en 90-legacy.prisma).
```

## `20261015161000_equipment_cost_decimal`

```sql
-- Solo si no hay valores fuera de rango float
ALTER TABLE equipment ALTER COLUMN cost TYPE double precision USING cost::double precision;
ALTER TABLE equipment_maintenances ALTER COLUMN cost TYPE double precision USING cost::double precision;
-- Redeploy schema Prisma con Float en esas columnas.
```

## `20261015162000_phase1_indexes_and_fkeys`

```sql
ALTER TABLE software_subscriptions DROP CONSTRAINT IF EXISTS software_subscriptions_updatedById_fkey;
ALTER TABLE software_subscriptions DROP CONSTRAINT IF EXISTS software_subscriptions_createdById_fkey;
ALTER TABLE equipment_maintenances DROP CONSTRAINT IF EXISTS equipment_maintenances_performedById_fkey;
ALTER TABLE equipment_history DROP CONSTRAINT IF EXISTS equipment_history_performedById_fkey;
ALTER TABLE payroll_settings DROP CONSTRAINT IF EXISTS payroll_settings_updatedById_fkey;
ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_generatedById_fkey;
DROP INDEX IF EXISTS employees_organizationId_createdAt_idx;
DROP INDEX IF EXISTS oficios_organizationId_createdAt_idx;
DROP INDEX IF EXISTS purchase_orders_organizationId_createdAt_idx;
DROP INDEX IF EXISTS equipment_organizationId_createdAt_idx;
```
