-- Item-level tax treatments. Order taxRate/tax stay for historical orders.

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

-- Backfill only simple historical orders: one rate (0, 15, or 18) and no order discount.
-- Discounted or unusual rates stay on order.taxRate because the per-item base was never stored.
WITH simple AS (
  SELECT
    poi."id",
    poi."orderId",
    poi."itemNumber",
    poi."total" AS line_subtotal,
    po."taxRate" AS order_rate,
    po."tax" AS order_tax
  FROM "purchase_order_items" poi
  JOIN "purchase_orders" po ON po."id" = poi."orderId"
  WHERE po."discount" = 0
    AND po."taxRate" IN (0, 15, 18)
),
rated AS (
  SELECT
    simple.*,
    CASE
      WHEN simple.order_rate = 0 THEN 'EXEMPT'::"PurchaseTaxProfile"
      WHEN simple.order_rate = 18 THEN 'ISV_18'::"PurchaseTaxProfile"
      ELSE 'GENERAL_15'::"PurchaseTaxProfile"
    END AS profile,
    ROUND(simple.line_subtotal * simple.order_rate / 100, 2) AS raw_tax
  FROM simple
),
adjusted AS (
  SELECT
    rated.*,
    SUM(rated.raw_tax) OVER (PARTITION BY rated."orderId") AS tax_sum,
    ROW_NUMBER() OVER (PARTITION BY rated."orderId" ORDER BY rated.line_subtotal DESC, rated."itemNumber") AS rank_in_order
  FROM rated
),
final_lines AS (
  SELECT
    adjusted.*,
    CASE
      WHEN adjusted.rank_in_order = 1
        AND ABS(adjusted.order_tax - adjusted.tax_sum) <= 0.05
      THEN adjusted.raw_tax + (adjusted.order_tax - adjusted.tax_sum)
      ELSE adjusted.raw_tax
    END AS tax_amount
  FROM adjusted
  WHERE ABS(adjusted.order_tax - adjusted.tax_sum) <= 0.05
     OR adjusted.order_rate = 0
)
UPDATE "purchase_order_items" poi
SET
  "taxProfile" = final_lines.profile,
  "taxableBase" = final_lines.line_subtotal,
  "taxAmount" = final_lines.tax_amount,
  "itemTotal" = final_lines.line_subtotal + final_lines.tax_amount
FROM final_lines
WHERE poi."id" = final_lines."id";

INSERT INTO "purchase_order_item_taxes" (
  "id",
  "orderItemId",
  "code",
  "name",
  "rate",
  "taxableBase",
  "amount",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  poi."id",
  CASE poi."taxProfile"
    WHEN 'ISV_18' THEN 'ISV_18'
    ELSE 'ISV_15'
  END,
  CASE poi."taxProfile"
    WHEN 'ISV_18' THEN 'ISV 18%'
    ELSE 'ISV 15%'
  END,
  CASE poi."taxProfile"
    WHEN 'ISV_18' THEN 18
    ELSE 15
  END,
  poi."taxableBase",
  poi."taxAmount",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "purchase_order_items" poi
WHERE poi."taxProfile" IN ('GENERAL_15', 'ISV_18');
