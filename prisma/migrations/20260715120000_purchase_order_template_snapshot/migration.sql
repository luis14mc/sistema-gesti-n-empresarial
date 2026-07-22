-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "templateSnapshot" JSONB;
