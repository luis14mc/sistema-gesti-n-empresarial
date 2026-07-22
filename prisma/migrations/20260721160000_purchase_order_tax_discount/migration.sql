CREATE TYPE "TipoDescuento" AS ENUM ('NINGUNO', 'MONTO', 'PORCENTAJE');

ALTER TABLE "purchase_orders"
ADD COLUMN "discountType" "TipoDescuento" NOT NULL DEFAULT 'NINGUNO',
ADD COLUMN "discountValue" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "purchase_orders"
SET "discountType" = 'MONTO', "discountValue" = "discount"
WHERE "discount" > 0;
