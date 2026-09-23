import type { PurchaseOrderStatus, PurchaseUnit } from '@prisma/client';
import type { CreatePurchaseOrderInput } from './schemas';
import { calculatePurchaseOrder, formatItemTaxLabel, toDecimal, type PurchaseTaxProfileId } from './calculos';
import type { PurchaseOrderTemplateConfig } from './template-config';
import { ORDER_STATUS_LABELS } from './constants';

export type PurchaseOrderTaxPreview = {
  code: string;
  name: string;
  rate: number;
  taxableBase: number;
  amount: number;
};

export type PurchaseOrderItemPreview = {
  itemNumber: number;
  description: string;
  unit: PurchaseUnit;
  quantity: number;
  unitPrice: number;
  total: number;
  taxableBase: number;
  taxAmount: number;
  itemTotal: number;
  taxLabel: string;
  taxProfile?: PurchaseTaxProfileId | null;
  taxes: PurchaseOrderTaxPreview[];
};

export type PurchaseOrderPersonName = {
  firstName: string;
  lastName: string;
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
  taxSummary: PurchaseOrderTaxPreview[];
  exemptBase: number;
  usesItemTaxes: boolean;
  items: PurchaseOrderItemPreview[];
  template: PurchaseOrderTemplateConfig;
  isDraft: boolean;
  status?: PurchaseOrderStatus;
  statusLabel: string;
  generatedByName?: string | null;
  generatedAt?: string | null;
  issuedByName?: string | null;
  issuedAt?: string | null;
};

export function formatPersonName(person?: PurchaseOrderPersonName | null): string | null {
  if (!person) return null;
  const name = `${person.firstName} ${person.lastName}`.replace(/\s+/g, ' ').trim();
  return name.length > 0 ? name : null;
}

function isoDate(value?: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return value;
}

export function formatSignatureAttribution(
  label: 'Generado por' | 'Aprobado por',
  name?: string | null,
  at?: string | Date | null,
): string {
  if (!name) return `${label}: Pendiente`;
  const parsed = at ? new Date(at) : null;
  const dateLabel = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString('es-HN')
    : null;
  return dateLabel ? `${label}: ${name} · ${dateLabel}` : `${label}: ${name}`;
}

