import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-excel';
import { previewOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-import';
import sample from './__fixtures__/import-preview-sample.json';
import { buildImportWorkbook } from './_helpers';

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

describe('oficios golden — importación Excel (preview)', () => {
  beforeEach(() => {
    mocks.employeeFindMany.mockResolvedValue([]);
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
    mocks.oficioFindMany.mockResolvedValue(
      sample.existingOficios.map((row) => ({
        ...row,
        oficioDate: new Date(row.oficioDate),
      })),
    );
  });

  it('parser: filas válidas y error de fecha futura', async () => {
    const buffer = await buildImportWorkbook(sample.workbookRows as unknown[][]);
    const parsed = await parseOficioImportWorkbook(buffer);
    expect(parsed.rows).toHaveLength(sample.expected.parsedRowCount);
    expect(
      parsed.errors.some((error) => error.message.includes(sample.expected.parseErrorSubstring)),
    ).toBe(true);
  });

  it('preview: mismo resumen y estados por fila que el fixture', async () => {
    const buffer = await buildImportWorkbook(sample.workbookRows as unknown[][]);
    const preview = await previewOficioImportWorkbook({
      buffer,
      organizationId: 'org-golden-1',
    });

    expect(preview.duplicateCount).toBe(sample.expected.preview.duplicateCount);

    for (const expectedRow of sample.expected.preview.rows) {
      const row = preview.rows.find((item) => item.row === expectedRow.row);
      expect(row, `fila ${expectedRow.row}`).toBeDefined();
      expect(row!.status).toBe(expectedRow.status);
      if ('number' in expectedRow && expectedRow.number) {
        expect(row!.number).toBe(expectedRow.number);
      }
    }
  });
});
