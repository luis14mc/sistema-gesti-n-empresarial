import type { Prisma } from '@prisma/client';
import { decimalToNumber } from './calculos';

type OrderDocument = {
  id: string;
  orderId: string;
  type: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  version: number;
  isActive: boolean;
  uploadedAt: Date;
  uploadedBy?: { id: string; firstName: string; lastName: string } | null;
};

function mapDocument(doc: OrderDocument) {
  return {
    id: doc.id,
    orderId: doc.orderId,
    type: doc.type,
    name: doc.name,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    storageKey: doc.storageKey,
    url: doc.url,
    version: doc.version,
    isActive: doc.isActive,
    uploadedAt: doc.uploadedAt.toISOString(),
    uploadedBy: doc.uploadedBy ?? undefined,
  };
}

type OrderWithRelations = Prisma.CompraOrdenGetPayload<{
  include: {
    createdBy: { select: { id: true; firstName: true; lastName: true } };
    supplier: { select: { id: true; nombreRazonSocial: true } };
    items: true;
    documentos: { include: { uploadedBy: { select: { id: true; firstName: true; lastName: true } } } };
  };
}>;

type OrderListItem = Prisma.CompraOrdenGetPayload<{
  include: {
    createdBy: { select: { id: true; firstName: true; lastName: true } };
    supplier: { select: { id: true; nombreRazonSocial: true } };
    _count: { select: { documentos: true } };
  };
}>;

export function serializePurchaseOrder(order: OrderWithRelations) {
  const pdfDoc = order.documentos?.find((d) => d.type === 'ORDER_PDF' && d.isActive);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    sequenceNumber: order.sequenceNumber,
    sequenceYear: order.sequenceYear,
    purchaseReference: order.purchaseReference,
    requestDate: order.requestDate.toISOString(),
    requiredDate: order.requiredDate.toISOString(),
    requestedByName: order.requestedByName,
    requesterJobTitle: order.requesterJobTitle,
    createdById: order.createdById,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    supplierRtn: order.supplierRtn,
    supplierPhone: order.supplierPhone,
    purchaseJustification: order.purchaseJustification,
    subtotal: decimalToNumber(order.subtotal),
    discountType: order.discountType,
    discountValue: decimalToNumber(order.discountValue),
    discount: decimalToNumber(order.discount),
    taxRate: decimalToNumber(order.taxRate),
    tax: decimalToNumber(order.tax),
    total: decimalToNumber(order.total),
    status: order.status,
    templateId: order.templateId,
    templateVersion: order.templateVersion,
    pdfUrl: pdfDoc?.url ?? null,
    pdfVersion: pdfDoc?.version ?? 0,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    createdBy: order.createdBy,
    supplier: order.supplier,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      total: decimalToNumber(item.total),
    })),
    documents: (order.documentos ?? []).map(mapDocument),
    documentos: (order.documentos ?? []).map(mapDocument),
    // Legacy field aliases for gradual UI migration
    numeroOrden: order.orderNumber,
    referenciaCompra: order.purchaseReference,
    fechaSolicitud: order.requestDate.toISOString(),
    fechaRequerida: order.requiredDate.toISOString(),
    solicitadoPorNombre: order.requestedByName,
    cargoSolicitante: order.requesterJobTitle,
    solicitadoPorId: order.createdById,
    proveedorId: order.supplierId,
    proveedorNombre: order.supplierName,
    proveedorRtn: order.supplierRtn,
    proveedorTelefono: order.supplierPhone,
    justificacionCompra: order.purchaseJustification,
    tasaImpuesto: decimalToNumber(order.taxRate),
    impuesto: decimalToNumber(order.tax),
    descuento: decimalToNumber(order.discount),
    estado: order.status,
  };
}

export type SerializedPurchaseOrder = ReturnType<typeof serializePurchaseOrder>;
export const serializeCompraOrden = serializePurchaseOrder;
export type SerializedCompraOrden = SerializedPurchaseOrder;

export function serializePurchaseOrderListItem(order: OrderListItem) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    purchaseReference: order.purchaseReference,
    requestDate: order.requestDate.toISOString(),
    requiredDate: order.requiredDate.toISOString(),
    requestedByName: order.requestedByName,
    supplierName: order.supplierName,
    total: decimalToNumber(order.total),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    createdBy: order.createdBy,
    supplier: order.supplier,
    documentsCount: order._count.documentos,
    numeroOrden: order.orderNumber,
    referenciaCompra: order.purchaseReference,
    proveedorNombre: order.supplierName,
    estado: order.status,
  };
}
