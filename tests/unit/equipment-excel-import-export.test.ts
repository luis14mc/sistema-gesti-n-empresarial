import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEquipmentTemplate } from '@/modules/equipment/import-export/equipment-template';
import { parseEquipmentWorkbook } from '@/modules/equipment/import-export/equipment-excel';
import { EQUIPMENT_EXCEL_TYPES, EQUIPMENT_IMPORT_HEADERS } from '@/modules/equipment/import-export/types';
import { safeSpreadsheetText } from '@/modules/equipment/import-export/equipment-export';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createEquipmentRecord: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { equipment: { findMany: mocks.findMany } },
}));
vi.mock('@/modules/equipment/import-export/equipment-create', () => ({
  createEquipmentRecord: mocks.createEquipmentRecord,
}));

import { importEquipmentWorkbook } from '@/modules/equipment/import-export/equipment-import';

async function workbookBuffer(rows: unknown[][], headers: readonly string[] = EQUIPMENT_IMPORT_HEADERS): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventario');
  sheet.addRow([...headers]);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('equipment Excel template', () => {
  it('returns a real XLSX with expected headers and catalog values', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildEquipmentTemplate() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const inventory = workbook.getWorksheet('Inventario');
    const catalog = workbook.getWorksheet('Catálogos');
    expect(inventory).toBeTruthy();
    expect(catalog).toBeTruthy();
    expect(EQUIPMENT_IMPORT_HEADERS.map((_, index) => inventory!.getRow(1).getCell(index + 1).value)).toEqual([...EQUIPMENT_IMPORT_HEADERS]);
    expect(EQUIPMENT_EXCEL_TYPES.map((_, index) => catalog!.getRow(index + 2).getCell(1).value)).toEqual([...EQUIPMENT_EXCEL_TYPES]);
    expect(inventory!.getCell('B3').dataValidation.type).toBe('list');
  });

  it('marks the example so the parser ignores it', async () => {
    const parsed = await parseEquipmentWorkbook(await buildEquipmentTemplate());
    expect(parsed.totalRows).toBe(0);
    expect(parsed.rows).toHaveLength(0);
  });
});

describe('equipment workbook parser', () => {
  it('parses valid rows, Excel dates and blank optional inventory codes', async () => {
    const parsed = await parseEquipmentWorkbook(await workbookBuffer([
      ['', 'LAPTOP', ' Dell ', 'Latitude', 'SN-1', 46037, 'i7', '16 GB'],
    ]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ type: 'LAPTOP', brand: 'Dell', inventoryCode: undefined });
    expect(parsed.rows[0].purchaseDate).toBeInstanceOf(Date);
  });

  it('rejects malformed headers, invalid types and missing required fields', async () => {
    await expect(parseEquipmentWorkbook(await workbookBuffer([], ['Otro']))).rejects.toThrow('INVALID_HEADERS');
    const parsed = await parseEquipmentWorkbook(await workbookBuffer([
      ['TI-1', 'TRACTOR', '', 'Modelo'],
    ]));
    expect(parsed.errors.map((error) => error.code)).toContain('INVALID_TYPE');
    expect(parsed.errors.some((error) => error.field === 'Marca')).toBe(true);
  });

  it('detects duplicate inventory and serial values inside the workbook', async () => {
    const parsed = await parseEquipmentWorkbook(await workbookBuffer([
      ['TI-LAP-1', 'LAPTOP', 'Dell', 'A', 'SERIAL-X'],
      ['ti-lap-1', 'MONITOR', 'Dell', 'B', 'serial-x'],
    ]));
    expect(parsed.errors.map((error) => error.code)).toEqual(expect.arrayContaining(['DUPLICATE_INVENTORY_IN_FILE', 'DUPLICATE_SERIAL_IN_FILE']));
    expect(parsed.rows).toHaveLength(1);
  });

  it('rejects formulas in imported cells', async () => {
    const parsed = await parseEquipmentWorkbook(await workbookBuffer([
      ['', 'LAPTOP', { formula: 'HYPERLINK("https://invalid")', result: 'Dell' }, 'A'],
    ]));
    expect(parsed.errors[0].code).toBe('FORMULA_NOT_ALLOWED');
  });

  it('accepts exactly 1000 data rows and rejects the 1001st', async () => {
    const validRows = Array.from({ length: 1000 }, (_, index) => [
      `TI-LAP-${String(index + 1).padStart(4, '0')}`,
      'LAPTOP',
      'Dell',
      `Modelo ${index + 1}`,
      `SERIAL-${index + 1}`,
    ]);

    const parsed = await parseEquipmentWorkbook(await workbookBuffer(validRows));
    expect(parsed.totalRows).toBe(1000);
    expect(parsed.rows).toHaveLength(1000);

    await expect(parseEquipmentWorkbook(await workbookBuffer([
      ...validRows,
      ['TI-LAP-1001', 'LAPTOP', 'Dell', 'Modelo 1001', 'SERIAL-1001'],
    ]))).rejects.toThrow('ROW_LIMIT_EXCEEDED');
  });
});

