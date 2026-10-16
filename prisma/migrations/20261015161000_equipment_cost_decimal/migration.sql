-- N3: money columns on active equipment tables (safe cast, preserves NULL).
DO $$ BEGIN
  IF to_regclass('public.equipment') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'equipment' AND column_name = 'cost'
         AND udt_name = 'float8'
     ) THEN
    ALTER TABLE public.equipment
      ALTER COLUMN cost TYPE DECIMAL(14, 2)
      USING CASE WHEN cost IS NULL THEN NULL ELSE round(cost::numeric, 2) END;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.equipment_maintenances') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'equipment_maintenances' AND column_name = 'cost'
         AND udt_name = 'float8'
     ) THEN
    ALTER TABLE public.equipment_maintenances
      ALTER COLUMN cost TYPE DECIMAL(14, 2)
      USING CASE WHEN cost IS NULL THEN NULL ELSE round(cost::numeric, 2) END;
  END IF;
END $$;
