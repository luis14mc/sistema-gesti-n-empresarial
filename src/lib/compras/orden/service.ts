import { Prisma, type PurchaseDocumentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { renderHtmlToPdf } from '../pdf-renderer';
import { calculatePurchaseOrder, toDecimal } from './calculos';
import { allocateOrderNumber } from './numbering';
import type { CreatePurchaseOrderInput, DraftPurchaseOrderInput, UpdatePurchaseOrderInput } from './schemas';
import type { PurchaseOrderTemplateConfig } from './template-config';
import { recordOrdenAudit, recordOrdenHistorial } from './historial';
import { buildPurchaseOrderHtml } from './pdf';
import { saveOrdenDocument, saveOrdenPdf } from './documents';
import { serializePurchaseOrder, serializePurchaseOrderListItem } from './serialize';
import {
  ensureDefaultTemplate,
  getActiveTemplate,
  getActiveTemplateConfig,
  resolveTemplateForOrder,
  buildTemplateSnapshot,
} from './template';
import { readStoredDocument, removeStoredDocument } from './document-access';
import {
  buildPreviewDataFromInput,
  previewDataToPdfOrder,
} from './preview-data';
import {
  InvalidPurchaseOrderError,
  validatePurchaseOrderForGeneration,
} from './generation-validation';
import { purchaseOrderChildScope, purchaseOrderScope } from './tenant';

export const orderInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  supplier: { select: { id: true, nombreRazonSocial: true } },
  items: { orderBy: { itemNumber: 'asc' as const } },
  documentos: {
    orderBy: { uploadedAt: 'desc' as const },
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.CompraOrdenInclude;

const listInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  supplier: { select: { id: true, nombreRazonSocial: true } },
  _count: {
    select: {
      documentos: {
        where: { type: { not: 'ORDER_PDF' } },
      },
    },
  },
} satisfies Prisma.CompraOrdenInclude;

async function resolveSupplierSnapshot(input: DraftPurchaseOrderInput, _organizationId: string) {
  if (input.supplierId) {
    const supplier = await prisma.proveedor.findFirst({
      where: { id: input.supplierId, deletedAt: null, activo: true },
    });
    if (supplier) {
      return {
        supplierId: supplier.id,
        supplierName: supplier.nombreRazonSocial,
        supplierRtn: supplier.rtn ?? input.supplierRtn,
        supplierPhone: supplier.telefono ?? input.supplierPhone,
      };
    }
  }
  return {
    supplierId: input.supplierId ?? null,
    supplierName: input.supplierName,
    supplierRtn: input.supplierRtn,
    supplierPhone: input.supplierPhone,
  };
}

function normalizeDraftItems(input: DraftPurchaseOrderInput): CreatePurchaseOrderInput['items'] {
  return (input.items ?? [])
    .filter((item) => item.description?.trim())
    .map((item, index) => ({
      itemNumber: item.itemNumber ?? index + 1,
      description: item.description!.trim(),
      unit: item.unit ?? 'UNIT',
      quantity: Math.max(Number(item.quantity) || 0, 0.01),
      unitPrice: Math.max(Number(item.unitPrice) || 0, 0),
    }));
}

function buildDraftItems(input: DraftPurchaseOrderInput) {
  const items = normalizeDraftItems(input);
  const discountType = input.discountType ?? 'NINGUNO';
  const discountValue = toDecimal(input.discountValue ?? 0);
  const taxRate = toDecimal(input.taxRate ?? 15);

  if (!items.length) {
    return {
      mapped: [],
      subtotal: toDecimal(0),
      discountType,
      discountValue,
      discount: toDecimal(0),
      taxRate,
      tax: toDecimal(0),
      total: toDecimal(0),
    };
  }

  return buildItems({
    purchaseReference: input.purchaseReference ?? '',
    requestDate: input.requestDate ?? new Date().toISOString().slice(0, 10),
    requiredDate: input.requiredDate ?? input.requestDate ?? new Date().toISOString().slice(0, 10),
    requestedByName: input.requestedByName ?? '',
    requesterJobTitle: input.requesterJobTitle ?? '',
    supplierId: input.supplierId ?? null,
    supplierName: input.supplierName ?? '',
    supplierRtn: input.supplierRtn ?? '',
    supplierPhone: input.supplierPhone ?? '',
    purchaseJustification: input.purchaseJustification ?? '',
    discountType,
    discountValue: discountValue.toNumber(),
    taxRate: taxRate.toNumber(),
    items,
  });
}

function resolveDraftDates(input: DraftPurchaseOrderInput) {
  const requestDate = input.requestDate ? new Date(input.requestDate) : new Date();
  const requiredDate = input.requiredDate
    ? new Date(input.requiredDate)
    : requestDate;
  return { requestDate, requiredDate };
}

function buildItems(input: CreatePurchaseOrderInput) {
  const discountType = input.discountType ?? 'NINGUNO';
  const discountValue = toDecimal(input.discountValue ?? 0);
  const taxRate = toDecimal(input.taxRate ?? 15);
  const itemsCalc = input.items.map((i) => ({
    quantity: toDecimal(i.quantity),
    unitPrice: toDecimal(i.unitPrice),
  }));
  if (![0, 15, 18].includes(taxRate.toNumber())) throw new Error('INVALID_ISV_RATE');
  if (discountValue.isNegative()) throw new Error('INVALID_DISCOUNT_VALUE');
  if (discountType === 'PORCENTAJE' && discountValue.greaterThan(100)) {
    throw new Error('INVALID_DISCOUNT_PERCENTAGE');
  }
  const calculation = calculatePurchaseOrder({ items: itemsCalc, discountType, discountValue, taxRate });
  const { lineTotals, subtotal, discount: disc, tax, total } = calculation;
  if (discountType === 'MONTO' && discountValue.greaterThan(subtotal)) {
    throw new Error('DISCOUNT_EXCEEDS_SUBTOTAL');
  }
  const mapped = input.items.map((item, index) => ({
    itemNumber: item.itemNumber ?? index + 1,
    description: item.description,
    unit: item.unit,
    quantity: toDecimal(item.quantity),
    unitPrice: toDecimal(item.unitPrice),
    total: lineTotals[index],
  }));
  return {
    mapped,
    subtotal,
    discountType,
    discountValue,
    discount: disc,
    taxRate,
    tax,
    total,
  };
}

export async function createPurchaseOrder(input: DraftPurchaseOrderInput, userId: string, organizationId: string) {
  await ensureDefaultTemplate(organizationId, userId);
  const supplier = await resolveSupplierSnapshot(input, organizationId);
  const { requestDate, requiredDate } = resolveDraftDates(input);
  const { mapped, subtotal, discountType, discountValue, discount, taxRate, tax, total } =
    buildDraftItems(input);

  return prisma.$transaction(async (tx) => {
    const template = await getActiveTemplate(organizationId, tx);
    if (!template) throw new Error('No hay plantilla activa configurada');
    const { sequenceNumber, sequenceYear, orderNumber } = await allocateOrderNumber(
      tx,
      organizationId,
      template.orderPrefix
    );
    const order = await tx.compraOrden.create({
      data: {
        orderNumber,
        sequenceNumber,
        sequenceYear,
        organizationId,
        purchaseReference: input.purchaseReference ?? '',
        requestDate,
        requiredDate,
        requestedByName: input.requestedByName ?? '',
        requesterJobTitle: input.requesterJobTitle ?? '',
        createdById: userId,
        ...supplier,
        purchaseJustification: input.purchaseJustification ?? '',
        subtotal,
        discountType,
        discountValue,
        discount,
        taxRate,
        tax,
        total,
        items: { create: mapped },
      },
      include: orderInclude,
    });

    await recordOrdenHistorial({
      orderId: order.id,
      organizationId,
      action: 'CREATED',
      title: 'Orden creada',
      description: 'Borrador registrado por área administrativa',
      performedById: userId,
      newData: { id: order.id, orderNumber, status: order.status },
      tx,
    });

    await recordOrdenAudit({
      orderId: order.id,
      organizationId,
      category: 'CREATED',
      title: 'Orden de compra creada',
      description: order.purchaseReference,
      userId,
      newData: { id: order.id, orderNumber, status: order.status },
      tx,
    });

    return serializePurchaseOrder(order);
  });
}

export async function updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput, userId: string, organizationId: string) {
  const existing = await prisma.compraOrden.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!existing) throw new Error('Orden no encontrada');
  if (existing.status !== 'DRAFT') throw new Error('Solo se pueden editar borradores');

  const supplier = await resolveSupplierSnapshot(input, organizationId);
  const { requestDate, requiredDate } = resolveDraftDates(input);
  const { mapped, subtotal, discountType, discountValue, discount, taxRate, tax, total } =
    buildDraftItems(input);

  return prisma.$transaction(async (tx) => {
    await tx.compraOrdenItem.deleteMany({ where: { orderId: id } });
    const order = await tx.compraOrden.update({
      where: { id },
      data: {
        purchaseReference: input.purchaseReference ?? '',
        requestDate,
        requiredDate,
        requestedByName: input.requestedByName ?? '',
        requesterJobTitle: input.requesterJobTitle ?? '',
        ...supplier,
        purchaseJustification: input.purchaseJustification ?? '',
        subtotal,
        discountType,
        discountValue,
        discount,
        taxRate,
        tax,
        total,
        items: { create: mapped },
      },
      include: orderInclude,
    });

    await recordOrdenHistorial({
      orderId: id,
      organizationId,
      action: 'UPDATED',
      title: 'Orden actualizada',
      performedById: userId,
      previousData: existing,
      newData: order,
      tx,
    });

    await recordOrdenAudit({
      orderId: id,
      organizationId,
      category: 'UPDATED',
      title: 'Orden actualizada',
      description: order.purchaseReference,
      userId,
      previousData: existing,
      newData: order,
      tx,
    });

    return serializePurchaseOrder(order);
  });
}

