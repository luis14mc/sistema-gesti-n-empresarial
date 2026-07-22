import type { CompraEstado, CompraUnidad } from '@prisma/client';

export const COMPRA_UNIDAD_LABELS: Record<CompraUnidad, string> = {
  UNIDAD: 'Unidad',
  CAJA: 'Caja',
  PAQUETE: 'Paquete',
  SERVICIO: 'Servicio',
  LOTE: 'Lote',
  MES: 'Mes',
  HORA: 'Hora',
  DIA: 'Día',
  OTRO: 'Otro',
};

export const COMPRA_ESTADO_LABELS: Record<CompraEstado, string> = {
  BORRADOR: 'Borrador',
  GENERADA: 'Generada',
  EMITIDA: 'Emitida',
  ANULADA: 'Anulada',
  CERRADA: 'Cerrada',
};

export const COMPRA_IMPUESTO_TASA = 0.15;

export const COMPRA_ESTADOS_EDITABLES: CompraEstado[] = ['BORRADOR'];

export const COMPRA_ESTADOS_PENDIENTES: CompraEstado[] = ['BORRADOR', 'GENERADA'];
export const COMPRA_ESTADOS_FINALIZADOS: CompraEstado[] = ['EMITIDA', 'CERRADA', 'ANULADA'];

export const COMPRA_TIPO_ADJUNTO_LABELS: Record<string, string> = {
  COTIZACION: 'Cotización',
  FACTURA: 'Factura',
  SOPORTE_TECNICO: 'Soporte',
  OTRO: 'Otro',
};
