-- N2 partial: move zero-reference legacy compra orden tables to archive schema (reversible, no DROP).
CREATE SCHEMA IF NOT EXISTS archive;

DO $$ BEGIN
  IF to_regclass('public.compras_ordenes_legacy') IS NOT NULL
     AND to_regclass('archive.compras_ordenes_legacy') IS NULL THEN
    ALTER TABLE public.compras_ordenes_legacy SET SCHEMA archive;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.compras_orden_items') IS NOT NULL
     AND to_regclass('archive.compras_orden_items') IS NULL THEN
    ALTER TABLE public.compras_orden_items SET SCHEMA archive;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.compras_orden_documentos') IS NOT NULL
     AND to_regclass('archive.compras_orden_documentos') IS NULL THEN
    ALTER TABLE public.compras_orden_documentos SET SCHEMA archive;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.compras_orden_historial') IS NOT NULL
     AND to_regclass('archive.compras_orden_historial') IS NULL THEN
    ALTER TABLE public.compras_orden_historial SET SCHEMA archive;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.compras_orden_sequences') IS NOT NULL
     AND to_regclass('archive.compras_orden_sequences') IS NULL THEN
    ALTER TABLE public.compras_orden_sequences SET SCHEMA archive;
  END IF;
END $$;
