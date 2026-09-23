import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  renderHtmlToPdf,
  saveOrdenPdf,
  removeStoredDocument,
  recordOrdenHistorial,
  recordOrdenAudit,
  findOrder,
  findDocument,
  findUser,
  transaction,
  updateOrderMany,
  updateDocumentMany,
  createDocument,
} = vi.hoisted(() => ({
  renderHtmlToPdf: vi.fn(),
  saveOrdenPdf: vi.fn(),
  removeStoredDocument: vi.fn(),
  recordOrdenHistorial: vi.fn(),
  recordOrdenAudit: vi.fn(),
  findOrder: vi.fn(),
  findDocument: vi.fn(),
  findUser: vi.fn(),
  transaction: vi.fn(),
  updateOrderMany: vi.fn(),
  updateDocumentMany: vi.fn(),
  createDocument: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    compraOrden: { findFirst: findOrder },
    compraOrdenDocumento: { findFirst: findDocument },
    user: { findUnique: findUser },
    $transaction: transaction,
  },
}));

vi.mock('@/lib/compras/pdf-renderer', () => ({ renderHtmlToPdf }));
vi.mock('@/lib/compras/orden/documents', () => ({
  saveOrdenPdf,
  saveOrdenDocument: vi.fn(),
}));
vi.mock('@/lib/compras/orden/document-access', () => ({
  removeStoredDocument,
  readStoredDocument: vi.fn(),
}));
vi.mock('@/lib/compras/orden/historial', () => ({
  recordOrdenHistorial,
  recordOrdenAudit,
}));

import { issuePurchaseOrder } from '@/lib/compras/orden/service';

const generatedAt = new Date('2026-09-09T18:00:00.000Z');
const issuedAt = new Date('2026-09-10T15:30:00.000Z');
const amount = new Prisma.Decimal(100);

function generatedOrder() {
  return {
    id: 'order-1',
    organizationId: 'org-1',
    deletedAt: null,
    status: 'GENERATED',
    orderNumber: 'COM-CNI-2026-00001',
    sequenceNumber: 1,
    sequenceYear: 2026,
    purchaseReference: 'REF-1',
    requestDate: new Date('2026-09-01T00:00:00.000Z'),
    requiredDate: new Date('2026-09-10T00:00:00.000Z'),
    requestedByName: 'Solicitante',
    requesterJobTitle: 'Analista',
    requesterEmployeeId: null,
    createdById: 'user-gen',
    supplierId: 'sup-1',
    supplierName: 'Proveedor',
    supplierRtn: '08011999123456',
    supplierPhone: '2222-0000',
    purchaseJustification: 'Compra de papelería',
    subtotal: amount,
    discountType: 'NINGUNO' as const,
    discountValue: new Prisma.Decimal(0),
    discount: new Prisma.Decimal(0),
    taxRate: new Prisma.Decimal(15),
    tax: new Prisma.Decimal(15),
    total: new Prisma.Decimal(115),
    templateId: 'tpl-1',
    templateVersion: 1,
    templateSnapshot: {
      institutionName: 'Consejo Nacional de Inversiones',
      documentTitle: 'SOLICITUD Y ORDEN DE COMPRA',
      signatureTitle: 'Jefe de Presupuesto',
    },
    generatedById: 'user-gen',
    generatedAt,
    generatedBy: { firstName: 'Yenfri Lemarie', lastName: 'Garcia' },
    issuedById: null,
    issuedAt: null,
    issuedBy: null,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    createdBy: { id: 'user-gen', firstName: 'Yenfri Lemarie', lastName: 'Garcia' },
    supplier: { id: 'sup-1', nombreRazonSocial: 'Proveedor' },
    requesterEmployee: null,
    items: [{
      id: 'item-1',
      orderId: 'order-1',
      itemNumber: 1,
      description: 'Resmas',
      unit: 'UNIT',
      quantity: amount,
      unitPrice: amount,
      total: amount,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    }],
    documentos: [],
  };
}

const activePdf = {
  id: 'pdf-1',
  orderId: 'order-1',
  type: 'ORDER_PDF',
  isActive: true,
  version: 1,
  url: 'https://files.test/v1.pdf',
  storageKey: 'org/pdf-v1',
};

function issuedOrder() {
  const issuer = { id: 'user-issue', firstName: 'Lila Margarita', lastName: 'Rivera' };
  const issuedPdf = {
    id: 'pdf-2',
    orderId: 'order-1',
    type: 'ORDER_PDF',
    name: 'orden-compra-COM-CNI-2026-00001-v2.pdf',
    originalName: 'orden-compra-COM-CNI-2026-00001-v2.pdf',
    mimeType: 'application/pdf',
    size: 12,
    storageKey: 'org/pdf-v2',
    url: 'https://files.test/v2.pdf',
    version: 2,
    isActive: true,
    uploadedAt: issuedAt,
    uploadedBy: issuer,
  };
  return {
    ...generatedOrder(),
    status: 'ISSUED',
    issuedById: issuer.id,
    issuedAt,
    issuedBy: issuer,
    documentos: [issuedPdf],
  };
}

