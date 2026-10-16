import ExcelJS from 'exceljs';
import type { OficioStatus, OficioType } from '@prisma/client';
import { loadXlsxWorkbook } from '@/platform/excel/load-xlsx';
import {
  normalizeOficioDependency,
  normalizeOficioDirection,
} from '@/lib/oficios-numbering';
import { OFICIO_STATUS_LABELS } from '@/types';
import { oficioImportRowSchema } from './schemas';
import {
  OFICIO_IMPORT_HEADERS,
  OFICIO_IMPORT_SHEET,
  OFICIO_IMPORT_MAX_ROWS,
  type OficioImportParsedRow,
} from './types';

function normalizeHeader(value: string | undefined): string {
  return (value ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

function textValue(value: ExcelJS.CellValue): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object' && value !== null && 'formula' in value) return undefined;
  const text = typeof value === 'object' && value !== null && 'text' in value ? value.text : String(value);
  return text.trim() || undefined;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDate(value: ExcelJS.CellValue): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : startOfUtcDay(value);
  }
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(date.getTime()) ? undefined : startOfUtcDay(date);
  }
  const text = textValue(value);
  if (!text) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const parts = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local
      ? [Number(local[3]), Number(local[2]), Number(local[1])]
      : null;
  if (!parts) return undefined;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2]
    ? date
    : undefined;
}

const TYPE_LABEL_TO_ENUM: Record<string, OficioType> = {
  ENTRADA: 'INCOMING',
  SALIDA: 'OUTGOING',
  INTERNO: 'INTERNAL_MEMO',
};

const STATUS_LABEL_TO_ENUM = Object.fromEntries(
  Object.entries(OFICIO_STATUS_LABELS).map(([key, label]) => [label.toUpperCase(), key]),
) as Record<string, OficioStatus>;

function mapTypeLabel(raw?: string): OficioType | undefined {
  const key = raw?.trim().toUpperCase();
  if (!key) return undefined;
  if (key.startsWith('ENTRADA')) return 'INCOMING';
  if (key.startsWith('SALIDA')) return 'OUTGOING';
  if (key.startsWith('INTERNO')) return 'INTERNAL_MEMO';
  return TYPE_LABEL_TO_ENUM[key];
}

function mapStatusLabel(raw: string | undefined, type: OficioType): OficioStatus {
  if (raw) {
    const normalized = raw.trim().toUpperCase();
    const fromLabel = STATUS_LABEL_TO_ENUM[normalized];
    if (fromLabel) return fromLabel;
    if ((Object.keys(OFICIO_STATUS_LABELS) as OficioStatus[]).includes(normalized as OficioStatus)) {
      return normalized as OficioStatus;
    }
  }
  if (type === 'INCOMING') return 'RECEIVED';
  if (type === 'INTERNAL_MEMO') return 'COMPLETED';
  return 'SENT';
}

function isFutureDate(date: Date): boolean {
  const today = startOfUtcDay(new Date());
  return date.getTime() > today.getTime();
}

