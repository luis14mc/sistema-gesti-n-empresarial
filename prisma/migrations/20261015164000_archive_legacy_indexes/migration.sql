-- Limpieza archive legacy: índices huérfanos y nombres alineados al schema (idempotente).

DO $$
DECLARE
  rel oid := to_regclass('archive.compras_ordenes_legacy');
BEGIN
  IF rel IS NULL THEN RETURN; END IF;

  DROP INDEX IF EXISTS archive."compras_ordenes_anioCorrelativo_idx";
  DROP INDEX IF EXISTS archive."compras_ordenes_fechaRequerida_idx";
  DROP INDEX IF EXISTS archive."compras_ordenes_fechaSolicitud_idx";
  DROP INDEX IF EXISTS archive."compras_ordenes_proveedorId_idx";
  DROP INDEX IF EXISTS archive."compras_ordenes_solicitadoPorId_idx";

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = rel AND conname = 'compras_ordenes_pkey') THEN
    ALTER TABLE archive.compras_ordenes_legacy
      RENAME CONSTRAINT compras_ordenes_pkey TO compras_ordenes_legacy_pkey;
  END IF;

  IF to_regclass('archive."compras_ordenes_numeroOrden_key"') IS NOT NULL THEN
    ALTER INDEX archive."compras_ordenes_numeroOrden_key"
      RENAME TO compras_ordenes_legacy_numeroOrden_key;
  END IF;

  IF to_regclass('archive."compras_ordenes_anioCorrelativo_correlativo_key"') IS NOT NULL THEN
    ALTER INDEX archive."compras_ordenes_anioCorrelativo_correlativo_key"
      RENAME TO compras_ordenes_legacy_anioCorrelativo_correlativo_key;
  END IF;

  IF to_regclass('archive."compras_ordenes_estado_idx"') IS NOT NULL THEN
    ALTER INDEX archive."compras_ordenes_estado_idx"
      RENAME TO compras_ordenes_legacy_estado_idx;
  END IF;
END $$;
