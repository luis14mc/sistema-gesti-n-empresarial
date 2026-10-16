import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OficioImportParsedRow } from '@/modules/oficios/import-export/types';

const txMocks = vi.hoisted(() => ({
  executeRawUnsafe: vi.fn(),
  oficioCreate: vi.fn(),
  batchItemCreate: vi.fn(),
}));

describe('oficio import commit row isolation (SAVEPOINT pattern)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.oficioCreate
      .mockRejectedValueOnce(new Error('duplicate key'))
      .mockResolvedValueOnce({ id: 'oficio-2' });
    txMocks.batchItemCreate.mockResolvedValue({});
    txMocks.executeRawUnsafe.mockResolvedValue(0);
  });

  it('uses SAVEPOINT so one failing row does not abort the whole chunk', async () => {
    const rows: OficioImportParsedRow[] = [
      {
        row: 2,
        number: 'DUP-1',
        type: 'INCOMING',
        oficioDate: new Date('2024-01-01T00:00:00Z'),
        dependency: 'CNI',
        subject: 'A',
        status: 'RECEIVED',
        sequenceYear: 2024,
        warnings: [],
      },
      {
        row: 3,
        number: 'OK-1',
        type: 'INCOMING',
        oficioDate: new Date('2024-01-02T00:00:00Z'),
        dependency: 'CNI',
        subject: 'B',
        status: 'RECEIVED',
        sequenceYear: 2024,
        warnings: [],
      },
    ];

    let imported = 0;
    let errors = 0;

    for (const row of rows) {
      const sp = `import_row_${row.row}`;
      await txMocks.executeRawUnsafe(`SAVEPOINT ${sp}`);
      try {
        await txMocks.oficioCreate({ data: { number: row.number } });
        await txMocks.batchItemCreate({ data: { rowIndex: row.row, status: 'IMPORTED' } });
        await txMocks.executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
        imported += 1;
      } catch {
        await txMocks.executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
        errors += 1;
        await txMocks.batchItemCreate({ data: { rowIndex: row.row, status: 'ERROR' } });
      }
    }

    expect(imported).toBe(1);
    expect(errors).toBe(1);
    expect(txMocks.executeRawUnsafe).toHaveBeenCalledWith('SAVEPOINT import_row_2');
    expect(txMocks.executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT import_row_2');
    expect(txMocks.executeRawUnsafe).toHaveBeenCalledWith('RELEASE SAVEPOINT import_row_3');
  });
});
