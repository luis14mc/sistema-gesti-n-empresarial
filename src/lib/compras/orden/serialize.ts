import type { Prisma } from '@prisma/client';
import { decimalToNumber, formatItemTaxLabel } from './calculos';

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
    generatedBy: { select: { id: true; firstName: true; lastName: true } };
    issuedBy: { select: { id: true; firstName: true; lastName: true } };
    supplier: { select: { id: true; nombreRazonSocial: true } };
    items: { include: { taxes: true } };
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

function summarizeStoredTaxes(items: OrderWithRelations['items']) {
  const usesItemTaxes = items.some((item) => item.taxProfile != null);
  if (!usesItemTaxes) {
    return { taxSummary: [], exemptBase: 0, usesItemTaxes: false };
  }
  const groups = new Map<string, { code: string; name: string; rate: number; taxableBase: number; amount: number }>();
  let exemptBase = 0;
  for (const item of items) {
    const taxes = item.taxes ?? [];
    if (taxes.length === 0) {
      exemptBase = Math.round((exemptBase + decimalToNumber(item.taxableBase)) * 100) / 100;
      continue;
    }
    for (const taxLine of taxes) {
      const rate = decimalToNumber(taxLine.rate);
      const key = `${taxLine.code}:${rate}`;
      const current = groups.get(key);
      const taxableBase = decimalToNumber(taxLine.taxableBase);
      const amount = decimalToNumber(taxLine.amount);
      if (current) {
        current.taxableBase = Math.round((current.taxableBase + taxableBase) * 100) / 100;
        current.amount = Math.round((current.amount + amount) * 100) / 100;
      } else {
        groups.set(key, { code: taxLine.code, name: taxLine.name, rate, taxableBase, amount });
      }
    }
  }
  return { taxSummary: [...groups.values()], exemptBase, usesItemTaxes: true };
}

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
    requesterEmployeeId: order.requesterEmployeeId,
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
    generatedById: order.generatedById,
    generatedAt: order.generatedAt?.toISOString() ?? null,
    generatedBy: order.generatedBy ?? null,
    generatedByName: order.generatedBy
      ? `${order.generatedBy.firstName} ${order.generatedBy.lastName}`.replace(/\s+/g, ' ').trim()
      : null,
    issuedById: order.issuedById,
    issuedAt: order.issuedAt?.toISOString() ?? null,
    issuedBy: order.issuedBy ?? null,
    issuedByName: order.issuedBy
      ? `${order.issuedBy.firstName} ${order.issuedBy.lastName}`.replace(/\s+/g, ' ').trim()
      : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    createdBy: order.createdBy,
    supplier: order.supplier,
    items: order.items.map((item) => {
      const taxes = (item.taxes ?? []).map((taxLine) => ({
        id: taxLine.id,
        code: taxLine.code,
        name: taxLine.name,
        rate: decimalToNumber(taxLine.rate),
        taxableBase: decimalToNumber(taxLine.taxableBase),
        amount: decimalToNumber(taxLine.amount),
        sortOrder: taxLine.sortOrder,
      }));
      return {
        id: item.id,
        orderId: item.orderId,
        itemNumber: item.itemNumber,
        description: item.description,
        unit: item.unit,
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        total: decimalToNumber(item.total),
        taxProfile: item.taxProfile,
        taxableBase: decimalToNumber(item.taxableBase),
        taxAmount: decimalToNumber(item.taxAmount),
        itemTotal: decimalToNumber(item.itemTotal),
        taxLabel: item.taxProfile ? formatItemTaxLabel(taxes) : null,
        taxes,
      };
    }),
    ...summarizeStoredTaxes(order.items),
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
