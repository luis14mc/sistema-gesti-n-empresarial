import ExcelJS from 'exceljs';
import { equipmentImportRowSchema } from './schemas';
import {
  EQUIPMENT_IMPORT_HEADERS,
  type EquipmentImportError,
  type EquipmentImportRow,
} from './types';

export const EQUIPMENT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const EQUIPMENT_IMPORT_MAX_ROWS = 1000;

function textValue(value: ExcelJS.CellValue): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object' && 'formula' in value) return undefined;
  const text = typeof value === 'object' && 'text' in value ? value.text : String(value);
  return text.trim() || undefined;
}

function parseDate(value: ExcelJS.CellValue): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const text = textValue(value);
  if (!text) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : local ? [Number(local[3]), Number(local[2]), Number(local[1])] : null;
  if (!parts) return undefined;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2] ? date : undefined;
}

export async function parseEquipmentWorkbook(buffer: Buffer): Promise<{
  totalRows: number;
  rows: EquipmentImportRow[];
  errors: EquipmentImportError[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet('Inventario');
  if (!sheet) throw new Error('MISSING_INVENTORY_WORKSHEET');
  const headers = EQUIPMENT_IMPORT_HEADERS.map((_, index) => textValue(sheet.getRow(1).getCell(index + 1).value));
  if (headers.some((header, index) => header !== EQUIPMENT_IMPORT_HEADERS[index])) throw new Error('INVALID_HEADERS');

  const rows: EquipmentImportRow[] = [];
  const errors: EquipmentImportError[] = [];
  let totalRows = 0;
  const lastRow = Math.min(sheet.actualRowCount, EQUIPMENT_IMPORT_MAX_ROWS + 2);
  if (sheet.actualRowCount - 1 > EQUIPMENT_IMPORT_MAX_ROWS + 1) throw new Error('ROW_LIMIT_EXCEEDED');

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = EQUIPMENT_IMPORT_HEADERS.map((_, index) => row.getCell(index + 1).value);
    if (values.every((value) => textValue(value) === undefined)) continue;
    if (textValue(values[0])?.toUpperCase().startsWith('EJEMPLO')) continue;
    totalRows += 1;
    const formulaColumn = values.findIndex((value) => typeof value === 'object' && value !== null && 'formula' in value);
    if (formulaColumn >= 0) {
      errors.push({ row: rowNumber, field: EQUIPMENT_IMPORT_HEADERS[formulaColumn], code: 'FORMULA_NOT_ALLOWED', message: 'No se permiten fórmulas en el archivo de importación.' });
      continue;
    }
    const rawDate = values[5];
    const purchaseDate = parseDate(rawDate);
    if (rawDate !== null && rawDate !== undefined && rawDate !== '' && !purchaseDate) {
      errors.push({ row: rowNumber, field: 'Fecha de compra', code: 'INVALID_DATE', message: 'Use una fecha válida en formato AAAA-MM-DD o DD/MM/AAAA.' });
      continue;
    }
    const candidate = {
      inventoryCode: textValue(values[0])?.toUpperCase(),
      type: textValue(values[1])?.toUpperCase(),
      brand: textValue(values[2]),
      model: textValue(values[3]),
      serialNumber: textValue(values[4]),
      purchaseDate,
      processor: textValue(values[6]), ram: textValue(values[7]), storage: textValue(values[8]),
      os: textValue(values[9]), includedAccessories: textValue(values[10]),
      installedSoftware: textValue(values[11]), notes: textValue(values[12]),
    };
    const parsed = equipmentImportRowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldIndex = ['inventoryCode', 'type', 'brand', 'model', 'serialNumber', 'purchaseDate', 'processor', 'ram', 'storage', 'os', 'includedAccessories', 'installedSoftware', 'notes'].indexOf(String(issue.path[0]));
        errors.push({ row: rowNumber, field: EQUIPMENT_IMPORT_HEADERS[fieldIndex] ?? 'Fila', code: issue.path[0] === 'type' ? 'INVALID_TYPE' : 'INVALID_FIELD', message: issue.message });
      }
      continue;
    }
    rows.push({ row: rowNumber, ...parsed.data });
  }

  const inventoryCodes = new Map<string, number>();
  const serialNumbers = new Map<string, number>();
  for (const row of rows) {
    if (row.inventoryCode) {
      const key = row.inventoryCode.toUpperCase();
      if (inventoryCodes.has(key)) errors.push({ row: row.row, field: 'Número de inventario', code: 'DUPLICATE_INVENTORY_IN_FILE', message: `Duplicado con la fila ${inventoryCodes.get(key)}.` });
      else inventoryCodes.set(key, row.row);
    }
    if (row.serialNumber) {
      const key = row.serialNumber.toUpperCase();
      if (serialNumbers.has(key)) errors.push({ row: row.row, field: 'Número de serie', code: 'DUPLICATE_SERIAL_IN_FILE', message: `Duplicado con la fila ${serialNumbers.get(key)}.` });
      else serialNumbers.set(key, row.row);
    }
  }
  const invalidRows = new Set(errors.map((error) => error.row));
  return { totalRows, rows: rows.filter((row) => !invalidRows.has(row.row)), errors };
}