export async function parseOficioImportWorkbook(buffer: Buffer): Promise<{
  totalRows: number;
  rows: OficioImportParsedRow[];
  errors: Array<{ row: number; field: string; message: string }>;
}> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.getWorksheet(OFICIO_IMPORT_SHEET);
  if (!sheet) throw new Error('MISSING_CORRESPONDENCE_WORKSHEET');

  const headers = OFICIO_IMPORT_HEADERS.map((_, index) =>
    normalizeHeader(textValue(sheet.getRow(1).getCell(index + 1).value)),
  );
  const expected = OFICIO_IMPORT_HEADERS.map((header) => normalizeHeader(header));
  if (headers.some((header, index) => header !== expected[index])) {
    throw new Error('INVALID_HEADERS');
  }

  const rows: OficioImportParsedRow[] = [];
  const errors: Array<{ row: number; field: string; message: string }> = [];
  let totalRows = 0;

  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const values = OFICIO_IMPORT_HEADERS.map((_, index) => excelRow.getCell(index + 1).value);
    if (values.every((value) => textValue(value) === undefined)) continue;

    const firstCell = textValue(values[0]);
    if (firstCell?.toUpperCase().startsWith('EJEMPLO')) continue;

    totalRows += 1;
    if (totalRows > OFICIO_IMPORT_MAX_ROWS) throw new Error('ROW_LIMIT_EXCEEDED');

    const formulaColumn = values.findIndex(
      (value) => typeof value === 'object' && value !== null && 'formula' in value,
    );
    if (formulaColumn >= 0) {
      errors.push({
        row: rowNumber,
        field: OFICIO_IMPORT_HEADERS[formulaColumn],
        message: 'No se permiten fórmulas en el archivo de importación.',
      });
      continue;
    }

    const oficioDate = parseDate(values[2]);
    if (values[2] !== null && values[2] !== undefined && values[2] !== '' && !oficioDate) {
      errors.push({
        row: rowNumber,
        field: OFICIO_IMPORT_HEADERS[2],
        message: 'Use una fecha válida (dd/mm/aaaa, aaaa-mm-dd o celda de fecha).',
      });
      continue;
    }
    const receivedDate = parseDate(values[3]);
    const sentDate = parseDate(values[4]);
    if (oficioDate && isFutureDate(oficioDate)) {
      errors.push({ row: rowNumber, field: OFICIO_IMPORT_HEADERS[2], message: 'La fecha del oficio no puede ser futura.' });
      continue;
    }
    if (receivedDate && isFutureDate(receivedDate)) {
      errors.push({ row: rowNumber, field: OFICIO_IMPORT_HEADERS[3], message: 'La fecha de recepción no puede ser futura.' });
      continue;
    }
    if (sentDate && isFutureDate(sentDate)) {
      errors.push({ row: rowNumber, field: OFICIO_IMPORT_HEADERS[4], message: 'La fecha de envío no puede ser futura.' });
      continue;
    }

    const type = mapTypeLabel(textValue(values[1]));
    if (!type) {
      errors.push({ row: rowNumber, field: OFICIO_IMPORT_HEADERS[1], message: 'Seleccione Entrada, Salida o Interno.' });
      continue;
    }
    if (!oficioDate) {
      errors.push({ row: rowNumber, field: OFICIO_IMPORT_HEADERS[2], message: 'La fecha del oficio es obligatoria.' });
      continue;
    }

    const dependency = normalizeOficioDependency(textValue(values[5]));
    const status = mapStatusLabel(textValue(values[12]), type);

    const candidate = {
      number: textValue(values[0]) ?? '',
      type,
      oficioDate,
      receivedDate,
      sentDate,
      dependency,
      institution: textValue(values[6]),
      senderName: textValue(values[7]),
      senderPosition: textValue(values[8]),
      recipientName: textValue(values[9]),
      recipientPosition: textValue(values[10]),
      subject: textValue(values[11]) ?? '',
      status,
      preparedBy: textValue(values[13]),
      responsibleRef: textValue(values[14]),
      cc: textValue(values[15]),
      comments: textValue(values[16]),
    };

    const parsed = oficioImportRowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldKey = String(issue.path[0] ?? 'row');
        const headerIndex = [
          'number', 'type', 'oficioDate', 'receivedDate', 'sentDate', 'dependency',
          'institution', 'senderName', 'senderPosition', 'recipientName', 'recipientPosition',
          'subject', 'status', 'preparedBy', 'responsibleRef', 'cc', 'comments',
        ].indexOf(fieldKey);
        errors.push({
          row: rowNumber,
          field: headerIndex >= 0 ? OFICIO_IMPORT_HEADERS[headerIndex] : 'Fila',
          message: issue.message,
        });
      }
      continue;
    }

    const direction = normalizeOficioDirection(type, dependency);
    const warnings: string[] = [];
    if (direction === 'INCOMING' && dependency === 'INTERNO') {
      warnings.push('Entrada con dependencia Interno: verifique el tipo y la dependencia.');
    }

    rows.push({
      row: rowNumber,
      ...parsed.data,
      dependency,
      sequenceYear: oficioDate.getUTCFullYear(),
      warnings,
    });
  }

  const invalidRows = new Set(errors.map((error) => error.row));
  return {
    totalRows,
    rows: rows.filter((row) => !invalidRows.has(row.row)),
    errors,
  };
}
