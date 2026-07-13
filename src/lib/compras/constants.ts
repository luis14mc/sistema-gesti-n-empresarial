import type {
  CompraEstado,
  CompraFormaPago,
  CompraPrioridad,
  CompraTipo,
  CompraTipoAdjunto,
  CompraUnidad,
} from '@prisma/client';

export const COMPRA_TIPO_LABELS: Record<CompraTipo, string> = {
  BIENES: 'Bienes',
  SERVICIOS: 'Servicios',
  BIENES_SERVICIOS: 'Bienes y servicios',
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
  CONTRA_ENTREGA: 'Contra entrega',
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
  PENDIENTE_AUTORIZACION_JEFE: 'Pendiente autorización jefe',
  AUTORIZADA_JEFE: 'Autorizada por jefe',
  RECHAZADA_JEFE: 'Rechazada por jefe',
  PENDIENTE_APROBACION_GERENCIA: 'Pendiente aprobación gerencia',
  APROBADA_GERENCIA: 'Aprobada por gerencia',
  RECHAZADA_GERENCIA: 'Rechazada por gerencia',
  PENDIENTE_COMPRAS: 'Pendiente compras',
  ORDEN_EMITIDA: 'Orden emitida',
  RECIBIDA: 'Recibida',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
};

export const COMPRA_ADJUNTO_LABELS: Record<CompraTipoAdjunto, string> = {
  COTIZACION: 'Cotización',
  FACTURA: 'Factura',
  PROFORMA: 'Proforma',
  CORREO_AUTORIZACION: 'Correo de autorización',
  SOPORTE_TECNICO: 'Soporte técnico',
  OTRO: 'Otro',
};

export const COMPRA_ESTADOS_TERMINALES: CompraEstado[] = [
  'RECHAZADA_JEFE',
  'RECHAZADA_GERENCIA',
  'CERRADA',
  'ANULADA',
];

export const COMPRA_ESTADOS_EDITABLES: CompraEstado[] = ['BORRADOR'];

export const COMPRA_IMPUESTO_TASA = 0.15;
