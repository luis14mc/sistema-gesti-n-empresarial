import ExcelJS from 'exceljs';
import { OFICIO_IMPORT_HEADERS, OFICIO_IMPORT_SHEET } from '@/modules/oficios/import-export/types';

export async function buildImportWorkbook(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(OFICIO_IMPORT_SHEET);
  sheet.addRow([...OFICIO_IMPORT_HEADERS]);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