export async function deletePurchaseOrder(id: string, userId: string, organizationId: string) {
  const existing = await prisma.compraOrden.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!existing) throw new Error('ORDER_NOT_FOUND');
  if (existing.status !== 'DRAFT') throw new Error('ONLY_DRAFT_CAN_BE_DELETED');

  await prisma.$transaction(async (tx) => {
    await tx.compraOrden.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await recordOrdenHistorial({
      orderId: id,
      organizationId,
      action: 'STATUS_CHANGED',
      title: 'Borrador eliminado',
      description: existing.orderNumber ?? id,
      performedById: userId,
      previousData: { status: existing.status, orderNumber: existing.orderNumber },
      newData: { deletedAt: new Date().toISOString() },
      tx,
    });

    await recordOrdenAudit({
      orderId: id,
      organizationId,
      category: 'DELETED',
      title: 'Borrador de orden eliminado',
      description: existing.purchaseReference,
      userId,
      previousData: { status: existing.status, orderNumber: existing.orderNumber },
      tx,
    });
  });
}

export async function getPurchaseOrder(id: string, organizationId: string) {
  const order = await prisma.compraOrden.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: orderInclude,
  });
  if (!order) return null;
  return { ...serializePurchaseOrder(order), format: await resolveTemplateForOrder(order) };
}

