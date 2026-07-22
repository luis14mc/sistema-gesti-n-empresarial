-- Órdenes de compra institucional v2 (sin eliminar tablas legacy)

CREATE TYPE "CompraOrdenEstado" AS ENUM ('BORRADOR', 'GENERADA', 'EMITIDA', 'ANULADA', 'CERRADA');
CREATE TYPE "CompraDocumentoTipo" AS ENUM ('ORDEN_PDF', 'COTIZACION', 'FACTURA', 'PROFORMA', 'SOPORTE', 'ACTA_RECEPCION', 'OTRO');
CREATE TYPE "CompraHistorialAccion" AS ENUM ('CREATED', 'UPDATED', 'GENERATED', 'PDF_GENERATED', 'PDF_REGENERATED', 'ISSUED', 'CANCELLED', 'CLOSED', 'DOCUMENT_ADDED', 'STATUS_CHANGED');

ALTER TYPE "CompraUnidad" ADD VALUE IF NOT EXISTS 'OTRO';

CREATE TABLE "compras_orden_sequences" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_orden_sequences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "compras_orden_sequences_year_key" ON "compras_orden_sequences"("year");

CREATE TABLE "compras_ordenes" (
  "id" TEXT NOT NULL,
  "numeroOrden" TEXT,
  "correlativo" INTEGER,
  "anioCorrelativo" INTEGER,
  "referenciaCompra" TEXT NOT NULL,
  "fechaSolicitud" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaRequerida" DATE NOT NULL,
  "solicitadoPorId" TEXT NOT NULL,
  "solicitadoPorNombre" TEXT NOT NULL,
  "solicitadoPorEmail" TEXT,
  "cargoSolicitante" TEXT NOT NULL,
  "proveedorId" TEXT,
  "proveedorNombre" TEXT NOT NULL,
  "proveedorRtn" TEXT NOT NULL,
  "proveedorTelefono" TEXT NOT NULL,
  "proveedorEmail" TEXT,
  "proveedorContacto" TEXT,
  "proveedorDireccion" TEXT,
  "justificacionCompra" TEXT NOT NULL,
  "observaciones" TEXT,
  "condicionesEntrega" TEXT,
  "formaPago" TEXT,
  "plazoPagoDias" INTEGER,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "tasaImpuesto" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "impuesto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "estado" "CompraOrdenEstado" NOT NULL DEFAULT 'BORRADOR',
  "pdfStorageKey" TEXT,
  "pdfUrl" TEXT,
  "pdfVersion" INTEGER NOT NULL DEFAULT 0,
  "generadoPorId" TEXT,
  "generadoEn" TIMESTAMP(3),
  "emitidoPorId" TEXT,
  "emitidoEn" TIMESTAMP(3),
  "anuladoPorId" TEXT,
  "anuladoEn" TIMESTAMP(3),
  "motivoAnulacion" TEXT,
  "cerradoPorId" TEXT,
  "cerradoEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "compras_ordenes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_ordenes_numeroOrden_key" ON "compras_ordenes"("numeroOrden");
CREATE UNIQUE INDEX "compras_ordenes_anioCorrelativo_correlativo_key" ON "compras_ordenes"("anioCorrelativo", "correlativo");
CREATE INDEX "compras_ordenes_estado_idx" ON "compras_ordenes"("estado");
CREATE INDEX "compras_ordenes_fechaSolicitud_idx" ON "compras_ordenes"("fechaSolicitud");
CREATE INDEX "compras_ordenes_fechaRequerida_idx" ON "compras_ordenes"("fechaRequerida");
CREATE INDEX "compras_ordenes_proveedorId_idx" ON "compras_ordenes"("proveedorId");
CREATE INDEX "compras_ordenes_solicitadoPorId_idx" ON "compras_ordenes"("solicitadoPorId");
CREATE INDEX "compras_ordenes_anioCorrelativo_idx" ON "compras_ordenes"("anioCorrelativo");

ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "compras_orden_items" (
  "id" TEXT NOT NULL,
  "ordenId" TEXT NOT NULL,
  "item" INTEGER NOT NULL,
  "descripcion" TEXT NOT NULL,
  "unidad" "CompraUnidad" NOT NULL,
  "cantidad" DECIMAL(14,2) NOT NULL,
  "precioUnitario" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_orden_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "compras_orden_items_ordenId_item_key" ON "compras_orden_items"("ordenId", "item");
CREATE INDEX "compras_orden_items_ordenId_idx" ON "compras_orden_items"("ordenId");
ALTER TABLE "compras_orden_items" ADD CONSTRAINT "compras_orden_items_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "compras_ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "compras_orden_documentos" (
  "id" TEXT NOT NULL,
  "ordenId" TEXT NOT NULL,
  "tipo" "CompraDocumentoTipo" NOT NULL,
  "nombre" TEXT NOT NULL,
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
  CONSTRAINT "compras_orden_documentos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compras_orden_documentos_ordenId_idx" ON "compras_orden_documentos"("ordenId");
CREATE INDEX "compras_orden_documentos_tipo_idx" ON "compras_orden_documentos"("tipo");
CREATE INDEX "compras_orden_documentos_fileHash_idx" ON "compras_orden_documentos"("fileHash");
ALTER TABLE "compras_orden_documentos" ADD CONSTRAINT "compras_orden_documentos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "compras_ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_orden_documentos" ADD CONSTRAINT "compras_orden_documentos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "compras_orden_historial" (
  "id" TEXT NOT NULL,
  "ordenId" TEXT NOT NULL,
  "action" "CompraHistorialAccion" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "previousData" JSONB,
  "newData" JSONB,
  "performedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compras_orden_historial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compras_orden_historial_ordenId_idx" ON "compras_orden_historial"("ordenId");
CREATE INDEX "compras_orden_historial_action_idx" ON "compras_orden_historial"("action");
CREATE INDEX "compras_orden_historial_createdAt_idx" ON "compras_orden_historial"("createdAt");
ALTER TABLE "compras_orden_historial" ADD CONSTRAINT "compras_orden_historial_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "compras_ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_orden_historial" ADD CONSTRAINT "compras_orden_historial_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
