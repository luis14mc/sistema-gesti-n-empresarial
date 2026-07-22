-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'GENERATED', 'ISSUED', 'CANCELLED', 'CLOSED');
CREATE TYPE "PurchaseUnit" AS ENUM ('UNIT', 'BOX', 'PACKAGE', 'SERVICE', 'LOT', 'MONTH', 'HOUR', 'DAY', 'OTHER');
CREATE TYPE "PurchaseDocumentType" AS ENUM ('ORDER_PDF', 'QUOTATION', 'INVOICE', 'PROFORMA', 'SUPPORT', 'RECEIPT', 'OTHER');
CREATE TYPE "PurchaseHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'GENERATED', 'PDF_GENERATED', 'PDF_REGENERATED', 'ISSUED', 'CANCELLED', 'CLOSED', 'DOCUMENT_ADDED', 'DOCUMENT_REMOVED', 'STATUS_CHANGED', 'TEMPLATE_CHANGED');

-- Rename legacy table if exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compras_ordenes') THEN
    ALTER TABLE "compras_ordenes" RENAME TO "compras_ordenes_legacy";
  END IF;
END $$;

-- CreateTable purchase_order_templates
CREATE TABLE "purchase_order_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "institutionName" TEXT NOT NULL DEFAULT 'Consejo Nacional de Inversiones',
    "institutionAddress" TEXT,
    "institutionPhone" TEXT,
    "institutionWebsite" TEXT,
    "institutionRtn" TEXT,
    "documentTitle" TEXT NOT NULL DEFAULT 'ORDEN DE COMPRA',
    "orderPrefix" TEXT NOT NULL DEFAULT 'COM-CNI',
    "footerText" TEXT,
    "signatureTitle" TEXT NOT NULL DEFAULT 'ÁREA ADMINISTRATIVA',
    "additionalNote" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#334E88',
    "secondaryColor" TEXT NOT NULL DEFAULT '#32B372',
    "showInstitutionAddress" BOOLEAN NOT NULL DEFAULT true,
    "showInstitutionPhone" BOOLEAN NOT NULL DEFAULT true,
    "showInstitutionWebsite" BOOLEAN NOT NULL DEFAULT true,
    "showInstitutionRtn" BOOLEAN NOT NULL DEFAULT false,
    "showReference" BOOLEAN NOT NULL DEFAULT true,
    "showRequiredDate" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_order_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_sequences" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_order_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT,
    "sequenceNumber" INTEGER,
    "sequenceYear" INTEGER,
    "purchaseReference" TEXT NOT NULL,
    "requestDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" DATE NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requesterJobTitle" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierRtn" TEXT NOT NULL,
    "supplierPhone" TEXT NOT NULL,
    "purchaseJustification" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "unit" "PurchaseUnit" NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_documents" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "PurchaseDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_order_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" "PurchaseHistoryAction" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_order_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_orders_orderNumber_key" ON "purchase_orders"("orderNumber");
CREATE UNIQUE INDEX "purchase_orders_sequenceYear_sequenceNumber_key" ON "purchase_orders"("sequenceYear", "sequenceNumber");
CREATE INDEX "purchase_orders_orderNumber_idx" ON "purchase_orders"("orderNumber");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_orders_requestDate_idx" ON "purchase_orders"("requestDate");
CREATE INDEX "purchase_orders_requiredDate_idx" ON "purchase_orders"("requiredDate");
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE INDEX "purchase_orders_createdById_idx" ON "purchase_orders"("createdById");
CREATE INDEX "purchase_orders_sequenceYear_idx" ON "purchase_orders"("sequenceYear");

CREATE UNIQUE INDEX "purchase_order_items_orderId_itemNumber_key" ON "purchase_order_items"("orderId", "itemNumber");
CREATE INDEX "purchase_order_items_orderId_idx" ON "purchase_order_items"("orderId");

CREATE INDEX "purchase_order_documents_orderId_idx" ON "purchase_order_documents"("orderId");
CREATE INDEX "purchase_order_documents_type_idx" ON "purchase_order_documents"("type");
CREATE INDEX "purchase_order_documents_fileHash_idx" ON "purchase_order_documents"("fileHash");

CREATE INDEX "purchase_order_history_orderId_idx" ON "purchase_order_history"("orderId");
CREATE INDEX "purchase_order_history_action_idx" ON "purchase_order_history"("action");
CREATE INDEX "purchase_order_history_createdAt_idx" ON "purchase_order_history"("createdAt");

CREATE UNIQUE INDEX "purchase_order_sequences_year_key" ON "purchase_order_sequences"("year");
CREATE INDEX "purchase_order_templates_isActive_idx" ON "purchase_order_templates"("isActive");

ALTER TABLE "purchase_order_templates" ADD CONSTRAINT "purchase_order_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "purchase_order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_documents" ADD CONSTRAINT "purchase_order_documents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_documents" ADD CONSTRAINT "purchase_order_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_history" ADD CONSTRAINT "purchase_order_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_history" ADD CONSTRAINT "purchase_order_history_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