export async function listPurchaseOrders(params: {
  organizationId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  mine?: boolean;
  userId?: string;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const skip = (page - 1) * pageSize;
  const where: Prisma.CompraOrdenWhereInput = { ...purchaseOrderScope(params.organizationId), deletedAt: null };
  if (params.status) where.status = params.status as Prisma.CompraOrdenWhereInput['status'];
  if (params.mine && params.userId) where.createdById = params.userId;
  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search, mode: 'insensitive' } },
      { purchaseReference: { contains: params.search, mode: 'insensitive' } },
      { supplierName: { contains: params.search, mode: 'insensitive' } },
      { requestedByName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.compraOrden.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: listInclude,
    }),
    prisma.compraOrden.count({ where }),
  ]);

  return {
    ordenes: orders.map(serializePurchaseOrderListItem),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function saveOrderPdf(
  orderId: string,
  userId: string,
  organizationId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  configuredTemplate?: PurchaseOrderTemplateConfig
) {
  const order = await client.compraOrden.findFirst({
    where: { id: orderId, organizationId },
    include: { items: { orderBy: { itemNumber: 'asc' } } },
  });
  if (!order) throw new Error('Orden no encontrada');

  const template = configuredTemplate ?? await resolveTemplateForOrder(order);
  const lastDoc = await client.compraOrdenDocumento.findFirst({
    where: { orderId, type: 'ORDER_PDF', orden: { organizationId } },
    orderBy: { version: 'desc' },
  });
  const version = (lastDoc?.version ?? 0) + 1;
  const html = await buildPurchaseOrderHtml(order, template, version);
  const buffer = await renderHtmlToPdf(html);
  const slug = (order.orderNumber ?? order.id).replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `orden-compra-${slug}-v${version}.pdf`;
  let stored;
  try {
    stored = await saveOrdenPdf(buffer, organizationId, orderId, filename);
  } catch (error) {
    throw new Error('PURCHASE_ORDER_PDF_STORAGE_FAILED', { cause: error });
  }

  try {
    await client.compraOrdenDocumento.updateMany({
      where: { orderId, type: 'ORDER_PDF', isActive: true },
      data: { isActive: false },
    });

    await client.compraOrdenDocumento.create({
      data: {
        orderId,
        type: 'ORDER_PDF',
        name: filename,
        originalName: filename,
        mimeType: 'application/pdf',
        size: stored.size,
        storageKey: stored.storageKey,
        url: stored.url,
        version,
        uploadedById: userId,
      },
    });
  } catch (error) {
    await removeStoredDocument(stored.storageKey).catch((cleanupError) => {
      console.error('[PURCHASE ORDER] Failed to remove stored PDF after DB failure', {
        orderId,
        storageKey: stored.storageKey,
        cleanupError,
      });
    });
    throw error;
  }

  return { version, url: stored.url, storageKey: stored.storageKey };
}

export async function generatePurchaseOrder(
  id: string,
  userId: string,
  organizationId: string,
  onStage?: (stage: string) => void
) {
  onStage?.('LOAD_ORDER');
  console.info('[PURCHASE ORDER] Loading draft', { orderId: id });
  const existing = await prisma.compraOrden.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: { items: true },
  });
  if (!existing) throw new Error('ORDER_NOT_FOUND');
  if (existing.status !== 'DRAFT') throw new Error('ORDER_ALREADY_GENERATED');

  onStage?.('LOAD_TEMPLATE');
  console.info('[PURCHASE ORDER] Loading active format');
  const template = await getActiveTemplate(organizationId);
  if (!template) throw new Error('ACTIVE_PURCHASE_FORMAT_NOT_FOUND');
  const templateSnapshot = buildTemplateSnapshot(template);

  onStage?.('VALIDATE_ORDER');
  console.info('[PURCHASE ORDER] Validating order data');
  if (process.env.NODE_ENV === 'development') {
    console.info('[PURCHASE ORDER VALIDATION DATA]', {
      orderId: existing.id,
      numero: existing.orderNumber,
      fecha: existing.requestDate,
      fechaRequerida: existing.requiredDate,
      solicitadoPor: existing.requestedByName,
      cargoSolicitante: existing.requesterJobTitle,
      proveedorNombre: existing.supplierName,
      proveedorRtn: existing.supplierRtn,
      proveedorTelefono: existing.supplierPhone,
      justificacionLength: existing.purchaseJustification?.length ?? 0,
      items: existing.items.map((item) => ({
        descripcion: item.description,
        unidad: item.unit,
        cantidad: item.quantity?.toString(),
        precioUnitario: item.unitPrice?.toString(),
      })),
    });
  }
  const validationErrors = validatePurchaseOrderForGeneration(existing);
  if (validationErrors.length > 0) {
    console.warn('[PURCHASE ORDER INVALID]', { orderId: id, validationErrors });
    throw new InvalidPurchaseOrderError(validationErrors);
  }
  const orderNumber = existing.orderNumber!;
  const generationCalculation = calculatePurchaseOrder({
    items: existing.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    discountType: existing.discountType,
    discountValue: existing.discountValue,
    taxRate: existing.taxRate,
  });
  if (generationCalculation.total.isNegative()) throw new Error('INVALID_ORDER_TOTAL');
  const recalculatedOrder = {
    ...existing,
    subtotal: generationCalculation.subtotal,
    discount: generationCalculation.discount,
    tax: generationCalculation.tax,
    total: generationCalculation.total,
    items: existing.items.map((item, index) => ({
      ...item,
      total: generationCalculation.lineTotals[index],
    })),
  };

  console.info('[PURCHASE ORDER] Using order number', {
    orderNumber,
  });
  const lastDoc = await prisma.compraOrdenDocumento.findFirst({
    where: { orderId: id, type: 'ORDER_PDF', orden: { organizationId } },
    orderBy: { version: 'desc' },
  });
  const version = (lastDoc?.version ?? 0) + 1;

  onStage?.('GENERATE_PDF');
  console.info('[PURCHASE ORDER] Rendering HTML');
  const html = await buildPurchaseOrderHtml(recalculatedOrder, templateSnapshot, version);
  const buffer = await renderHtmlToPdf(html);
  if (!buffer.length) throw new Error('EMPTY_PURCHASE_ORDER_PDF');

  const slug = orderNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `orden-compra-${slug}-v${version}.pdf`;

  let generatedStorageKey: string | null = null;
  try {
    onStage?.('SAVE_PDF');
    console.info('[PURCHASE ORDER] Saving PDF');
    let stored;
    try {
      stored = await saveOrdenPdf(buffer, organizationId, id, filename);
    } catch (error) {
      throw new Error('PURCHASE_ORDER_PDF_STORAGE_FAILED', { cause: error });
    }
    generatedStorageKey = stored.storageKey;

    onStage?.('PERSIST_ORDER');
    console.info('[PURCHASE ORDER] Updating status');
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.compraOrden.updateMany({
        where: { id, organizationId, status: 'DRAFT', orderNumber },
        data: {
          status: 'GENERATED',
          generatedById: userId,
          generatedAt: new Date(),
          templateId: template.id,
          templateVersion: template.version,
          templateSnapshot: templateSnapshot as Prisma.InputJsonValue,
          subtotal: generationCalculation.subtotal,
          discount: generationCalculation.discount,
          tax: generationCalculation.tax,
          total: generationCalculation.total,
        },
      });
      if (claimed.count !== 1) throw new Error('ORDER_ALREADY_GENERATED');

      await Promise.all(existing.items.map((item, index) =>
        tx.compraOrdenItem.update({
          where: { id: item.id },
          data: { total: generationCalculation.lineTotals[index] },
        })
      ));

      await tx.compraOrdenDocumento.updateMany({
        where: { orderId: id, type: 'ORDER_PDF', isActive: true },
        data: { isActive: false },
      });
      await tx.compraOrdenDocumento.create({
        data: {
          orderId: id,
          type: 'ORDER_PDF',
          name: filename,
          originalName: filename,
          mimeType: 'application/pdf',
          size: stored.size,
          storageKey: stored.storageKey,
          url: stored.url,
          version,
          uploadedById: userId,
        },
      });

      await recordOrdenHistorial({
        orderId: id,
        organizationId,
        action: 'GENERATED',
        title: 'Orden generada',
        description: `Orden validada con número ${orderNumber}`,
        performedById: userId,
        previousData: { status: 'DRAFT' },
        newData: { status: 'GENERATED', orderNumber },
        tx,
      });
      await recordOrdenHistorial({
        orderId: id,
        organizationId,
        action: 'PDF_GENERATED',
        title: 'PDF generado',
        performedById: userId,
        tx,
      });
      await recordOrdenAudit({
        orderId: id,
        organizationId,
        category: 'GENERATED',
        title: 'Orden generada',
        description: orderNumber,
        userId,
        newData: { orderNumber, status: 'GENERATED' },
        tx,
      });
    });
  } catch (error) {
    if (generatedStorageKey) {
      await removeStoredDocument(generatedStorageKey).catch((cleanupError) => {
        console.error('[PURCHASE ORDER] Failed to remove stored PDF after rollback', cleanupError);
      });
    }
    throw error;
  }

  return getPurchaseOrder(id, organizationId);
}

