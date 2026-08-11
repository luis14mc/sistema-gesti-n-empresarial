/**
 * Phase 13 · Part 2 — shared export contract used by both the CSV and XLSX
 * serializers so a report is described once and rendered identically to any
 * format. Cell TYPE drives formatting and safety: text cells are sanitized
 * against spreadsheet formula injection; numeric/currency/percent/date cells
 * are serialized as real numbers/dates (never stringified).
 */

export type ExportCellType = 'text' | 'number' | 'currency' | 'percent' | 'date';

export interface ExportColumn {
  /** Key into each row object. */
  readonly key: string;
  /** Spanish institutional header shown to users. */
  readonly header: string;
  readonly type: ExportCellType;
  /** Optional fixed width hint (characters) for XLSX. */
  readonly width?: number;
}

export interface ExportDataset {
  /** Institutional report title (e.g. "Resumen de órdenes de compra"). */
  readonly reportTitle: string;
  /** Base filename WITHOUT extension; will be made safe. */
  readonly baseFilename: string;
  readonly organizationName?: string;
  readonly generatedAt: Date;
  /** Human-readable applied filters, e.g. { 'Año': '2026', 'Estado': 'Emitida' }. */
  readonly appliedFilters?: Readonly<Record<string, string>>;
  readonly columns: readonly ExportColumn[];
  readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  /** Optional summary row appended at the bottom (keyed by column key). */
  readonly summary?: Readonly<Record<string, unknown>>;
  /** ISO currency-ish symbol for currency cells (default 'L' — Lempira). */
  readonly currencySymbol?: string;
}

export interface ExportArtifact {
  readonly filename: string;
  readonly contentType: string;
  /** Raw bytes (a Node Buffer, typed as Uint8Array for web BodyInit compat). */
  readonly body: Uint8Array;
}

/** Make a filesystem/header-safe filename (no path, no control/special chars). */
export function safeFilename(base: string, extension: string): string {
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'reporte';
  return `${cleaned}.${extension}`;
}
