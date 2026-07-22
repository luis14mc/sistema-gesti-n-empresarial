-- CreateEnum
CREATE TYPE "OficioRecordSource" AS ENUM ('SYSTEM_CREATED', 'HISTORICAL_IMPORT', 'MANUAL_REGISTRATION');

-- CreateEnum
CREATE TYPE "OficioTrackingAction" AS ENUM ('CREATED', 'IMPORTED', 'RECEIVED', 'SENT', 'ASSIGNED', 'IN_REVIEW', 'FORWARDED', 'RESPONDED', 'COMPLETED', 'ARCHIVED', 'DOCUMENT_ADDED', 'STATUS_CHANGED', 'COMMENT_ADDED');

-- CreateEnum
CREATE TYPE "OficioImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OficioImportBatchItemStatus" AS ENUM ('PENDING', 'IMPORTED', 'SKIPPED', 'ERROR');

-- DropIndex
DROP INDEX "oficios_number_key";

-- AlterTable
ALTER TABLE "oficios" ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedById" TEXT,
ADD COLUMN     "recordSource" "OficioRecordSource" NOT NULL DEFAULT 'SYSTEM_CREATED',
ADD COLUMN     "systemNumber" TEXT,
ALTER COLUMN "attachments" DROP NOT NULL;

-- CreateTable
CREATE TABLE "oficio_documents" (
    "id" TEXT NOT NULL,
    "oficioId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileHash" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'OFICIO_PRINCIPAL',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oficio_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oficio_tracking" (
    "id" TEXT NOT NULL,
    "oficioId" TEXT NOT NULL,
    "action" "OficioTrackingAction" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oficio_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oficio_import_batches" (
    "id" TEXT NOT NULL,
    "source" "OficioRecordSource" NOT NULL DEFAULT 'HISTORICAL_IMPORT',
    "status" "OficioImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "oficioId" TEXT,

    CONSTRAINT "oficio_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oficio_import_batch_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "status" "OficioImportBatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "originalName" TEXT,
    "number" TEXT,
    "institution" TEXT,
    "oficioDate" DATE,
    "fileHash" TEXT,
    "errorMessage" TEXT,
    "oficioId" TEXT,

    CONSTRAINT "oficio_import_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oficio_documents_oficioId_idx" ON "oficio_documents"("oficioId");

-- CreateIndex
CREATE INDEX "oficio_documents_fileHash_idx" ON "oficio_documents"("fileHash");

-- CreateIndex
CREATE INDEX "oficio_documents_documentType_idx" ON "oficio_documents"("documentType");

-- CreateIndex
CREATE INDEX "oficio_tracking_oficioId_idx" ON "oficio_tracking"("oficioId");

-- CreateIndex
CREATE INDEX "oficio_tracking_action_idx" ON "oficio_tracking"("action");

-- CreateIndex
CREATE INDEX "oficio_tracking_createdAt_idx" ON "oficio_tracking"("createdAt");

-- CreateIndex
CREATE INDEX "oficio_import_batches_performedById_idx" ON "oficio_import_batches"("performedById");

-- CreateIndex
CREATE INDEX "oficio_import_batches_status_idx" ON "oficio_import_batches"("status");

-- CreateIndex
CREATE INDEX "oficio_import_batch_items_batchId_idx" ON "oficio_import_batch_items"("batchId");

-- CreateIndex
CREATE INDEX "oficio_import_batch_items_status_idx" ON "oficio_import_batch_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "oficios_systemNumber_key" ON "oficios"("systemNumber");

-- CreateIndex
CREATE INDEX "oficios_number_idx" ON "oficios"("number");

-- CreateIndex
CREATE INDEX "oficios_institution_number_idx" ON "oficios"("institution", "number");

-- CreateIndex
CREATE INDEX "oficios_recordSource_idx" ON "oficios"("recordSource");

-- CreateIndex
CREATE INDEX "oficios_oficioDate_idx" ON "oficios"("oficioDate");

-- AddForeignKey
ALTER TABLE "oficios" ADD CONSTRAINT "oficios_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_documents" ADD CONSTRAINT "oficio_documents_oficioId_fkey" FOREIGN KEY ("oficioId") REFERENCES "oficios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_documents" ADD CONSTRAINT "oficio_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_tracking" ADD CONSTRAINT "oficio_tracking_oficioId_fkey" FOREIGN KEY ("oficioId") REFERENCES "oficios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_tracking" ADD CONSTRAINT "oficio_tracking_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_import_batches" ADD CONSTRAINT "oficio_import_batches_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_import_batches" ADD CONSTRAINT "oficio_import_batches_oficioId_fkey" FOREIGN KEY ("oficioId") REFERENCES "oficios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_import_batch_items" ADD CONSTRAINT "oficio_import_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "oficio_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficio_import_batch_items" ADD CONSTRAINT "oficio_import_batch_items_oficioId_fkey" FOREIGN KEY ("oficioId") REFERENCES "oficios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

