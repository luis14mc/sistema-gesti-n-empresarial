-- Alineación aditiva: defaults declarados en schema Prisma (idempotente).

DO $$ BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    ALTER TABLE public.organizations
      ALTER COLUMN status SET DEFAULT 'PROVISIONING';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.purchase_order_item_taxes') IS NOT NULL THEN
    ALTER TABLE public.purchase_order_item_taxes
      ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
