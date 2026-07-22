-- Quitar forma de pago, plazo y condiciones de entrega

ALTER TABLE "compras_solicitudes" DROP COLUMN IF EXISTS "condicionesEntrega";
ALTER TABLE "compras_solicitudes" DROP COLUMN IF EXISTS "formaPago";
ALTER TABLE "compras_solicitudes" DROP COLUMN IF EXISTS "plazoPagoDias";

DROP TYPE IF EXISTS "CompraFormaPago";
