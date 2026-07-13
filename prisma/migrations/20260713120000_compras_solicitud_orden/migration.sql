-- =====================================================
-- Módulo Compras: Solicitud y Orden de Compra
-- Reemplaza purchase_requests por compras_solicitudes
-- =====================================================

DROP TABLE IF EXISTS "purchase_requests" CASCADE;

CREATE TYPE "CompraTipo" AS ENUM ('BIENES', 'SERVICIOS', 'BIENES_SERVICIOS');
CREATE TYPE "CompraPrioridad" AS ENUM ('URGENTE', 'ALTA', 'NORMAL', 'BAJA');
CREATE TYPE "CompraFormaPago" AS ENUM ('CONTADO', 'CREDITO', 'ANTICIPO', 'CONTRA_ENTREGA');
CREATE TYPE "CompraUnidad" AS ENUM ('UNIDAD', 'CAJA', 'PAQUETE', 'SERVICIO', 'LOTE', 'MES', 'HORA', 'DIA');
CREATE TYPE "CompraEstado" AS ENUM (
  'BORRADOR',
  'ENVIADA',
  'PENDIENTE_AUTORIZACION_JEFE',
  'AUTORIZADA_JEFE',
  'RECHAZADA_JEFE',
  'PENDIENTE_APROBACION_GERENCIA',
  'APROBADA_GERENCIA',
  'RECHAZADA_GERENCIA',
  'PENDIENTE_COMPRAS',
  'ORDEN_EMITIDA',
  'RECIBIDA',
  'CERRADA',
  'ANULADA'
);
CREATE TYPE "CompraTipoAdjunto" AS ENUM (
  'COTIZACION',
  'FACTURA',
  'PROFORMA',
  'CORREO_AUTORIZACION',
  'SOPORTE_TECNICO',
  'OTRO'
);

CREATE TABLE "cost_centers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

CREATE TABLE "proveedores" (
  "id" TEXT NOT NULL,
  "nombreRazonSocial" TEXT NOT NULL,
  "rtn" TEXT,
  "telefono" TEXT,
  "email" TEXT,
  "personaContacto" TEXT,
  "direccion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proveedores_activo_idx" ON "proveedores"("activo");
CREATE INDEX "proveedores_nombreRazonSocial_idx" ON "proveedores"("nombreRazonSocial");

CREATE TABLE "compras_solicitudes" (
  "id" TEXT NOT NULL,
  "codigoSolicitud" TEXT NOT NULL,
  "fechaSolicitud" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaRequerida" DATE NOT NULL,
  "departamentoSolicitanteId" TEXT NOT NULL,
  "centroCostoId" TEXT NOT NULL,
  "solicitadoPorId" TEXT NOT NULL,
  "cargoSolicitante" TEXT,
  "tipoCompra" "CompraTipo" NOT NULL,
  "prioridad" "CompraPrioridad" NOT NULL DEFAULT 'NORMAL',
  "estado" "CompraEstado" NOT NULL DEFAULT 'BORRADOR',
  "proveedorId" TEXT,
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
  "emitidoPorId" TEXT,
  "emitidoEn" TIMESTAMP(3),
  "motivoRechazo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "compras_solicitudes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_solicitudes_codigoSolicitud_key" ON "compras_solicitudes"("codigoSolicitud");
CREATE INDEX "compras_solicitudes_estado_idx" ON "compras_solicitudes"("estado");
CREATE INDEX "compras_solicitudes_prioridad_idx" ON "compras_solicitudes"("prioridad");
CREATE INDEX "compras_solicitudes_tipoCompra_idx" ON "compras_solicitudes"("tipoCompra");
CREATE INDEX "compras_solicitudes_departamentoSolicitanteId_idx" ON "compras_solicitudes"("departamentoSolicitanteId");
CREATE INDEX "compras_solicitudes_centroCostoId_idx" ON "compras_solicitudes"("centroCostoId");
CREATE INDEX "compras_solicitudes_proveedorId_idx" ON "compras_solicitudes"("proveedorId");
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
  "precioUnitario" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_solicitud_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_solicitud_items_solicitudCompraId_idx" ON "compras_solicitud_items"("solicitudCompraId");

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

ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_departamentoSolicitanteId_fkey"
  FOREIGN KEY ("departamentoSolicitanteId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_centroCostoId_fkey"
  FOREIGN KEY ("centroCostoId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_solicitadoPorId_fkey"
  FOREIGN KEY ("solicitadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_autorizadoPorId_fkey"
  FOREIGN KEY ("autorizadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_aprobadoPorId_fkey"
  FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras_solicitudes" ADD CONSTRAINT "compras_solicitudes_emitidoPorId_fkey"
  FOREIGN KEY ("emitidoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "compras_solicitud_items" ADD CONSTRAINT "compras_solicitud_items_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_solicitudCompraId_fkey"
  FOREIGN KEY ("solicitudCompraId") REFERENCES "compras_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras_adjuntos" ADD CONSTRAINT "compras_adjuntos_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
