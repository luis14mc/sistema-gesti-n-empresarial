-- Orden de Compra institucional simple (OC-CNI)

DROP TABLE IF EXISTS "compras_documentos" CASCADE;
DROP TABLE IF EXISTS "compras_adjuntos" CASCADE;
DROP TABLE IF EXISTS "compras_solicitud_items" CASCADE;
DROP TABLE IF EXISTS "compras_solicitudes" CASCADE;
DROP TABLE IF EXISTS "compras_sequences" CASCADE;

DROP TYPE IF EXISTS "CompraEstado";

CREATE TYPE "CompraEstado" AS ENUM (
  'BORRADOR',
  'GENERADA',
  'EMITIDA',
  'ANULADA',
  'CERRADA'
);

CREATE TABLE "compras_sequences" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "prefix" TEXT NOT NULL DEFAULT 'OC-CNI',
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "compras_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_sequences_year_prefix_key" ON "compras_sequences"("year", "prefix");

CREATE TABLE "compras_solicitudes" (
  "id" TEXT NOT NULL,
  "numeroOrden" TEXT,
  "referenciaCompra" TEXT,
  "fechaSolicitud" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaRequerida" DATE,
  "solicitadoPorId" TEXT NOT NULL,
  "cargoSolicitante" TEXT,
  "estado" "CompraEstado" NOT NULL DEFAULT 'BORRADOR',
  "proveedorId" TEXT,
  "proveedorNombre" TEXT,
  "proveedorIdentificacion" TEXT,
  "proveedorTelefono" TEXT,
  "proveedorEmail" TEXT,
  "proveedorContacto" TEXT,
  "proveedorDireccion" TEXT,
  "justificacionCompra" TEXT NOT NULL DEFAULT '',
  "observacionesAdicionales" TEXT,
  "condicionesEntrega" TEXT,
  "formaPago" "CompraFormaPago",
  "plazoPagoDias" INTEGER,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "impuesto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "compras_solicitudes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_solicitudes_numeroOrden_key" ON "compras_solicitudes"("numeroOrden");
CREATE INDEX "compras_solicitudes_estado_idx" ON "compras_solicitudes"("estado");
CREATE INDEX "compras_solicitudes_solicitadoPorId_idx" ON "compras_solicitudes"("solicitadoPorId");
CREATE INDEX "compras_solicitudes_fechaSolicitud_idx" ON "compras_solicitudes"("fechaSolicitud");
CREATE INDEX "compras_solicitudes_numeroOrden_idx" ON "compras_solicitudes"("numeroOrden");
CREATE INDEX "compras_solicitudes_proveedorId_idx" ON "compras_solicitudes"("proveedorId");

ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_solicitadoPorId_fkey"
  FOREIGN KEY ("solicitadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "compras_solicitud_items" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "item" INTEGER NOT NULL,
  "codigo" TEXT,
  "descripcion" TEXT NOT NULL,
  "unidad" "CompraUnidad" NOT NULL DEFAULT 'UNIDAD',
  "cantidad" DOUBLE PRECISION NOT NULL,
  "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_solicitud_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_solicitud_items_solicitudCompraId_idx" ON "compras_solicitud_items"("solicitudCompraId");

ALTER TABLE "compras_solicitud_items" ADD CONSTRAINT "compras_solicitud_items_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "compras_adjuntos" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "tipoAdjunto" "CompraTipoAdjunto" NOT NULL DEFAULT 'OTRO',
  "nombre" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compras_adjuntos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_adjuntos_solicitudCompraId_idx" ON "compras_adjuntos"("solicitudCompraId");

ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "compras_documentos" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "tipoDocumento" "CompraTipoDocumento" NOT NULL DEFAULT 'ORDEN_COMPRA_PDF',
  "nombreArchivo" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "storagePath" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generadoPorId" TEXT NOT NULL,
  CONSTRAINT "compras_documentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_documentos_solicitudCompraId_idx" ON "compras_documentos"("solicitudCompraId");
CREATE INDEX "compras_documentos_solicitudCompraId_activo_idx" ON "compras_documentos"("solicitudCompraId", "activo");
CREATE INDEX "compras_documentos_solicitudCompraId_tipoDocumento_idx" ON "compras_documentos"("solicitudCompraId", "tipoDocumento");

ALTER TABLE "compras_documentos" ADD CONSTRAINT "compras_documentos_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_documentos" ADD CONSTRAINT "compras_documentos_generadoPorId_fkey"
  FOREIGN KEY ("generadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