type PurchaseOrderPreviewInput = Partial<Omit<CreatePurchaseOrderInput, 'items' | 'supplierId' | 'requesterEmployeeId'>> & {
  supplierId?: string | null;
  requesterEmployeeId?: string | null;
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
      taxProfile: item?.taxProfile,
      customTaxes: item?.taxProfile === 'CUSTOM' ? item.customTaxes : [],
    };
  });
  const calculation = calculatePurchaseOrder({
    items: items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxProfile: item.taxProfile,
      customTaxes: item.customTaxes,
    })),
    discountType,
    discountValue,
    taxRate,
  });
  const { subtotal, discount: disc, taxableBase, tax, total, taxSummary, exemptBase } = calculation;

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
    taxRate: calculation.taxRate.toNumber(),
    tax: tax.toNumber(),
    total: total.toNumber(),
    taxSummary: taxSummary.map((line) => ({
      code: line.code,
      name: line.name,
      rate: line.rate.toNumber(),
      taxableBase: line.taxableBase.toNumber(),
      amount: line.amount.toNumber(),
    })),
    exemptBase: exemptBase.toNumber(),
    usesItemTaxes: true,
    items: items.map((item, index) => {
      const calculated = calculation.items[index];
      return {
        itemNumber: item.itemNumber,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        total: calculated.lineSubtotal.toNumber(),
        taxableBase: calculated.taxableBase.toNumber(),
        taxAmount: calculated.taxAmount.toNumber(),
        itemTotal: calculated.itemTotal.toNumber(),
        taxLabel: calculated.taxLabel,
        taxProfile: calculated.taxProfile,
        taxes: calculated.taxes.map((taxLine) => ({
          code: taxLine.code,
          name: taxLine.name,
          rate: taxLine.rate.toNumber(),
          taxableBase: taxLine.taxableBase.toNumber(),
          amount: taxLine.amount.toNumber(),
        })),
      };
    }),
    template,
    isDraft: true,
    status: 'DRAFT',
    statusLabel: ORDER_STATUS_LABELS.DRAFT,
    generatedByName: null,
    generatedAt: null,
    issuedByName: null,
    issuedAt: null,
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
    generatedByName: preview.generatedByName ?? null,
    generatedAt: preview.generatedAt ?? null,
    issuedByName: preview.issuedByName ?? null,
    issuedAt: preview.issuedAt ?? null,
    items: preview.items.map((item) => ({
      id: `preview-${item.itemNumber}`,
      orderId: 'preview',
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: toDecimal(item.quantity),
      unitPrice: toDecimal(item.unitPrice),
      total: toDecimal(item.total),
      taxProfile: item.taxProfile ?? null,
      taxableBase: toDecimal(item.taxableBase),
      taxAmount: toDecimal(item.taxAmount),
      itemTotal: toDecimal(item.itemTotal),
      taxLabel: item.taxLabel,
      taxes: item.taxes.map((taxLine) => ({
        ...taxLine,
        rate: toDecimal(taxLine.rate),
        taxableBase: toDecimal(taxLine.taxableBase),
        amount: toDecimal(taxLine.amount),
      })),
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
    generatedByName?: string | null;
    generatedAt?: string | null;
    issuedByName?: string | null;
    issuedAt?: string | null;
    generatedBy?: PurchaseOrderPersonName | null;
    issuedBy?: PurchaseOrderPersonName | null;
    taxSummary?: PurchaseOrderTaxPreview[];
    exemptBase?: number;
    items: Array<{
      itemNumber: number;
      description: string;
      unit: PurchaseUnit;
      quantity: number;
      unitPrice: number;
      total: number;
      taxProfile?: PurchaseTaxProfileId | null;
      taxableBase?: number;
      taxAmount?: number;
      itemTotal?: number;
      taxLabel?: string | null;
      taxes?: PurchaseOrderTaxPreview[];
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
    taxRate: order.taxRate,
    tax: order.tax,
    total: order.total,
    ...taxPreviewFromSerialized(order),
    items: order.items.map((item) => itemPreviewFromStored(item, order.taxRate)),
    template,
    isDraft: order.status === 'DRAFT' || !order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    generatedByName: order.generatedByName ?? formatPersonName(order.generatedBy),
    generatedAt: order.generatedAt ?? null,
    issuedByName: order.issuedByName ?? formatPersonName(order.issuedBy),
    issuedAt: order.issuedAt ?? null,
  };
}

function itemPreviewFromStored(
  item: {
    itemNumber: number;
    description: string;
    unit: PurchaseUnit;
    quantity: number;
    unitPrice: number;
    total: number;
    taxProfile?: PurchaseTaxProfileId | null;
    taxableBase?: number;
    taxAmount?: number;
    itemTotal?: number;
    taxLabel?: string | null;
    taxes?: PurchaseOrderTaxPreview[];
  },
  legacyTaxRate: number,
): PurchaseOrderItemPreview {
  const taxes = item.taxes ?? [];
  const usesItemTaxes = Boolean(item.taxProfile) || taxes.length > 0;
  return {
    itemNumber: item.itemNumber,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    taxableBase: usesItemTaxes ? (item.taxableBase ?? item.total) : item.total,
    taxAmount: usesItemTaxes ? (item.taxAmount ?? 0) : 0,
    itemTotal: usesItemTaxes ? (item.itemTotal ?? item.total) : item.total,
    taxLabel: item.taxLabel ?? (usesItemTaxes ? formatItemTaxLabel(taxes) : `ISV ${legacyTaxRate}%`),
    taxProfile: item.taxProfile ?? null,
    taxes,
  };
}

function taxPreviewFromSerialized(order: {
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  taxSummary?: PurchaseOrderTaxPreview[];
  exemptBase?: number;
  items: Array<{ taxProfile?: PurchaseTaxProfileId | null; taxes?: PurchaseOrderTaxPreview[]; taxableBase?: number }>;
}): Pick<PurchaseOrderPreviewData, 'taxSummary' | 'exemptBase' | 'usesItemTaxes' | 'taxableBase'> {
  const usesItemTaxes = order.items.some((item) => item.taxProfile || (item.taxes?.length ?? 0) > 0);
  if (!usesItemTaxes) {
    const taxableBase = Math.max(0, order.subtotal - order.discount);
    const summary = order.tax > 0
      ? [{
        code: order.taxRate === 18 ? 'ISV_18' : order.taxRate === 0 ? 'EXEMPT' : 'ISV_15',
        name: order.taxRate === 0 ? 'Exento' : `ISV ${order.taxRate}%`,
        rate: order.taxRate,
        taxableBase,
        amount: order.tax,
      }]
      : [];
    return {
      usesItemTaxes: false,
      taxableBase,
      exemptBase: order.taxRate === 0 ? taxableBase : 0,
      taxSummary: summary,
    };
  }
  return {
    usesItemTaxes: true,
    taxableBase: order.subtotal - order.discount,
    exemptBase: order.exemptBase ?? order.items
      .filter((item) => item.taxProfile === 'EXEMPT' || (item.taxProfile && (item.taxes?.length ?? 0) === 0))
      .reduce((sum, item) => sum + (item.taxableBase ?? 0), 0),
    taxSummary: order.taxSummary ?? [],
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
  generatedBy?: PurchaseOrderPersonName | null;
  generatedAt?: Date | string | null;
  issuedBy?: PurchaseOrderPersonName | null;
  issuedAt?: Date | string | null;
  generatedByName?: string | null;
  issuedByName?: string | null;
  taxSummary?: PurchaseOrderTaxPreview[];
  exemptBase?: number;
  items: Array<{
    itemNumber: number;
    description: string;
    unit: PurchaseUnit;
    quantity: NumericValue;
    unitPrice: NumericValue;
    total: NumericValue;
    taxProfile?: PurchaseTaxProfileId | null;
    taxableBase?: NumericValue;
    taxAmount?: NumericValue;
    itemTotal?: NumericValue;
    taxLabel?: string | null;
    taxes?: Array<{
      code: string;
      name: string;
      rate: NumericValue;
      taxableBase: NumericValue;
      amount: NumericValue;
    }>;
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
  const items = order.items.map((item) => itemPreviewFromStored({
    itemNumber: item.itemNumber,
    description: item.description,
    unit: item.unit,
    quantity: numeric(item.quantity),
    unitPrice: numeric(item.unitPrice),
    total: numeric(item.total),
    taxProfile: item.taxProfile,
    taxableBase: item.taxableBase === undefined ? undefined : numeric(item.taxableBase),
    taxAmount: item.taxAmount === undefined ? undefined : numeric(item.taxAmount),
    itemTotal: item.itemTotal === undefined ? undefined : numeric(item.itemTotal),
    taxLabel: item.taxLabel,
    taxes: item.taxes?.map((taxLine) => ({
      code: taxLine.code,
      name: taxLine.name,
      rate: numeric(taxLine.rate),
      taxableBase: numeric(taxLine.taxableBase),
      amount: numeric(taxLine.amount),
    })),
  }, numeric(order.taxRate)));
  const taxPreview = taxPreviewFromSerialized({
    subtotal,
    discount,
    taxRate: numeric(order.taxRate),
    tax: numeric(order.tax),
    taxSummary: order.taxSummary,
    exemptBase: order.exemptBase,
    items,
  });

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
    taxRate: numeric(order.taxRate),
    tax: numeric(order.tax),
    total: numeric(order.total),
    ...taxPreview,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    isDraft,
    template,
    generatedByName: order.generatedByName ?? formatPersonName(order.generatedBy),
    generatedAt: isoDate(order.generatedAt),
    issuedByName: order.issuedByName ?? formatPersonName(order.issuedBy),
    issuedAt: isoDate(order.issuedAt),
    items,
  };
}
