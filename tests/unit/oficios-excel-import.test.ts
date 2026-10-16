import ExcelJS from 'exceljs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildOficioImportTemplate } from '@/modules/oficios/import-export/oficios-template';
import { parseOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-excel';
import { OFICIO_IMPORT_HEADERS, OFICIO_IMPORT_SHEET } from '@/modules/oficios/import-export/types';
import { parseSequenceFromPattern } from '@/lib/oficios-numbering';

const mocks = vi.hoisted(() => ({
  employeeFindMany: vi.fn(),
  oficioFindMany: vi.fn(),
  numberingFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findMany: mocks.employeeFindMany },
    oficio: { findMany: mocks.oficioFindMany },
    oficioNumberingConfig: { findMany: mocks.numberingFindMany },
    oficioImportBatch: { create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { previewOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-import';

async function workbookBuffer(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(OFICIO_IMPORT_SHEET);
  sheet.addRow([...OFICIO_IMPORT_HEADERS]);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('oficios Excel template', () => {
  it('includes correspondence sheet and ignores example row', async () => {
    const buffer = await buildOficioImportTemplate(['CNI']);
    const parsed = await parseOficioImportWorkbook(buffer);
    expect(parsed.totalRows).toBe(0);
  });
});

describe('oficios workbook parser', () => {
  it('parses dd/mm/yyyy and iso dates', async () => {
    const buffer = await workbookBuffer([
      ['CNI-10-2024', 'Entrada', '15/06/2024', '', '', 'CNI', 'Inst', '', '', 'Dest', '', 'Asunto', 'Recibido', '', '', '', ''],
      ['CNI-11-2024', 'Salida', '2024-07-01', '', '', 'CNI', '', '', '', '', '', 'Otro asunto', '', '', '', '', ''],
    ]);
    const parsed = await parseOficioImportWorkbook(buffer);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].oficioDate.getUTCFullYear()).toBe(2024);
    expect(parsed.rows[1].oficioDate.getUTCMonth()).toBe(6);
  });

  it('rejects future dates', async () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 2);
    const iso = future.toISOString().slice(0, 10);
    const buffer = await workbookBuffer([
      ['X-1', 'Entrada', iso, '', '', 'CNI', '', '', '', '', 'Asunto', '', '', '', '', ''],
    ]);
    const parsed = await parseOficioImportWorkbook(buffer);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors.some((error) => error.message.includes('futura'))).toBe(true);
  });
});

describe('parseSequenceFromPattern', () => {
  it('extracts sequence from nomenclature pattern', () => {
    const seq = parseSequenceFromPattern('CNI-42-2024', 'CNI-{NUMERO}-{AÑO}', 2024, 'CNI');
    expect(seq).toBe(42);
  });
});

describe('oficios import preview', () => {
  beforeEach(() => {
    mocks.employeeFindMany.mockResolvedValue([]);
    mocks.oficioFindMany.mockResolvedValue([]);
    mocks.numberingFindMany.mockResolvedValue([
      {
        dependency: 'CNI',
        year: 2024,
        nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
        prefix: 'CNI',
        lastGeneratedSequence: 5,
        isActive: true,
      },
    ]);
  });

  it('flags duplicates by number, type and year', async () => {
    mocks.oficioFindMany.mockResolvedValue([
      {
        id: 'existing',
        number: 'CNI-9-2024',
        type: 'INCOMING',
        sequenceYear: 2024,
        oficioDate: new Date('2024-01-01T00:00:00Z'),
      },
    ]);
    const buffer = await workbookBuffer([
      ['CNI-9-2024', 'Entrada', '2024-01-10', '', '', 'CNI', '', '', '', '', '', 'Asunto', '', '', '', '', ''],
    ]);
    const preview = await previewOficioImportWorkbook({
      buffer,
      organizationId: 'org-1',
    });
    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[0]?.status).toBe('duplicate');
  });
});
