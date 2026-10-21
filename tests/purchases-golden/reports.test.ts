import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildPurchaseOrderExportDataset } from '@/lib/compras/reportes/purchase-order-export';
import fixture from './__fixtures__/reports.json';

describe('purchases golden — reportes y exportación', () => {
  it('columnas del export purchase-order-summary', async () => {
    const sample = {
      orderNumber: 'COM-CNI-2026-00042',
      requestDate: new Date('2026-06-15'),
      status: 'ISSUED' as const,
      supplierName: 'Proveedor Reporte SA',
      supplierRtn: '08019999000001',
      subtotal: new Prisma.Decimal(1000),
      discount: new Prisma.Decimal(50),
      tax: new Prisma.Decimal(142.5),
      total: new Prisma.Decimal(1092.5),
    };

    const prisma = {
      compraOrden: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([sample]),
      },
    };

    const dataset = await buildPurchaseOrderExportDataset({
      prisma: prisma as never,
      organizationId: 'org-golden',
      organizationName: 'CNI Golden',
      year: 2026,
      now: new Date('2026-08-01T12:00:00.000Z'),
    });

    expect(dataset.columns.map((c) => ({ key: c.key, header: c.header, type: c.type, width: c.width }))).toEqual(
      fixture.exportColumns,
    );
    expect(dataset.rows[0]?.orderNumber).toBe(fixture.sampleOrderRow.orderNumber);
    expect(dataset.rows[0]?.status).toBe(fixture.sampleOrderRow.statusLabel);
    expect(dataset.rows[0]?.supplierName).toBe(fixture.sampleOrderRow.supplierName);
    expect(dataset.rows[0]?.subtotal).toBe(fixture.sampleOrderRow.subtotal);
    expect(dataset.rows[0]?.discount).toBe(fixture.sampleOrderRow.discount);
    expect(dataset.rows[0]?.taxableBase).toBe(fixture.sampleOrderRow.taxableBase);
    expect(dataset.rows[0]?.tax).toBe(fixture.sampleOrderRow.tax);
    expect(dataset.rows[0]?.total).toBe(fixture.sampleOrderRow.total);
    expect(dataset.currencySymbol).toBe('L');
  });

  it('mapeo estado canonical → legacy en GET /api/compras/reportes', () => {
    expect(fixture.reportesStatusMap).toEqual({
      DRAFT: 'BORRADOR',
      GENERATED: 'GENERADA',
      ISSUED: 'EMITIDA',
      CANCELLED: 'ANULADA',
      CLOSED: 'CERRADA',
    });
  });
});
