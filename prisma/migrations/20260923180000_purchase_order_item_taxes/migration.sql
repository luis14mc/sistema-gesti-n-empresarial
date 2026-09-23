-- Canonical item taxes. Historical order-level taxRate/tax are converted, validated, then removed.

CREATE TYPE "PurchaseTaxProfile" AS ENUM (
  'GENERAL_15',
  'EXEMPT',
  'ISV_18',
  'HOTEL_15_TOURISM_4',
  'CUSTOM'
);

ALTER TABLE "purchase_order_items"
ADD COLUMN "taxProfile" "PurchaseTaxProfile",
ADD COLUMN "taxableBase" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "itemTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "purchase_order_item_taxes" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rate" DECIMAL(7,4) NOT NULL,
  "taxableBase" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_item_taxes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_order_item_taxes_orderItemId_code_key"
ON "purchase_order_item_taxes"("orderItemId", "code");

CREATE INDEX "purchase_order_item_taxes_orderItemId_idx"
ON "purchase_order_item_taxes"("orderItemId");

ALTER TABLE "purchase_order_item_taxes"
ADD CONSTRAINT "purchase_order_item_taxes_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "purchase_order_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DO $migration$
DECLARE
  ord record;
  line_sum numeric(14,2);
  item_count integer;
  allocated_sum numeric(14,2);
  remainder numeric(14,2);
  target_id text;
  tax_target text;
  profile "PurchaseTaxProfile";
  raw_sum numeric(14,2);
  drift numeric(14,2);
  tolerance numeric(14,2);
  migrated_tax numeric(14,2);
  migrated_total numeric(14,2);
  expected_total numeric(14,2);
BEGIN
  CREATE TEMP TABLE po_tax_migration (
    item_id text PRIMARY KEY,
    item_number integer NOT NULL,
    line_subtotal numeric(14,2) NOT NULL,
    allocated numeric(14,2) NOT NULL,
    taxable_base numeric(14,2) NOT NULL,
    tax_amount numeric(14,2) NOT NULL
  ) ON COMMIT DROP;

  FOR ord IN
    SELECT id, subtotal, discount, tax, total, "taxRate"
    FROM "purchase_orders"
  LOOP
    IF ord."taxRate" NOT IN (0, 15, 18) THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: unsupported tax rate %', ord.id, ord."taxRate";
    END IF;
    IF ord.discount < 0 OR ord.discount > ord.subtotal THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: invalid discount', ord.id;
    END IF;

    SELECT COALESCE(SUM(total), 0), COUNT(*)
      INTO line_sum, item_count
    FROM "purchase_order_items"
    WHERE "orderId" = ord.id;

    IF item_count = 0 THEN
      IF ord.subtotal <> 0 OR ord.discount <> 0 OR ord.tax <> 0 OR ord.total <> 0 THEN
        RAISE EXCEPTION 'Cannot migrate purchase order %: totals without items', ord.id;
      END IF;
      CONTINUE;
    END IF;

    IF line_sum <> ord.subtotal THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: item lines % do not match subtotal %', ord.id, line_sum, ord.subtotal;
    END IF;

    DELETE FROM po_tax_migration;
    INSERT INTO po_tax_migration (item_id, item_number, line_subtotal, allocated, taxable_base, tax_amount)
    SELECT id, "itemNumber", total, 0, 0, 0
    FROM "purchase_order_items"
    WHERE "orderId" = ord.id;

    IF ord.subtotal > 0 AND ord.discount > 0 THEN
      UPDATE po_tax_migration
      SET allocated = ROUND(ord.discount * line_subtotal / ord.subtotal, 2);
      SELECT COALESCE(SUM(allocated), 0) INTO allocated_sum FROM po_tax_migration;
      remainder := ord.discount - allocated_sum;
      SELECT item_id INTO target_id
      FROM po_tax_migration
      ORDER BY line_subtotal DESC, item_number ASC
      LIMIT 1;
      UPDATE po_tax_migration
      SET allocated = allocated + remainder
      WHERE item_id = target_id;
    END IF;

    profile := CASE ord."taxRate"
      WHEN 0 THEN 'EXEMPT'::"PurchaseTaxProfile"
      WHEN 18 THEN 'ISV_18'::"PurchaseTaxProfile"
      ELSE 'GENERAL_15'::"PurchaseTaxProfile"
    END;

    UPDATE po_tax_migration
    SET
      taxable_base = line_subtotal - allocated,
      tax_amount = ROUND((line_subtotal - allocated) * ord."taxRate" / 100, 2);

    SELECT COALESCE(SUM(tax_amount), 0) INTO raw_sum FROM po_tax_migration;
    drift := ord.tax - raw_sum;
    tolerance := GREATEST(0.02, 0.01 * item_count);
    IF abs(drift) > tolerance THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: tax drift % exceeds %', ord.id, drift, tolerance;
    END IF;
    IF profile = 'EXEMPT' AND drift <> 0 THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: exempt order tax % cannot be placed on an item', ord.id, ord.tax;
    END IF;

    SELECT item_id INTO tax_target
    FROM po_tax_migration
    ORDER BY taxable_base DESC, item_number ASC
    LIMIT 1;

    UPDATE po_tax_migration
    SET tax_amount = tax_amount + drift
    WHERE item_id = tax_target;

    IF EXISTS (
      SELECT 1 FROM po_tax_migration
      WHERE tax_amount < 0 OR taxable_base < 0
    ) THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: negative taxable base or tax', ord.id;
    END IF;

    SELECT COALESCE(SUM(tax_amount), 0), COALESCE(SUM(taxable_base + tax_amount), 0)
      INTO migrated_tax, migrated_total
    FROM po_tax_migration;

    expected_total := ord.subtotal - ord.discount + ord.tax;
    IF migrated_tax <> ord.tax OR expected_total <> ord.total OR migrated_total <> ord.total THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: migrated tax % / stored tax %, migrated total % / stored total %',
        ord.id, migrated_tax, ord.tax, migrated_total, ord.total;
    END IF;

    UPDATE "purchase_order_items" poi
    SET
      "taxProfile" = profile,
      "taxableBase" = m.taxable_base,
      "taxAmount" = m.tax_amount,
      "itemTotal" = m.taxable_base + m.tax_amount
    FROM po_tax_migration m
    WHERE poi.id = m.item_id;

    INSERT INTO "purchase_order_item_taxes" (
      "id", "orderItemId", "code", "name", "rate", "taxableBase", "amount", "sortOrder", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid()::text,
      m.item_id,
      CASE profile WHEN 'ISV_18' THEN 'ISV_18' ELSE 'ISV_15' END,
      CASE profile WHEN 'ISV_18' THEN 'ISV 18%' ELSE 'ISV 15%' END,
      ord."taxRate",
      m.taxable_base,
      m.tax_amount,
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM po_tax_migration m
    WHERE profile <> 'EXEMPT';
  END LOOP;

  IF EXISTS (SELECT 1 FROM "purchase_order_items" WHERE "taxProfile" IS NULL) THEN
    RAISE EXCEPTION 'Purchase order tax migration left items without a tax profile';
  END IF;
END
$migration$;

ALTER TABLE "purchase_order_items"
ALTER COLUMN "taxProfile" SET NOT NULL;

ALTER TABLE "purchase_orders"
DROP COLUMN "taxRate",
DROP COLUMN "tax";