export async function issuePurchaseOrder(id: string, userId: string, organizationId: string) {
  const order = await prisma.compraOrden.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!order) throw new Error('Orden no encontrada');
  if (order.status !== 'GENERATED') throw new Error('Solo órdenes generadas pueden emitirse');

  const activePdf = await prisma.compraOrdenDocumento.findFirst({
    where: { orderId: id, type: 'ORDER_PDF', isActive: true, orden: { organizationId } },
  });
  if (!activePdf) throw new Error('Debe existir PDF activo');

  await prisma.$transaction(async (tx) => {
    await tx.compraOrden.update({
      where: { id },
      data: { status: 'ISSUED', issuedById: userId, issuedAt: new Date() },
    });
    await recordOrdenHistorial({
      orderId: id,
      organizationId,
      action: 'ISSUED',
      title: 'Orden emitida',
      performedById: userId,
      previousData: { status: 'GENERATED' },
      newData: { status: 'ISSUED' },
      tx,
    });
    await recordOrdenAudit({
      orderId: id,
      organizationId,
      category: 'ISSUED',
      title: 'Orden emitida',
      description: order.orderNumber ?? id,
      userId,
      tx,
    });
  });

  return getPurchaseOrder(id, organizationId);
}

export async function cancelPurchaseOrder(id: string, userId: string, cancellationReason: string, organizationId: string) {
  const order = await prisma.compraOrden.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!order) throw new Error('Orden no encontrada');
  if (order.status === 'CLOSED') throw new Error('No se puede anular una orden cerrada');
  if (!['DRAFT', 'GENERATED', 'ISSUED'].includes(order.status)) {
    throw new Error('Estado no permite anulación');
  }

  await prisma.$transaction(async (tx) => {
    await tx.compraOrden.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledById: userId,
        cancelledAt: new Date(),
        cancellationReason,
      },
    });
    await recordOrdenHistorial({
      orderId: id,
      organizationId,
      action: 'CANCELLED',
      title: 'Orden anulada',
      description: cancellationReason,
      performedById: userId,
      previousData: { status: order.status },
      newData: { status: 'CANCELLED', cancellationReason },
      tx,
    });
    await recordOrdenAudit({
      orderId: id,
      organizationId,
      category: 'CANCELLED',
      title: 'Orden anulada',
      description: cancellationReason,
      userId,
      tx,
    });
  });

  return getPurchaseOrder(id, organizationId);
}

