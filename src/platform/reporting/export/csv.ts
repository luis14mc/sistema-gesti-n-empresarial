import type { ExportArtifact, ExportCellType, ExportDataset } from './types';
import { safeFilename } from './types';

const UTF8_BOM = '﻿';

/**
 * Neutralize spreadsheet formula injection for TEXT cells (OWASP guidance).
 * A cell whose text begins with = + - @ or a control char (TAB/CR/LF) can be
 * interpreted as a formula by Excel/Sheets. We prefix such values with a
 * single apostrophe so they render literally.
 *
 * This is applied ONLY to text cells. Numeric/currency/percent values are
 * emitted as bare numbers, so a legitimate negative number like -1500 keeps
 * its sign and is never mistaken for a formula.
 */
export function sanitizeCsvText(value: string): string {
  if (value.length === 0) return value;
  const first = value[0];
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r' || first === '\n') {
    return `'${value}`;
  }
  return value;
}

function quoteField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(value: unknown, type: ExportCellType): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'number':
    case 'currency': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return '';
      // Bare numeric literal — never sanitized (a leading '-' is a valid sign).
      return type === 'currency' ? n.toFixed(2) : String(n);
    }
    case 'percent': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return '';
      return n.toFixed(2);
    }
    case 'date': {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) return quoteField(sanitizeCsvText(String(value)));
      return d.toISOString().slice(0, 10);
    }
    case 'text':
    default:
      return quoteField(sanitizeCsvText(String(value)));
  }
}

/**
 * Serialize a dataset to CSV: UTF-8 + BOM (Excel compatibility), stable column
 * order, Spanish headers, applied-filters preamble, tenant-scoped rows (caller
 * supplies only in-scope rows), formula-injection-safe text.
 */
export function toCsv(dataset: ExportDataset): ExportArtifact {
  const lines: string[] = [];

  lines.push(quoteField(dataset.reportTitle));
  if (dataset.organizationName) lines.push(quoteField(`Organización: ${dataset.organizationName}`));
  lines.push(quoteField(`Generado: ${dataset.generatedAt.toISOString()}`));
  if (dataset.appliedFilters) {
    for (const [k, v] of Object.entries(dataset.appliedFilters)) {
      lines.push(quoteField(`${k}: ${v}`));
    }
  }
  lines.push('');

  lines.push(dataset.columns.map((c) => quoteField(sanitizeCsvText(c.header))).join(','));

  for (const row of dataset.rows) {
    lines.push(dataset.columns.map((c) => formatCell(row[c.key], c.type)).join(','));
  }

  if (dataset.summary) {
    lines.push(dataset.columns.map((c) => formatCell(dataset.summary![c.key], c.type)).join(','));
  }

  const body = Buffer.from(UTF8_BOM + lines.join('\r\n'), 'utf8');
  return {
    filename: safeFilename(dataset.baseFilename, 'csv'),
    contentType: 'text/csv; charset=utf-8',
    body,
  };
}
