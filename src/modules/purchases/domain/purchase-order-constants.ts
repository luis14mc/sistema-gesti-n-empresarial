import type { PurchaseOrderStatus, PurchaseUnit, PurchaseDocumentType } from '@prisma/client';

export const ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Borrador',
  GENERATED: 'Generada',
  ISSUED: 'Emitida',
  CANCELLED: 'Anulada',
  CLOSED: 'Cerrada',
};

export const ORDER_PENDING_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'GENERATED'];

export const UNIT_LABELS: Record<PurchaseUnit, string> = {
  UNIT: 'Unidad',
  BOX: 'Caja',
  PACKAGE: 'Paquete',
  SERVICE: 'Servicio',
  LOT: 'Lote',
  MONTH: 'Mes',
  HOUR: 'Hora',
  DAY: 'Día',
  OTHER: 'Otro',
};

export const DOCUMENT_TYPE_LABELS: Record<PurchaseDocumentType, string> = {
  ORDER_PDF: 'PDF Orden',
  QUOTATION: 'Cotización',
  INVOICE: 'Factura',
  PROFORMA: 'Proforma',
  SUPPORT: 'Soporte',
  RECEIPT: 'Acta de recepción',
  OTHER: 'Otro',
};

export const RELATED_DOCUMENT_TYPES: PurchaseDocumentType[] = [
  'QUOTATION', 'INVOICE', 'PROFORMA', 'SUPPORT', 'RECEIPT', 'OTHER',
];

// Legacy aliases
export const ORDEN_ESTADO_LABELS = ORDER_STATUS_LABELS;
export const ORDEN_UNIDAD_LABELS = UNIT_LABELS;
export const ORDEN_DOCUMENTO_LABELS = DOCUMENT_TYPE_LABELS;
export const ORDEN_ESTADOS_PENDIENTES = ORDER_PENDING_STATUSES;