export async function closePurchaseOrder(id: string, userId: string, organizationId: string) {
  const order = await prisma.compraOrden.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!order) throw new Error('Orden no encontrada');
  if (order.status !== 'ISSUED') throw new Error('Solo órdenes emitidas pueden cerrarse');

  await prisma.$transaction(async (tx) => {
    await tx.compraOrden.update({
      where: { id },
      data: { status: 'CLOSED', closedById: userId, closedAt: new Date() },
    });
    await recordOrdenHistorial({
      orderId: id,
      organizationId,
      action: 'CLOSED',
      title: 'Orden cerrada',
      performedById: userId,
      previousData: { status: 'ISSUED' },
      newData: { status: 'CLOSED' },
      tx,
    });
    await recordOrdenAudit({
      orderId: id,
      organizationId,
      category: 'CLOSED',
      title: 'Orden cerrada',
      description: order.orderNumber ?? id,
      userId,
      tx,
    });
  });

  return getPurchaseOrder(id, organizationId);
}

export async function regeneratePurchaseOrderPdf(id: string, userId: string, organizationId: string) {
  const order = await prisma.compraOrden.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!order) throw new Error('Orden no encontrada');
  if (!['GENERATED', 'ISSUED', 'CLOSED'].includes(order.status)) {
    throw new Error('Estado no permite regenerar PDF');
  }

  await saveOrderPdf(id, userId, organizationId);

  await prisma.$transaction(async (tx) => {
    await recordOrdenHistorial({
      orderId: id,
      organizationId,
      action: 'PDF_REGENERATED',
      title: 'PDF regenerado',
      performedById: userId,
      tx,
    });

    await recordOrdenAudit({
      orderId: id,
      organizationId,
      category: 'PDF_REGENERATED',
      title: 'PDF regenerado',
      description: order.orderNumber ?? id,
      userId,
      tx,
    });
  });

  return getPurchaseOrder(id, organizationId);
}

