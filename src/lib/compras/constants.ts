import type {
  CompraEstado,
  CompraFormaPago,
  CompraPrioridad,
  CompraTipo,
  CompraUnidad,
} from '@prisma/client';

export const COMPRA_TIPO_LABELS: Record<CompraTipo, string> = {
  BIENES: 'Bienes',
  SERVICIOS: 'Servicios',
  BIENES_SERVICIOS: 'Bienes y Servicios',
};

export const COMPRA_PRIORIDAD_LABELS: Record<CompraPrioridad, string> = {
  URGENTE: 'Urgente',
  ALTA: 'Alta',
  NORMAL: 'Normal',
  BAJA: 'Baja',
};

export const COMPRA_FORMA_PAGO_LABELS: Record<CompraFormaPago, string> = {
  CONTADO: 'Contado',
  CREDITO: 'Crédito',
  ANTICIPO: 'Anticipo',
  CONTRA_ENTREGA: 'Contra Entrega',
};

export const COMPRA_UNIDAD_LABELS: Record<CompraUnidad, string> = {
  UNIDAD: 'Unidad',
  CAJA: 'Caja',
  PAQUETE: 'Paquete',
  SERVICIO: 'Servicio',
  LOTE: 'Lote',
  MES: 'Mes',
  HORA: 'Hora',
  DIA: 'Día',
};

export const COMPRA_ESTADO_LABELS: Record<CompraEstado, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  AUTORIZADA: 'Autorizada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ORDEN_EMITIDA: 'Orden emitida',
  RECIBIDA: 'Recibida',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
};

export const COMPRA_NOTA_IMPORTANTE = `Esta orden de compra es válida únicamente con las firmas autorizadas correspondientes.
El proveedor debe confirmar la recepción de esta orden dentro de las 24 horas siguientes.
Cualquier modificación a esta orden debe ser autorizada por escrito por el área de compras.
La factura debe emitirse con los datos fiscales de la empresa y entregarse junto con la mercancía o al finalizar el servicio.`;

export const COMPRA_IMPUESTO_TASA = 0.15;

export const COMPRA_ESTADOS_EDITABLES: CompraEstado[] = ['BORRADOR'];
