import ExcelJS from 'exceljs';
import { EQUIPMENT_EXCEL_TYPES, EQUIPMENT_IMPORT_HEADERS } from './types';

const TYPE_DESCRIPTIONS: Record<(typeof EQUIPMENT_EXCEL_TYPES)[number], string> = {
  LAPTOP: 'Computadora portátil',
  DESKTOP_PC: 'Computadora de escritorio',
  MONITOR: 'Monitor',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  UPS: 'Sistema de alimentación ininterrumpida',
  ACCESSORY: 'Accesorio de tecnología',
  OTHER: 'Otro equipo',
};

export async function buildEquipmentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Consejo Nacional de Inversiones';
  const inventory = workbook.addWorksheet('Inventario');
  inventory.addRow([...EQUIPMENT_IMPORT_HEADERS]);
  inventory.addRow([
    'EJEMPLO - NO IMPORTAR', 'LAPTOP', 'Dell', 'Latitude 5440', 'SN-EJEMPLO',
    new Date('2026-01-15T00:00:00Z'), 'Intel Core i7', '16 GB', '512 GB SSD',
    'Windows 11 Pro', 'Cargador', 'Microsoft 365', 'Fila de ejemplo; el importador la ignora.',
  ]);
  inventory.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  inventory.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  inventory.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  inventory.getCell('F2').numFmt = 'yyyy-mm-dd';
  inventory.views = [{ state: 'frozen', ySplit: 1 }];
  inventory.autoFilter = { from: 'A1', to: 'M1' };
  [24, 18, 18, 22, 22, 18, 24, 15, 20, 24, 28, 28, 36].forEach((width, index) => {
    inventory.getColumn(index + 1).width = width;
  });
  for (let row = 2; row <= 1001; row += 1) {
    inventory.getCell(row, 2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`'Catálogos'!$A$2:$A$${EQUIPMENT_EXCEL_TYPES.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Tipo inválido',
      error: 'Seleccione un tipo del catálogo.',
    };
  }

  const catalog = workbook.addWorksheet('Catálogos');
  catalog.addRow(['Tipo', 'Descripción']);
  catalog.getRow(1).font = { bold: true };
  for (const type of EQUIPMENT_EXCEL_TYPES) catalog.addRow([type, TYPE_DESCRIPTIONS[type]]);
  catalog.getColumn(1).width = 20;
  catalog.getColumn(2).width = 45;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
