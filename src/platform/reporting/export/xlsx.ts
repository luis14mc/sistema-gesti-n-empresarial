import ExcelJS from 'exceljs';
import type { ExportArtifact, ExportColumn, ExportDataset } from './types';
import { safeFilename } from './types';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sheetName(title: string): string {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  return (title.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Reporte').trim();
}

function numFmtFor(column: ExportColumn, currencySymbol: string): string | undefined {
  switch (column.type) {
    case 'currency':
      return `"${currencySymbol}" #,##0.00`;
    case 'number':
      return '#,##0';
    case 'percent':
      return '0.00%';
    case 'date':
      return 'yyyy-mm-dd';
    default:
      return undefined;
  }
}

function coerceValue(value: unknown, column: ExportColumn): string | number | Date | null {
  if (value === null || value === undefined) return null;
  switch (column.type) {
    case 'number':
    case 'currency': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null; // numeric cell stays numeric
    }
    case 'percent': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null; // stored as fraction, formatted as %
    }
    case 'date': {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d;
    }
    case 'text':
    default:
      // Stored as a string cell (t="s"); Excel never evaluates it as a formula.
      return String(value);
  }
}

/**
 * Serialize a dataset to a real .xlsx workbook: institutional title, generated
 * date, applied filters, organization name, a frozen bold header row,
 * auto-filter, readable column widths, and typed cells (currency/number/percent
 * remain NUMERIC; dates remain dates). Optional summary row.
 */
export async function toXlsx(dataset: ExportDataset): Promise<ExportArtifact> {
  const currency = dataset.currencySymbol ?? 'L';
  const wb = new ExcelJS.Workbook();
  wb.creator = dataset.organizationName ?? 'SGE';
  wb.created = dataset.generatedAt;
  const ws = wb.addWorksheet(sheetName(dataset.reportTitle));

  const colCount = dataset.columns.length;
  const lastCol = ws.getColumn(colCount).letter;

  // ── Institutional header block ──────────────────────────────
  let r = 1;
  const titleRow = ws.getRow(r++);
  titleRow.getCell(1).value = dataset.reportTitle;
  titleRow.getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells(`A1:${lastCol}1`);

  if (dataset.organizationName) {
    ws.getRow(r++).getCell(1).value = `Organización: ${dataset.organizationName}`;
  }
  ws.getRow(r++).getCell(1).value = `Generado: ${dataset.generatedAt.toISOString()}`;
  if (dataset.appliedFilters) {
    for (const [k, v] of Object.entries(dataset.appliedFilters)) {
      ws.getRow(r++).getCell(1).value = `${k}: ${v}`;
    }
  }
  r++; // spacer

  // ── Table header ────────────────────────────────────────────
  const headerRowIndex = r;
  const headerRow = ws.getRow(headerRowIndex);
  dataset.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    ws.getColumn(i + 1).width = col.width ?? Math.max(12, col.header.length + 2);
  });
  r++;

  // ── Data rows ───────────────────────────────────────────────
  for (const row of dataset.rows) {
    const excelRow = ws.getRow(r++);
    dataset.columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = coerceValue(row[col.key], col);
      const fmt = numFmtFor(col, currency);
      if (fmt) cell.numFmt = fmt;
    });
  }

  if (dataset.summary) {
    const excelRow = ws.getRow(r++);
    dataset.columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = coerceValue(dataset.summary![col.key], col);
      cell.font = { bold: true };
      const fmt = numFmtFor(col, currency);
      if (fmt) cell.numFmt = fmt;
    });
  }

  // Freeze the header row and enable auto-filter across the table header.
  ws.views = [{ state: 'frozen', ySplit: headerRowIndex }];
  ws.autoFilter = { from: { row: headerRowIndex, column: 1 }, to: { row: headerRowIndex, column: colCount } };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return {
    filename: safeFilename(dataset.baseFilename, 'xlsx'),
    contentType: XLSX_CONTENT_TYPE,
    body: Buffer.from(arrayBuffer),
  };
}
