import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  employee: {
    findMany: vi.fn(),
  },
  oficio: {
    findMany: vi.fn(),
  },
  oficioNumberingConfig: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { previewOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-import';

vi.mock('@/modules/oficios/import-export/oficios-excel', () => ({
  parseOficioImportWorkbook: vi.fn(),
}));

import { parseOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-excel';

const parseMock = vi.mocked(parseOficioImportWorkbook);

beforeEach(() => {
  prismaMock.employee.findMany.mockReset();
  prismaMock.oficio.findMany.mockReset();
  prismaMock.oficioNumberingConfig.findMany.mockReset();
  parseMock.mockReset();
  prismaMock.oficio.findMany.mockResolvedValue([]);
  prismaMock.oficioNumberingConfig.findMany.mockResolvedValue([]);
});

describe('oficio import organization scope', () => {
  it('reports a row error when responsibleRef is an employee id from another organization', async () => {
    const foreignEmployeeId = 'cforeignemployeeid000001';
    parseMock.mockResolvedValue({
      totalRows: 1,
      errors: [],
      rows: [
        {
          row: 2,
          number: 'OF-001',
          type: 'INCOMING',
          dependency: 'CNI',
          subject: 'Prueba',
          status: 'RECEIVED',
          oficioDate: new Date('2026-01-15T00:00:00.000Z'),
          sequenceYear: 2026,
          responsibleRef: foreignEmployeeId,
          warnings: [],
        },
      ],
    });
    prismaMock.employee.findMany.mockResolvedValueOnce([]);

    const preview = await previewOficioImportWorkbook({
      buffer: Buffer.from('x'),
      organizationId: 'org-a',
    });

    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0]?.status).toBe('error');
    expect(preview.rows[0]?.errors?.[0]?.message).toMatch(/organización/i);
    expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-a' }),
      }),
    );
  });
});
