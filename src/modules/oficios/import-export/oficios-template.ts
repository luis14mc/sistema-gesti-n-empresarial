import ExcelJS from 'exceljs';
import { type OficioDependency } from '@/lib/oficios-numbering';
import { OFICIO_STATUS_LABELS } from '@/types';
import {
  OFICIO_EXCEL_TYPES,
  OFICIO_IMPORT_CATALOG_SHEET,
  OFICIO_IMPORT_HEADERS,
  OFICIO_IMPORT_SHEET,
} from './types';

export async function buildOficioImportTemplate(activeDependencies: OficioDependency[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Consejo Nacional de Inversiones';

  const sheet = workbook.addWorksheet(OFICIO_IMPORT_SHEET);
  sheet.addRow([...OFICIO_IMPORT_HEADERS]);
  sheet.addRow([
    'EJEMPLO - NO IMPORTAR',
    'Entrada',
    new Date('2024-06-15T00:00:00Z'),
    new Date('2024-06-16T00:00:00Z'),
    '',
    'CNI',
    'Institución ejemplo',
    'Remitente ejemplo',
    'Director',
    'Destinatario ejemplo',
    'Analista',
    'Asunto de ejemplo',
    'Recibido',
    'Elaborado por ejemplo',
    'empleado@ejemplo.hn',
    'Copia ejemplo',
    'Fila de ejemplo; el importador la ignora.',
  ]);

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  sheet.getCell('C2').numFmt = 'dd/mm/yyyy';
  sheet.getCell('D2').numFmt = 'dd/mm/yyyy';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'Q1' };

  const widths = [22, 28, 16, 18, 16, 16, 22, 20, 18, 20, 18, 36, 18, 18, 32, 24, 32];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const dependencyRows = activeDependencies.length > 0 ? activeDependencies : (['CNI', 'DESPACHO', 'INTERNO'] as const);
  const statusLabels = Object.values(OFICIO_STATUS_LABELS);

  const catalog = workbook.addWorksheet(OFICIO_IMPORT_CATALOG_SHEET);
  catalog.addRow(['Tipo', 'Dependencia', 'Estado']);
  catalog.getRow(1).font = { bold: true };
  const maxCatalogRows = Math.max(OFICIO_EXCEL_TYPES.length, dependencyRows.length, statusLabels.length);
  for (let index = 0; index < maxCatalogRows; index += 1) {
    catalog.addRow([
      OFICIO_EXCEL_TYPES[index] ?? '',
      dependencyRows[index] ?? '',
      statusLabels[index] ?? '',
    ]);
  }
  catalog.getColumn(1).width = 14;
  catalog.getColumn(2).width = 42;
  catalog.getColumn(3).width = 24;

  const tipoEnd = OFICIO_EXCEL_TYPES.length + 1;
  const depEnd = dependencyRows.length + 1;
  const statusEnd = statusLabels.length + 1;

  for (let row = 2; row <= 2001; row += 1) {
    sheet.getCell(row, 2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`'${OFICIO_IMPORT_CATALOG_SHEET}'!$A$2:$A$${tipoEnd}`],
      showErrorMessage: true,
      errorTitle: 'Tipo inválido',
      error: 'Seleccione Entrada, Salida o Interno.',
    };
    sheet.getCell(row, 6).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`'${OFICIO_IMPORT_CATALOG_SHEET}'!$B$2:$B$${depEnd}`],
      showErrorMessage: true,
      errorTitle: 'Dependencia inválida',
      error: 'Seleccione una dependencia del catálogo.',
    };
    sheet.getCell(row, 13).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'${OFICIO_IMPORT_CATALOG_SHEET}'!$C$2:$C$${statusEnd}`],
      showErrorMessage: true,
      errorTitle: 'Estado inválido',
      error: 'Seleccione un estado del catálogo.',
    };
    sheet.getCell(row, 3).numFmt = 'dd/mm/yyyy';
    sheet.getCell(row, 4).numFmt = 'dd/mm/yyyy';
    sheet.getCell(row, 5).numFmt = 'dd/mm/yyyy';
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