describe('issuePurchaseOrder PDF consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt);
    renderHtmlToPdf.mockResolvedValue(Buffer.from('%PDF-issued'));
    saveOrdenPdf.mockResolvedValue({
      storageKey: 'org/pdf-v2',
      url: 'https://files.test/v2.pdf',
      size: 12,
    });
    removeStoredDocument.mockResolvedValue(undefined);
    recordOrdenHistorial.mockResolvedValue({});
    recordOrdenAudit.mockResolvedValue({});
    updateOrderMany.mockResolvedValue({ count: 1 });
    updateDocumentMany.mockResolvedValue({ count: 1 });
    createDocument.mockResolvedValue({ id: 'pdf-2' });
    findUser.mockResolvedValue({ firstName: 'Lila Margarita', lastName: 'Rivera' });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      compraOrden: { updateMany: updateOrderMany },
      compraOrdenDocumento: { updateMany: updateDocumentMany, create: createDocument },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues only after the approved PDF is stored and persisted', async () => {
    findOrder
      .mockResolvedValueOnce(generatedOrder())
      .mockResolvedValueOnce(issuedOrder());
    findDocument
      .mockResolvedValueOnce(activePdf)
      .mockResolvedValueOnce(activePdf);

    const result = await issuePurchaseOrder('order-1', 'user-issue', 'org-1');

    expect(result?.status).toBe('ISSUED');
    expect(result?.issuedById).toBe('user-issue');
    expect(result?.issuedAt).toBe(issuedAt.toISOString());
    expect(result?.pdfVersion).toBe(2);
    expect(result?.pdfUrl).toBe('https://files.test/v2.pdf');

    expect(saveOrdenPdf).toHaveBeenCalled();
    expect(updateOrderMany).toHaveBeenCalledWith({
      where: { id: 'order-1', organizationId: 'org-1', status: 'GENERATED' },
      data: { status: 'ISSUED', issuedById: 'user-issue', issuedAt },
    });
    expect(updateDocumentMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', type: 'ORDER_PDF', isActive: true },
      data: { isActive: false },
    });
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'ORDER_PDF',
        version: 2,
        storageKey: 'org/pdf-v2',
        uploadedById: 'user-issue',
      }),
    }));
    expect(updateOrderMany.mock.invocationCallOrder[0]).toBeLessThan(updateDocumentMany.mock.invocationCallOrder[0]);
    expect(updateDocumentMany.mock.invocationCallOrder[0]).toBeLessThan(createDocument.mock.invocationCallOrder[0]);
    expect(saveOrdenPdf.mock.invocationCallOrder[0]).toBeLessThan(updateOrderMany.mock.invocationCallOrder[0]);
    expect(removeStoredDocument).not.toHaveBeenCalled();

    const html = renderHtmlToPdf.mock.calls[0]?.[0] as string;
    expect(html).toMatch(/Generado por: Yenfri Lemarie Garcia · /);
    expect(html).toMatch(/Aprobado por: Lila Margarita Rivera · /);
    expect(html).not.toContain('Aprobado por: Pendiente');
  });

  it('does not leave the order ISSUED when PDF storage fails', async () => {
    findOrder.mockResolvedValueOnce(generatedOrder());
    findDocument
      .mockResolvedValueOnce(activePdf)
      .mockResolvedValueOnce(activePdf);
    saveOrdenPdf.mockRejectedValueOnce(new Error('S3 down'));

    await expect(issuePurchaseOrder('order-1', 'user-issue', 'org-1')).rejects.toMatchObject({
      message: 'PURCHASE_ORDER_PDF_STORAGE_FAILED',
    });

    expect(updateOrderMany).not.toHaveBeenCalled();
    expect(updateDocumentMany).not.toHaveBeenCalled();
    expect(createDocument).not.toHaveBeenCalled();
    expect(removeStoredDocument).not.toHaveBeenCalled();
  });

  it('does not deactivate the generated PDF if the new PDF is not persisted', async () => {
    findOrder.mockResolvedValueOnce(generatedOrder());
    findDocument
      .mockResolvedValueOnce(activePdf)
      .mockResolvedValueOnce(activePdf);
    renderHtmlToPdf.mockRejectedValueOnce(new Error('PURCHASE_ORDER_RENDER_FAILED'));

    await expect(issuePurchaseOrder('order-1', 'user-issue', 'org-1')).rejects.toThrow(
      'PURCHASE_ORDER_RENDER_FAILED',
    );

    expect(saveOrdenPdf).not.toHaveBeenCalled();
    expect(updateOrderMany).not.toHaveBeenCalled();
    expect(updateDocumentMany).not.toHaveBeenCalled();
  });

  it('rolls back the uploaded PDF and does not keep ISSUED when the DB commit fails', async () => {
    findOrder.mockResolvedValueOnce(generatedOrder());
    findDocument
      .mockResolvedValueOnce(activePdf)
      .mockResolvedValueOnce(activePdf);
    transaction.mockRejectedValueOnce(new Error('DB_COMMIT_FAILED'));

    await expect(issuePurchaseOrder('order-1', 'user-issue', 'org-1')).rejects.toThrow('DB_COMMIT_FAILED');

    expect(saveOrdenPdf).toHaveBeenCalled();
    expect(removeStoredDocument).toHaveBeenCalledWith('org/pdf-v2');
    expect(updateOrderMany).not.toHaveBeenCalled();
    expect(updateDocumentMany).not.toHaveBeenCalled();
  });
});
