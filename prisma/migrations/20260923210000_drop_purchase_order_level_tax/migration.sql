-- Convert every remaining purchase order onto item taxes, then drop order-level taxRate/tax.
-- Orders already backfilled by 20260923180000 are validated and left in place.
-- A mismatch or an unsupported rate aborts the migration.

DO $migration$
DECLARE
  ord record;
  line_sum numeric(14,2);
  item_count integer;
  missing_profiles integer;
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

    SELECT COALESCE(SUM(total), 0), COUNT(*), COUNT(*) FILTER (WHERE "taxProfile" IS NULL)
      INTO line_sum, item_count, missing_profiles
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

    expected_total := ord.subtotal - ord.discount + ord.tax;

    IF missing_profiles = 0 THEN
      SELECT COALESCE(SUM("taxAmount"), 0), COALESCE(SUM("itemTotal"), 0)
        INTO migrated_tax, migrated_total
      FROM "purchase_order_items"
      WHERE "orderId" = ord.id;
      IF migrated_tax <> ord.tax OR expected_total <> ord.total OR migrated_total <> ord.total THEN
        RAISE EXCEPTION 'Cannot migrate purchase order %: stored item taxes % / order tax %, item totals % / order total %',
          ord.id, migrated_tax, ord.tax, migrated_total, ord.total;
      END IF;
      CONTINUE;
    END IF;

    IF missing_profiles <> item_count THEN
      RAISE EXCEPTION 'Cannot migrate purchase order %: partial item tax backfill', ord.id;
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
