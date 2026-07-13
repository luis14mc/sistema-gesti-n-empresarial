-- Rediseño módulo Compras: flujo simplificado con cotizaciones, órdenes y recepciones

DROP TABLE IF EXISTS "compras_documentos" CASCADE;
DROP TABLE IF EXISTS "compras_recepciones" CASCADE;
DROP TABLE IF EXISTS "compras_ordenes" CASCADE;
DROP TABLE IF EXISTS "compras_cotizaciones" CASCADE;
DROP TABLE IF EXISTS "compras_adjuntos" CASCADE;
DROP TABLE IF EXISTS "compras_solicitud_items" CASCADE;
DROP TABLE IF EXISTS "compras_solicitudes" CASCADE;

DROP TYPE IF EXISTS "CompraTipoDocumento";
DROP TYPE IF EXISTS "CompraTipoAdjunto";
DROP TYPE IF EXISTS "CompraFormaPago";
DROP TYPE IF EXISTS "CompraEstado";
DROP TYPE IF EXISTS "CompraTipo";

CREATE TYPE "CompraTipo" AS ENUM ('BIENES', 'SERVICIOS');

CREATE TYPE "CompraEstado" AS ENUM (
  'BORRADOR',
  'ENVIADA',
  'EN_REVISION',
  'APROBADA',
  'RECHAZADA',
  'ORDEN_GENERADA',
  'RECIBIDA',
  'CERRADA',
  'ANULADA'
);

CREATE TABLE "compras_solicitudes" (
  "id" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "fechaSolicitud" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "solicitanteId" TEXT NOT NULL,
  "departamentoId" TEXT,
  "centroCostoId" TEXT,
  "tipo" "CompraTipo" NOT NULL,
  "prioridad" "CompraPrioridad" NOT NULL DEFAULT 'NORMAL',
  "estado" "CompraEstado" NOT NULL DEFAULT 'BORRADOR',
  "titulo" TEXT NOT NULL,
  "justificacion" TEXT NOT NULL,
  "observaciones" TEXT,
  "totalEstimado" DOUBLE PRECISION,
  "totalAprobado" DOUBLE PRECISION,
  "revisadoPorId" TEXT,
  "revisadoEn" TIMESTAMP(3),
  "aprobadoPorId" TEXT,
  "aprobadoEn" TIMESTAMP(3),
  "rechazadoPorId" TEXT,
  "rechazadoEn" TIMESTAMP(3),
  "motivoRechazo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "compras_solicitudes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_solicitudes_numero_key" ON "compras_solicitudes"("numero");
CREATE INDEX "compras_solicitudes_estado_idx" ON "compras_solicitudes"("estado");
CREATE INDEX "compras_solicitudes_prioridad_idx" ON "compras_solicitudes"("prioridad");
CREATE INDEX "compras_solicitudes_tipo_idx" ON "compras_solicitudes"("tipo");
CREATE INDEX "compras_solicitudes_solicitanteId_idx" ON "compras_solicitudes"("solicitanteId");
CREATE INDEX "compras_solicitudes_departamentoId_idx" ON "compras_solicitudes"("departamentoId");
CREATE INDEX "compras_solicitudes_fechaSolicitud_idx" ON "compras_solicitudes"("fechaSolicitud");

CREATE TABLE "compras_solicitud_items" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "item" INTEGER NOT NULL,
  "descripcion" TEXT NOT NULL,
  "especificaciones" TEXT,
  "unidad" "CompraUnidad" NOT NULL DEFAULT 'UNIDAD',
  "cantidad" DOUBLE PRECISION NOT NULL,
  "precioEstimado" DOUBLE PRECISION,
  "precioAprobado" DOUBLE PRECISION,
  "totalEstimado" DOUBLE PRECISION,
  "totalAprobado" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_solicitud_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_solicitud_items_solicitudCompraId_idx" ON "compras_solicitud_items"("solicitudCompraId");

CREATE TABLE "compras_cotizaciones" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "proveedorId" TEXT,
  "proveedorNombre" TEXT NOT NULL,
  "monto" DOUBLE PRECISION,
  "moneda" TEXT NOT NULL DEFAULT 'HNL',
  "fechaCotizacion" DATE,
  "validezDias" INTEGER,
  "seleccionada" BOOLEAN NOT NULL DEFAULT false,
  "justificacion" TEXT,
  "documentoUrl" TEXT,
  "documentoNombre" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_cotizaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_cotizaciones_solicitudCompraId_idx" ON "compras_cotizaciones"("solicitudCompraId");
CREATE INDEX "compras_cotizaciones_proveedorId_idx" ON "compras_cotizaciones"("proveedorId");

CREATE TABLE "compras_ordenes" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "numeroOrden" TEXT NOT NULL,
  "proveedorId" TEXT,
  "proveedorNombre" TEXT NOT NULL,
  "rtnProveedor" TEXT,
  "fechaEmision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "condicionesPago" TEXT,
  "lugarEntrega" TEXT,
  "tiempoEntrega" TEXT,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "impuesto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "documentoPdfUrl" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'EMITIDA',
  "emitidoPorId" TEXT NOT NULL,
  "emitidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_ordenes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_ordenes_numeroOrden_key" ON "compras_ordenes"("numeroOrden");
CREATE INDEX "compras_ordenes_solicitudCompraId_idx" ON "compras_ordenes"("solicitudCompraId");
CREATE INDEX "compras_ordenes_proveedorId_idx" ON "compras_ordenes"("proveedorId");

CREATE TABLE "compras_recepciones" (
  "id" TEXT NOT NULL,
  "solicitudCompraId" TEXT NOT NULL,
  "ordenCompraId" TEXT,
  "fechaRecepcion" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recibidoPorId" TEXT NOT NULL,
  "tipoRecepcion" TEXT NOT NULL DEFAULT 'COMPLETA',
  "observaciones" TEXT,
  "facturaUrl" TEXT,
  "actaRecepcionUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_recepciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_recepciones_solicitudCompraId_idx" ON "compras_recepciones"("solicitudCompraId");
CREATE INDEX "compras_recepciones_ordenCompraId_idx" ON "compras_recepciones"("ordenCompraId");

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

ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_solicitanteId_fkey"
  FOREIGN KEY ("solicitanteId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_departamentoId_fkey"
  FOREIGN KEY ("departamentoId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_centroCostoId_fkey"
  FOREIGN KEY ("centroCostoId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_revisadoPorId_fkey"
  FOREIGN KEY ("revisadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_aprobadoPorId_fkey"
  FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_rechazadoPorId_fkey"
  FOREIGN KEY ("rechazadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "compras_solicitud_items" ADD CONSTRAINT "compras_solicitud_items_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compras_cotizaciones" ADD CONSTRAINT "compras_cotizaciones_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_cotizaciones" ADD CONSTRAINT "compras_cotizaciones_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_emitidoPorId_fkey"
  FOREIGN KEY ("emitidoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compras_recepciones" ADD CONSTRAINT "compras_recepciones_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_recepciones" ADD CONSTRAINT "compras_recepciones_ordenCompraId_fkey"
  FOREIGN KEY ("ordenCompraId") REFERENCES "compras_ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_recepciones" ADD CONSTRAINT "compras_recepciones_recibidoPorId_fkey"
  FOREIGN KEY ("recibidoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
