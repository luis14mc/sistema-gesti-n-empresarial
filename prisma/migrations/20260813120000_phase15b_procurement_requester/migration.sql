ALTER TABLE "purchase_orders" ADD COLUMN "requesterEmployeeId" TEXT;

CREATE INDEX "purchase_orders_requesterEmployeeId_idx" ON "purchase_orders"("requesterEmployeeId");

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_requesterEmployeeId_fkey"
  FOREIGN KEY ("requesterEmployeeId") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
