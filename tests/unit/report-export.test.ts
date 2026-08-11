import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  toCsv,
  toXlsx,
  sanitizeCsvText,
  isSupportedExportFormat,
  SYNC_EXPORT_ROW_LIMIT,
  type ExportDataset,
} from '@/platform/reporting/export';
import {
  buildPurchaseOrderExportDataset,
  PurchaseExportTooLargeError,
} from '@/lib/compras/reportes/purchase-order-export';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const dataset = (rows: ExportDataset['rows']): ExportDataset => ({
  reportTitle: 'Resumen de órdenes de compra',
  baseFilename: 'ordenes-compra-2026',
  organizationName: 'CNI',
  generatedAt: new Date('2026-08-03T12:00:00Z'),
  appliedFilters: { 'Año': '2026' },
  columns: [
    { key: 'orderNumber', header: 'N.º de orden', type: 'text' },
    { key: 'supplierName', header: 'Proveedor', type: 'text' },
    { key: 'total', header: 'Total', type: 'currency' },
  ],
  rows,
  currencySymbol: 'L',
});

// ── format helpers ──────────────────────────────────────────
describe('export format support (11)', () => {
  it('accepts csv/xlsx and rejects unsupported formats', () => {
    expect(isSupportedExportFormat('csv')).toBe(true);
    expect(isSupportedExportFormat('xlsx')).toBe(true);
    expect(isSupportedExportFormat('pdf')).toBe(false);
    expect(isSupportedExportFormat('exe')).toBe(false);
  });
});

// ── CSV ─────────────────────────────────────────────────────
describe('CSV exporter', () => {
  it('1. returns the correct MIME and BOM', () => {
    const a = toCsv(dataset([{ orderNumber: 'OC-1', supplierName: 'Acme', total: 100 }]));
    expect(a.contentType).toBe('text/csv; charset=utf-8');
    expect(a.filename).toMatch(/\.csv$/);
    expect(Array.from(a.body.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('3. an exported purchase order appears in the output', () => {
    const a = toCsv(dataset([{ orderNumber: 'OC-2026-007', supplierName: 'Acme', total: 100 }]));
    expect(new TextDecoder().decode(a.body)).toContain('OC-2026-007');
  });

  it('8. formula injection is neutralized for text cells', () => {
    expect(sanitizeCsvText('=HYPERLINK("http://x")')).toBe("'=HYPERLINK(\"http://x\")");
    expect(sanitizeCsvText('+1+1')).toBe("'+1+1");
    expect(sanitizeCsvText('@SUM')).toBe("'@SUM");
    expect(sanitizeCsvText('-cmd')).toBe("'-cmd");
    const a = toCsv(dataset([{ orderNumber: '=cmd|calc', supplierName: 'ok', total: 5 }]));
    expect(new TextDecoder().decode(a.body)).toContain("'=cmd|calc");
  });

  it('does NOT corrupt legitimate negative numeric values', () => {
    const ds = dataset([{ orderNumber: 'OC-9', supplierName: 'x', total: -1500 }]);
    const text = new TextDecoder().decode(toCsv(ds).body);
    // numeric cell keeps its sign, no apostrophe injected
    expect(text).toContain('-1500.00');
    expect(text).not.toContain("'-1500");
  });
});

// ── XLSX ────────────────────────────────────────────────────
describe('XLSX exporter', () => {
  it('2. returns the correct MIME', async () => {
    const a = await toXlsx(dataset([{ orderNumber: 'OC-1', supplierName: 'Acme', total: 100 }]));
    expect(a.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(a.filename).toMatch(/\.xlsx$/);
  });

  it('9. numeric currency cells remain numeric (read back with exceljs)', async () => {
    const a = await toXlsx(dataset([{ orderNumber: 'OC-1', supplierName: 'Acme', total: 1234.5 }]));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(a.body as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    let found: unknown;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === 1234.5) found = cell.value;
      });
    });
    expect(typeof found).toBe('number');
    expect(found).toBe(1234.5);
  });

  it('has a frozen header row and auto-filter', async () => {
    const a = await toXlsx(dataset([{ orderNumber: 'OC-1', supplierName: 'Acme', total: 1 }]));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(a.body as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    expect(ws.views?.[0]?.state).toBe('frozen');
    expect(ws.autoFilter).toBeTruthy();
  });
});

// ── Canonical purchase builder (fake prisma, no real DB) ─────
type Captured = { where?: Record<string, unknown> };
function fakePrisma(count: number, rows: unknown[], captured: Captured) {
  return {
    compraOrden: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        captured.where = where;
        return count;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        captured.where = where;
        return rows;
      },
    },
  } as never;
}

describe('canonical purchase-order export builder', () => {
  const order = {
    orderNumber: 'OC-2026-001', requestDate: new Date('2026-03-01'), status: 'ISSUED',
    supplierName: 'Proveedor SA', supplierRtn: '08011999123456',
    subtotal: 1000, discount: 100, tax: 135, total: 1035,
  };

  it('4 & purchase-source. reads CompraOrden (never CompraSolicitud) — source contract', () => {
    const src = read('src/lib/compras/reportes/purchase-order-export.ts');
    expect(src).toMatch(/prisma\.compraOrden\.(count|findMany)/);
    expect(src).not.toMatch(/compraSolicitud/);
  });

  it('5, 6, 7. where clause is tenant-scoped, date-filtered and status-filtered', async () => {
    const captured: Captured = {};
    await buildPurchaseOrderExportDataset({
      prisma: fakePrisma(1, [order], captured),
      organizationId: 'org-A', organizationName: 'CNI', year: 2026, status: 'ISSUED',
    });
    expect(captured.where?.organizationId).toBe('org-A');
    expect(captured.where?.deletedAt).toBeNull();
    expect(captured.where?.requestDate).toBeTruthy();
    expect(captured.where?.status).toBe('ISSUED');
  });

  it('computes taxable base and a totals summary row', async () => {
    const ds = await buildPurchaseOrderExportDataset({
      prisma: fakePrisma(1, [order], {}),
      organizationId: 'org-A', year: 2026,
    });
    expect(ds.rows[0].taxableBase).toBe(900); // subtotal - discount
    expect(ds.summary?.total).toBe(1035);
    expect(ds.reportTitle).toBe('Resumen de órdenes de compra');
  });

  it('12. enforces the synchronous row limit', async () => {
    await expect(
      buildPurchaseOrderExportDataset({
        prisma: fakePrisma(SYNC_EXPORT_ROW_LIMIT + 1, [], {}),
        organizationId: 'org-A', year: 2026,
      }),
    ).rejects.toBeInstanceOf(PurchaseExportTooLargeError);
  });
});

// ── endpoint authz/format contract (10, 11) ─────────────────
describe('export endpoint contract', () => {
  const src = read('src/app/api/compras/reportes/export/route.ts');
  it('10. rejects non-admin / unauthorized', () => {
    expect(src).toMatch(/role !== 'ADMIN'/);
    expect(src).toMatch(/status: 403/);
  });
  it('11. rejects unsupported format before doing work', () => {
    expect(src).toMatch(/isSupportedExportFormat/);
    expect(src).toMatch(/UNSUPPORTED_FORMAT/);
  });
  it('is tenant-scoped and audited', () => {
    expect(src).toMatch(/requireOrganizationContext/);
    expect(src).toMatch(/createAuditRecord/);
  });
});
