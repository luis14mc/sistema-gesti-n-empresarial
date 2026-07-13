-- Ficha Solicitud y Orden de Compra (formato Excel)

DROP TABLE IF EXISTS "compras_recepciones" CASCADE;
DROP TABLE IF EXISTS "compras_ordenes" CASCADE;
DROP TABLE IF EXISTS "compras_cotizaciones" CASCADE;
DROP TABLE IF EXISTS "compras_adjuntos" CASCADE;
DROP TABLE IF EXISTS "compras_solicitud_items" CASCADE;
DROP TABLE IF EXISTS "compras_solicitudes" CASCADE;

DROP TYPE IF EXISTS "CompraEstado";
DROP TYPE IF EXISTS "CompraTipo";
DROP TYPE IF EXISTS "CompraFormaPago";

CREATE TYPE "CompraTipo" AS ENUM ('BIENES', 'SERVICIOS', 'BIENES_SERVICIOS');
CREATE TYPE "CompraFormaPago" AS ENUM ('CONTADO', 'CREDITO', 'ANTICIPO', 'CONTRA_ENTREGA');
CREATE TYPE "CompraEstado" AS ENUM (
  'BORRADOR', 'ENVIADA', 'AUTORIZADA', 'APROBADA', 'RECHAZADA',
  'ORDEN_EMITIDA', 'RECIBIDA', 'CERRADA', 'ANULADA'
);

CREATE TABLE "compras_solicitudes" (
  "id" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "fechaSolicitud" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaRequerida" DATE,
  "departamentoSolicitanteId" TEXT,
  "centroCostoId" TEXT,
  "solicitadoPorId" TEXT NOT NULL,
  "cargoSolicitante" TEXT,
  "tipoCompra" "CompraTipo" NOT NULL,
  "prioridad" "CompraPrioridad" NOT NULL DEFAULT 'NORMAL',
  "estado" "CompraEstado" NOT NULL DEFAULT 'BORRADOR',
  "proveedorId" TEXT,
  "proveedorNombre" TEXT,
  "proveedorIdentificacion" TEXT,
  "proveedorTelefono" TEXT,
  "proveedorEmail" TEXT,
  "proveedorContacto" TEXT,
  "proveedorDireccion" TEXT,
  "justificacionCompra" TEXT NOT NULL,
  "condicionesEntrega" TEXT,
  "observacionesAdicionales" TEXT,
  "formaPago" "CompraFormaPago" NOT NULL,
  "plazoPagoDias" INTEGER,
  "detallesPago" TEXT,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "impuesto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "autorizadoPorId" TEXT,
  "autorizadoEn" TIMESTAMP(3),
  "aprobadoPorId" TEXT,
  "aprobadoEn" TIMESTAMP(3),
  "rechazadoPorId" TEXT,
  "rechazadoEn" TIMESTAMP(3),
  "motivoRechazo" TEXT,
  "emitidoPorId" TEXT,
  "emitidoEn" TIMESTAMP(3),
  "documentoPdfUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "compras_solicitudes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_solicitudes_numero_key" ON "compras_solicitudes"("numero");
CREATE INDEX "compras_solicitudes_estado_idx" ON "compras_solicitudes"("estado");
CREATE INDEX "compras_solicitudes_prioridad_idx" ON "compras_solicitudes"("prioridad");
CREATE INDEX "compras_solicitudes_tipoCompra_idx" ON "compras_solicitudes"("tipoCompra");
CREATE INDEX "compras_solicitudes_solicitadoPorId_idx" ON "compras_solicitudes"("solicitadoPorId");
CREATE INDEX "compras_solicitudes_fechaSolicitud_idx" ON "compras_solicitudes"("fechaSolicitud");

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

CREATE TABLE "compras_adjuntos" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storagePath" TEXT,
  "url" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compras_adjuntos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_adjuntos_solicitudCompraId_idx" ON "compras_adjuntos"("solicitudCompraId");

ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_solicitadoPorId_fkey"
  FOREIGN KEY ("solicitadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_departamentoSolicitanteId_fkey"
  FOREIGN KEY ("departamentoSolicitanteId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_centroCostoId_fkey"
  FOREIGN KEY ("centroCostoId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_autorizadoPorId_fkey"
  FOREIGN KEY ("autorizadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_aprobadoPorId_fkey"
  FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_rechazadoPorId_fkey"
  FOREIGN KEY ("rechazadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "compras_solicitud_items" ADD CONSTRAINT "compras_solicitud_items_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
