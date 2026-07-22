import type { PurchaseOrderStatus, PurchaseUnit } from '@prisma/client';
import type { CreatePurchaseOrderInput } from './schemas';
import { calculatePurchaseOrder, decimalToNumber, toDecimal } from './calculos';
import type { PurchaseOrderTemplateConfig } from './template-config';
import { ORDER_STATUS_LABELS } from './constants';

export type PurchaseOrderItemPreview = {
  itemNumber: number;
  description: string;
  unit: PurchaseUnit;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type PurchaseOrderPreviewData = {
  orderNumber?: string | null;
  purchaseReference: string;
  requestDate: string;
  requiredDate: string;
  requestedByName: string;
  requesterJobTitle: string;
  supplierName: string;
  supplierRtn: string;
  supplierPhone: string;
  purchaseJustification: string;
  subtotal: number;
  discountType: 'NINGUNO' | 'MONTO' | 'PORCENTAJE';
  discountValue: number;
  discount: number;
  taxableBase: number;
  taxRate: number;
  tax: number;
  total: number;
  items: PurchaseOrderItemPreview[];
  template: PurchaseOrderTemplateConfig;
  isDraft: boolean;
  status?: PurchaseOrderStatus;
  statusLabel: string;
};

type PurchaseOrderPreviewInput = Partial<Omit<CreatePurchaseOrderInput, 'items'>> & {
  items?: Array<Partial<CreatePurchaseOrderInput['items'][number]> | null>;
};

export function buildPreviewDataFromInput(
  input: PurchaseOrderPreviewInput,
  template: PurchaseOrderTemplateConfig
): PurchaseOrderPreviewData {
  const discountType = input.discountType ?? 'NINGUNO';
  const discountValue = toDecimal(input.discountValue, 0);
  const taxRate = toDecimal(input.taxRate ?? 15, 15);
  const items = (input.items ?? []).map((item, index) => {
    const quantity = toDecimal(item?.quantity, 0);
    const unitPrice = toDecimal(item?.unitPrice, 0);
    return {
      itemNumber: item?.itemNumber ?? index + 1,
      description: item?.description?.trim() || '',
      unit: item?.unit || 'UNIT',
      quantity,
      unitPrice,
    };
  });
  const itemsCalc = items.map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
  const { lineTotals, subtotal, discount: disc, taxableBase, tax, total } = calculatePurchaseOrder({
    items: itemsCalc,
    discountType,
    discountValue,
    taxRate,
  });

  return {
    orderNumber: null,
    purchaseReference: input.purchaseReference?.trim() || '',
    requestDate: input.requestDate || '',
    requiredDate: input.requiredDate || '',
    requestedByName: input.requestedByName?.trim() || '',
    requesterJobTitle: input.requesterJobTitle?.trim() || '',
    supplierName: input.supplierName?.trim() || '',
    supplierRtn: input.supplierRtn?.trim() || '',
    supplierPhone: input.supplierPhone?.trim() || '',
    purchaseJustification: input.purchaseJustification?.trim() || '',
    subtotal: subtotal.toNumber(),
    discountType,
    discountValue: discountValue.toNumber(),
    discount: disc.toNumber(),
    taxableBase: taxableBase.toNumber(),
    taxRate: taxRate.toNumber(),
    tax: tax.toNumber(),
    total: total.toNumber(),
    items: items.map((item, index) => ({
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      total: lineTotals[index].toNumber(),
    })),
    template,
    isDraft: true,
    status: 'DRAFT',
    statusLabel: ORDER_STATUS_LABELS.DRAFT,
  };
}

export function previewDataToPdfOrder(preview: PurchaseOrderPreviewData) {
  return {
    orderNumber: preview.orderNumber ?? null,
    purchaseReference: preview.purchaseReference,
    requestDate: new Date(preview.requestDate),
    requiredDate: new Date(preview.requiredDate),
    requestedByName: preview.requestedByName,
    requesterJobTitle: preview.requesterJobTitle,
    supplierName: preview.supplierName,
    supplierRtn: preview.supplierRtn,
    supplierPhone: preview.supplierPhone,
    purchaseJustification: preview.purchaseJustification,
    subtotal: toDecimal(preview.subtotal),
    discountType: preview.discountType,
    discountValue: toDecimal(preview.discountValue),
    discount: toDecimal(preview.discount),
    taxRate: toDecimal(preview.taxRate),
    tax: toDecimal(preview.tax),
    total: toDecimal(preview.total),
    status: (preview.status ?? (preview.isDraft ? 'DRAFT' : 'GENERATED')) as PurchaseOrderStatus,
    items: preview.items.map((item) => ({
      id: `preview-${item.itemNumber}`,
      orderId: 'preview',
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: toDecimal(item.quantity),
      unitPrice: toDecimal(item.unitPrice),
      total: toDecimal(item.total),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

export function buildPreviewDataFromSerializedOrder(
  order: {
    orderNumber?: string | null;
    purchaseReference: string;
    requestDate: string;
    requiredDate: string;
    requestedByName: string;
    requesterJobTitle: string;
    supplierName: string;
    supplierRtn: string;
    supplierPhone: string;
    purchaseJustification: string;
    subtotal: number;
    discountType?: 'NINGUNO' | 'MONTO' | 'PORCENTAJE';
    discountValue?: number;
    discount: number;
    taxRate: number;
    tax: number;
    total: number;
    status: PurchaseOrderStatus;
    items: Array<{
      itemNumber: number;
      description: string;
      unit: PurchaseUnit;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  },
  template: PurchaseOrderTemplateConfig
): PurchaseOrderPreviewData {
  return {
    orderNumber: order.orderNumber,
    purchaseReference: order.purchaseReference,
    requestDate: order.requestDate,
    requiredDate: order.requiredDate,
    requestedByName: order.requestedByName,
    requesterJobTitle: order.requesterJobTitle,
    supplierName: order.supplierName,
    supplierRtn: order.supplierRtn,
    supplierPhone: order.supplierPhone,
    purchaseJustification: order.purchaseJustification,
    subtotal: order.subtotal,
    discountType: order.discountType ?? 'NINGUNO',
    discountValue: order.discountValue ?? 0,
    discount: order.discount,
    taxableBase: order.subtotal - order.discount,
    taxRate: order.taxRate,
    tax: order.tax,
    total: order.total,
    items: order.items.map((item) => ({
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    template,
    isDraft: order.status === 'DRAFT' || !order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
  };
}

type NumericValue = number | string | { toString(): string };

type ServerPurchaseOrder = {
  orderNumber?: string | null;
  purchaseReference: string;
  requestDate: Date | string;
  requiredDate: Date | string;
  requestedByName: string;
  requesterJobTitle: string;
  supplierName: string;
  supplierRtn: string;
  supplierPhone: string;
  purchaseJustification: string;
  subtotal: NumericValue;
  discountType: 'NINGUNO' | 'MONTO' | 'PORCENTAJE';
  discountValue: NumericValue;
  discount: NumericValue;
  taxRate: NumericValue;
  tax: NumericValue;
  total: NumericValue;
  status: PurchaseOrderStatus;
  items: Array<{
    itemNumber: number;
    description: string;
    unit: PurchaseUnit;
    quantity: NumericValue;
    unitPrice: NumericValue;
    total: NumericValue;
  }>;
};

function numeric(value: NumericValue): number {
  const parsed = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPreviewDataFromOrder(
  order: ServerPurchaseOrder,
  template: PurchaseOrderTemplateConfig,
  options: { isDraft?: boolean } = {}
): PurchaseOrderPreviewData {
  const subtotal = numeric(order.subtotal);
  const discount = numeric(order.discount);
  const isDraft = options.isDraft ?? order.status === 'DRAFT';

  return {
    orderNumber: order.orderNumber,
    purchaseReference: order.purchaseReference,
    requestDate: order.requestDate instanceof Date ? order.requestDate.toISOString() : order.requestDate,
    requiredDate: order.requiredDate instanceof Date ? order.requiredDate.toISOString() : order.requiredDate,
    requestedByName: order.requestedByName,
    requesterJobTitle: order.requesterJobTitle,
    supplierName: order.supplierName,
    supplierRtn: order.supplierRtn,
    supplierPhone: order.supplierPhone,
    purchaseJustification: order.purchaseJustification,
    subtotal,
    discountType: order.discountType,
    discountValue: numeric(order.discountValue),
    discount,
    taxableBase: subtotal - discount,
    taxRate: numeric(order.taxRate),
    tax: numeric(order.tax),
    total: numeric(order.total),
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    isDraft,
    template,
    items: order.items.map((item) => ({
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: numeric(item.quantity),
      unitPrice: numeric(item.unitPrice),
      total: numeric(item.total),
    })),
  };
}