describe('equipment import orchestration', () => {
  beforeEach(() => {
    mocks.findMany.mockReset().mockResolvedValue([]);
    mocks.createEquipmentRecord.mockReset().mockResolvedValue({ id: 'eq-1' });
  });

  it('imports valid rows using canonical creation and the authenticated organization', async () => {
    const result = await importEquipmentWorkbook({
      buffer: await workbookBuffer([['', 'LAPTOP', 'Dell', 'Latitude']]),
      organizationId: 'org-cni', userId: 'user-1', requestId: 'req-1',
    });
    expect(result).toMatchObject({ totalRows: 1, imported: 1, skipped: 0 });
    expect(mocks.createEquipmentRecord).toHaveBeenCalledWith(
      expect.objectContaining({ inventoryCode: undefined, type: 'LAPTOP' }),
      expect.objectContaining({ organizationId: 'org-cni', userId: 'user-1' }),
    );
  });

  it('scopes duplicate checks to the authenticated organization and skips database duplicates', async () => {
    mocks.findMany.mockResolvedValue([{ inventoryCode: 'TI-CNI-1', serialNumber: 'SER-1' }]);
    const result = await importEquipmentWorkbook({
      buffer: await workbookBuffer([['TI-CNI-1', 'LAPTOP', 'Dell', 'Latitude', 'SER-1']]),
      organizationId: 'org-cni', userId: 'user-1', requestId: 'req-1',
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-cni' }) }));
    expect(result.imported).toBe(0);
    expect(result.errors.map((error) => error.code)).toContain('DUPLICATE_INVENTORY');
    expect(mocks.createEquipmentRecord).not.toHaveBeenCalled();
  });

  it('imports valid rows while leaving invalid rows unpersisted', async () => {
    const result = await importEquipmentWorkbook({
      buffer: await workbookBuffer([
        ['', 'LAPTOP', 'Dell', 'Latitude'],
        ['', 'INVALID', 'Dell', 'Other'],
      ]),
      organizationId: 'org-cni', userId: 'user-1', requestId: 'req-1',
    });
    expect(result).toMatchObject({ totalRows: 2, imported: 1, skipped: 1 });
    expect(mocks.createEquipmentRecord).toHaveBeenCalledTimes(1);
  });
});

describe('equipment export safety', () => {
  it('neutralizes formula injection prefixes without changing ordinary text', () => {
    expect(safeSpreadsheetText('=HYPERLINK("x")')).toBe("'=HYPERLINK(\"x\")");
    expect(safeSpreadsheetText('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(safeSpreadsheetText('-cmd')).toBe("'-cmd");
    expect(safeSpreadsheetText('@SUM')).toBe("'@SUM");
    expect(safeSpreadsheetText('Dell')).toBe('Dell');
  });
});
