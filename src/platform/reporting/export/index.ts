export type { ExportArtifact, ExportCellType, ExportColumn, ExportDataset } from './types';
export { safeFilename } from './types';
export { toCsv, sanitizeCsvText } from './csv';
export { toXlsx } from './xlsx';

import type { ExportArtifact, ExportDataset } from './types';
import { toCsv } from './csv';
import { toXlsx } from './xlsx';

export type ExportFormat = 'csv' | 'xlsx';

/** Formats this exporter can actually produce today. */
export const SUPPORTED_EXPORT_FORMATS: readonly ExportFormat[] = ['csv', 'xlsx'];

export function isSupportedExportFormat(value: string): value is ExportFormat {
  return (SUPPORTED_EXPORT_FORMATS as readonly string[]).includes(value);
}

/** Maximum rows for a synchronous export (no async job processor exists). */
export const SYNC_EXPORT_ROW_LIMIT = 10_000;

export async function renderExport(
  format: ExportFormat,
  dataset: ExportDataset,
): Promise<ExportArtifact> {
  return format === 'csv' ? toCsv(dataset) : toXlsx(dataset);
}
