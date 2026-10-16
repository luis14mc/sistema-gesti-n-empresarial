import type { OficioStatus, OficioType } from '@prisma/client';

export const OFICIO_IMPORT_HEADERS = [
  'Número de oficio*',
  'Tipo* (Entrada/Salida/Interno)',
  'Fecha del oficio*',
  'Fecha de recepción',
  'Fecha de envío',
  'Dependencia*',
  'Institución',
  'Remitente',
  'Cargo remitente',
  'Destinatario',
  'Cargo destinatario',
  'Asunto*',
  'Estado',
  'Elaborado por',
  'Responsable (correo o código de empleado)',
  'Con copia',
  'Observaciones',
] as const;

export const OFICIO_IMPORT_SHEET = 'Correspondencia';
export const OFICIO_IMPORT_CATALOG_SHEET = 'Catálogos';

export const OFICIO_EXCEL_TYPES = ['Entrada', 'Salida', 'Interno'] as const;
export const OFICIO_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const OFICIO_IMPORT_MAX_ROWS = 2000;
export const OFICIO_IMPORT_CHUNK_SIZE = 200;

export type OficioImportRowStatus = 'ok' | 'error' | 'duplicate';

export interface OficioImportParsedRow {
  row: number;
  number: string;
  type: OficioType;
  oficioDate: Date;
  receivedDate?: Date;
  sentDate?: Date;
  dependency: string;
  institution?: string;
  senderName?: string;
  senderPosition?: string;
  recipientName?: string;
  recipientPosition?: string;
  subject: string;
  status: OficioStatus;
  preparedBy?: string;
  responsibleRef?: string;
  responsibleEmployeeId?: string;
  cc?: string;
  comments?: string;
  sequenceYear: number;
  warnings: string[];
}

export interface OficioImportRowPreview {
  row: number;
  status: OficioImportRowStatus;
  number?: string;
  errors?: Array<{ field: string; message: string }>;
  duplicateOf?: { id: string; number: string };
  parsed?: Omit<OficioImportParsedRow, 'row'>;
  warnings?: string[];
}

export interface OficioImportNumberingSummary {
  key: string;
  dependency: string;
  year: number;
  maxImportedSequence: number;
  /** Confirmed last used sequence (≥ maxImportedSequence); persisted as lastGeneratedSequence. */
  lastUsedSequence: number;
  lastImportedNumber: string;
  nextOficioNumber: string;
  pattern?: string;
  patternWarnings: string[];
  configCreated?: boolean;
}

export interface OficioImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  rows: OficioImportRowPreview[];
  numbering: OficioImportNumberingSummary[];
}

export type OficioImportDuplicatePolicy = 'skip' | 'import';
