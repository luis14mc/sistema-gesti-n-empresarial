import type { CompraSolicitud, CompraSolicitudItem, PurchaseOrderStatus, PurchaseUnit } from '@prisma/client';
import { PurchaseOrderDocument } from '@/components/compras/document/PurchaseOrderDocument';
import { getActiveTemplateConfig } from './orden/template';
import type { PurchaseOrderPreviewData } from './orden/preview-data';
import { resolveInstitutionLogoDataUri } from './institution';
import { ORDER_STATUS_LABELS } from './orden/constants';
import { calculatePurchaseOrder } from './orden/calculos';

type OrdenPdfData = CompraSolicitud & {
  items: CompraSolicitudItem[];
  solicitadoPor?: { firstName: string; lastName: string } | null;
};

const units: Record<string, PurchaseUnit> = {
  UNIDAD: 'UNIT', CAJA: 'BOX', PAQUETE: 'PACKAGE', SERVICIO: 'SERVICE', LOTE: 'LOT', MES: 'MONTH', HORA: 'HOUR', DIA: 'DAY', OTRO: 'OTHER',
};
const statuses: Record<string, PurchaseOrderStatus> = {
  BORRADOR: 'DRAFT', GENERADA: 'GENERATED', EMITIDA: 'ISSUED', ANULADA: 'CANCELLED', CERRADA: 'CLOSED',
};

// Legacy CompraSolicitud renderer. Active CompraOrden workflows use orden/pdf.tsx.
export async function construirHtmlOrdenCompra(orden: OrdenPdfData, _version = 1, organizationId?: string): Promise<string> {
  if (!organizationId) throw new Error('LEGACY_PURCHASE_WORKFLOW_DISABLED');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const format = await getActiveTemplateConfig(organizationId);
  const resolvedFormat = { ...format, logoUrl: format.logoUrl ? await resolveInstitutionLogoDataUri(format.logoUrl) : null };
  const requestedByName = orden.solicitadoPor ? `${orden.solicitadoPor.firstName} ${orden.solicitadoPor.lastName}` : '—';
  const calculated = calculatePurchaseOrder({
    discountType: orden.descuento > 0 ? 'MONTO' : 'NINGUNO',
    discountValue: orden.descuento,
    items: orden.items.map((item) => ({
      quantity: item.cantidad,
      unitPrice: item.precioUnitario,
      taxProfile: 'GENERAL_15' as const,
    })),
  });
  const document: PurchaseOrderPreviewData = {
    orderNumber: orden.numeroOrden,
    purchaseReference: orden.referenciaCompra ?? '—',
    requestDate: orden.fechaSolicitud.toISOString(),
    requiredDate: (orden.fechaRequerida ?? orden.fechaSolicitud).toISOString(),
    requestedByName,
    requesterJobTitle: orden.cargoSolicitante ?? '—',
    supplierName: orden.proveedorNombre ?? '—',
    supplierRtn: orden.proveedorIdentificacion ?? '—',
    supplierPhone: orden.proveedorTelefono ?? '—',
    purchaseJustification: orden.justificacionCompra,
    subtotal: calculated.subtotal.toNumber(),
    discountType: orden.descuento > 0 ? 'MONTO' : 'NINGUNO',
    discountValue: orden.descuento,
    discount: calculated.discount.toNumber(),
    taxableBase: calculated.taxableBase.toNumber(),
    tax: calculated.tax.toNumber(),
    total: calculated.total.toNumber(),
    taxSummary: calculated.taxSummary.map((line) => ({
      code: line.code,
      name: line.name,
      rate: line.rate.toNumber(),
      taxableBase: line.taxableBase.toNumber(),
      amount: line.amount.toNumber(),
    })),
    exemptBase: calculated.exemptBase.toNumber(),
    items: orden.items.map((item, index) => {
      const line = calculated.items[index];
      return {
        itemNumber: item.item,
        description: item.descripcion,
        unit: units[item.unidad] ?? 'OTHER',
        quantity: item.cantidad,
        unitPrice: item.precioUnitario,
        total: line.lineSubtotal.toNumber(),
        taxableBase: line.taxableBase.toNumber(),
        taxAmount: line.taxAmount.toNumber(),
        itemTotal: line.itemTotal.toNumber(),
        taxLabel: line.taxLabel,
        taxProfile: line.taxProfile,
        taxes: line.taxes.map((taxLine) => ({
          code: taxLine.code,
          name: taxLine.name,
          rate: taxLine.rate.toNumber(),
          taxableBase: taxLine.taxableBase.toNumber(),
          amount: taxLine.amount.toNumber(),
        })),
      };
    }),
    template: resolvedFormat,
    isDraft: orden.estado === 'BORRADOR' || !orden.numeroOrden,
    status: statuses[orden.estado] ?? 'DRAFT',
    statusLabel: ORDER_STATUS_LABELS[statuses[orden.estado] ?? 'DRAFT'],
  };
  let markup: string;
  try {
    markup = renderToStaticMarkup(
      <PurchaseOrderDocument order={document} format={resolvedFormat} draft={document.isDraft} />
    );
  } catch (error) {
    throw new Error('PURCHASE_ORDER_RENDER_FAILED', { cause: error });
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>${markup}</body></html>`;
}

export const construirHtmlSolicitudCompra = construirHtmlOrdenCompra;
