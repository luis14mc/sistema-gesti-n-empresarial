# Tablas archivadas (schema `archive`)

Migración: `20261015160000_archive_legacy_compra_ordenes` (2026-10-15).

Datos conservados; Prisma ya no modela estas tablas. Tipos enum PostgreSQL asociados permanecen en `public` (sin DROP).

| Tabla (antes en `public`) | Motivo |
|---------------------------|--------|
| `compras_ordenes_legacy` | Cero referencias en código/SQL crudo |
| `compras_orden_items` | Ítems del legado v2 renombrado |
| `compras_orden_documentos` | Documentos del legado |
| `compras_orden_historial` | Historial del legado |
| `compras_orden_sequences` | Secuencia del legado (canónico: `purchase_order_sequences`) |

## Reversión (manual, ventana de mantenimiento)

Ejecutar en Postgres (staging primero):

```sql
ALTER TABLE archive.compras_orden_sequences SET SCHEMA public;
ALTER TABLE archive.compras_orden_historial SET SCHEMA public;
ALTER TABLE archive.compras_orden_documentos SET SCHEMA public;
ALTER TABLE archive.compras_orden_items SET SCHEMA public;
ALTER TABLE archive.compras_ordenes_legacy SET SCHEMA public;
-- Restaurar modelos en prisma/schema/90-legacy.prisma desde git previo al merge de fase 1.
```

## Pendiente N2b

No archivado en fase 1: `tickets`, `time_entries`, `promotional_*`, `compras_solicitudes*`, `domain_event_outbox`, `purchase_order_sequences`. Revisar `scripts/db/inventory-counts.sql` en producción antes de mover.
