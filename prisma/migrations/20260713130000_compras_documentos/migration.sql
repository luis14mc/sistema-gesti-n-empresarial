-- Tabla de documentos PDF generados para solicitudes de compra

CREATE TYPE "CompraTipoDocumento" AS ENUM ('ORDEN_COMPRA_PDF');

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