export async function uploadPurchaseOrderDocument(
  orderId: string,
  file: File,
  type: PurchaseDocumentType,
  userId: string,
  organizationId: string
) {
  const order = await prisma.compraOrden.findFirst({ where: { id: orderId, organizationId, deletedAt: null } });
  if (!order) throw new Error('Orden no encontrada');

  const stored = await saveOrdenDocument(file, organizationId, orderId);
  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.compraOrdenDocumento.create({
      data: {
        orderId,
        type,
        name: stored.nombre,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.storageKey,
        url: stored.url,
        fileHash: stored.fileHash,
        uploadedById: userId,
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    await recordOrdenHistorial({
      orderId,
      organizationId,
      action: 'DOCUMENT_ADDED',
      title: 'Documento adjuntado',
      description: stored.nombre,
      performedById: userId,
      newData: { type, name: stored.nombre },
      tx,
    });

    await recordOrdenAudit({
      orderId,
      organizationId,
      category: 'DOCUMENT_ADDED',
      title: 'Documento adjuntado',
      description: stored.nombre,
      userId,
      newData: created,
      tx,
    });

    return created;
  });

  return doc;
}

export async function deletePurchaseOrderDocument(
  orderId: string,
  documentId: string,
  userId: string,
  organizationId: string
) {
  const doc = await prisma.compraOrdenDocumento.findFirst({
    where: { id: documentId, orderId, orden: { organizationId } },
  });
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.type === 'ORDER_PDF') throw new Error('No se puede eliminar el PDF de la orden');

  await prisma.$transaction(async (tx) => {
    await tx.compraOrdenDocumento.delete({ where: { id: documentId } });

    await recordOrdenHistorial({
      orderId,
      organizationId,
      action: 'DOCUMENT_REMOVED',
      title: 'Documento eliminado',
      description: doc.name,
      performedById: userId,
      previousData: doc,
      tx,
    });

    await recordOrdenAudit({
      orderId,
      organizationId,
      category: 'DOCUMENT_REMOVED',
      title: 'Documento eliminado',
      description: doc.name,
      userId,
      previousData: doc,
      tx,
    });
  });

  await removeStoredDocument(doc.storageKey).catch((error) => {
    console.error('[PURCHASE ORDER] Failed to remove stored document after DB delete', {
      documentId,
      storageKey: doc.storageKey,
      error,
    });
  });
}

export async function getPurchaseOrderHistory(orderId: string, organizationId: string) {
  return prisma.compraOrdenHistorial.findMany({
    where: { orderId, ...purchaseOrderChildScope(organizationId) },
    orderBy: { createdAt: 'desc' },
    include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getPurchaseOrderDocuments(orderId: string, organizationId: string) {
  const docs = await prisma.compraOrdenDocumento.findMany({
    where: { orderId, ...purchaseOrderChildScope(organizationId), type: { not: 'ORDER_PDF' } },
    orderBy: { uploadedAt: 'desc' },
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return docs.map((doc) => ({
    id: doc.id,
    originalName: doc.originalName,
    type: doc.type,
    mimeType: doc.mimeType,
    size: doc.size,
    uploadedAt: doc.uploadedAt.toISOString(),
    uploadedBy: doc.uploadedBy,
  }));
}

export async function readPurchaseOrderDocumentFile(orderId: string, documentId: string, organizationId: string) {
  const doc = await prisma.compraOrdenDocumento.findFirst({
    where: { id: documentId, orderId, ...purchaseOrderChildScope(organizationId) },
  });
  if (!doc) throw new Error('Documento no encontrado');
  const file = await readStoredDocument(doc.storageKey, doc.mimeType);
  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: file.mimeType,
    size: file.size,
    buffer: file.buffer,
  };
}


export async function getPurchaseOrderHtmlPreview(orderId: string, organizationId: string): Promise<string> {
  const order = await prisma.compraOrden.findFirst({
    where: { id: orderId, organizationId, deletedAt: null },
    include: { items: { orderBy: { itemNumber: 'asc' } } },
  });
  if (!order) throw new Error('Orden no encontrada');
  const template = await resolveTemplateForOrder(order);
  const activePdf = await prisma.compraOrdenDocumento.findFirst({
    where: { orderId, type: 'ORDER_PDF', isActive: true, orden: { organizationId } },
  });
  return buildPurchaseOrderHtml(order, template, activePdf?.version ?? 1);
}

export async function getPurchaseOrderDraftPreviewHtml(
  input: CreatePurchaseOrderInput,
  organizationId: string
): Promise<string> {
  const template = await getActiveTemplateConfig(organizationId);
  const preview = buildPreviewDataFromInput(input, template);
  return buildPurchaseOrderHtml(previewDataToPdfOrder(preview), template, 1);
}

export async function buildPurchaseOrderPreviewHtml(
  input: CreatePurchaseOrderInput,
  organizationId: string
): Promise<string> {
  return getPurchaseOrderDraftPreviewHtml(input, organizationId);
}

// Legacy aliases
export const deleteCompraOrden = deletePurchaseOrder;
export const createCompraOrden = createPurchaseOrder;
export const updateCompraOrden = updatePurchaseOrder;
export const getCompraOrden = getPurchaseOrder;
export const listCompraOrdenes = listPurchaseOrders;
export const generarCompraOrden = generatePurchaseOrder;
export const emitirCompraOrden = issuePurchaseOrder;
export const anularCompraOrden = cancelPurchaseOrder;
export const cerrarCompraOrden = closePurchaseOrder;
export const regenerarPdfCompraOrden = regeneratePurchaseOrderPdf;
export const uploadCompraOrdenDocumento = uploadPurchaseOrderDocument;
export const getCompraOrdenHistorial = getPurchaseOrderHistory;
export const getCompraOrdenHtmlPreview = getPurchaseOrderHtmlPreview;
