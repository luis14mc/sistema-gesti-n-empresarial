// ============================================
// OFICIOS — Numeración institucional configurable
// ============================================

export type OficioScope = 'INTERNO' | 'CNI' | 'DESPACHO';
export type OficioDependency = OficioScope;
export type OficioDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL_MEMO';

export const OFICIO_DEPENDENCY_LABELS: Record<OficioDependency, string> = {
  INTERNO: 'Internos / Memos',
  CNI: 'CNI',
  DESPACHO: 'Despacho de Promoción de Inversiones',
};

/** @deprecated Prefer OFICIO_DEPENDENCY_LABELS — kept for existing UI imports */
export const OFICIO_SCOPE_LABELS = OFICIO_DEPENDENCY_LABELS;

export const OFICIO_DIRECTION_LABELS: Record<OficioDirection, string> = {
  INCOMING: 'Entrada',
  OUTGOING: 'Salida',
  INTERNAL_MEMO: 'Memo interno',
};

export const OFICIO_DOCUMENT_KINDS = [
  'OFICIO',
  'NOTA',
  'MEMORANDO',
  'CIRCULAR',
  'CARTA',
  'OTRO',
] as const;

export type OficioDocumentKind = (typeof OFICIO_DOCUMENT_KINDS)[number];

export const OFICIO_DOCUMENT_KIND_LABELS: Record<OficioDocumentKind, string> = {
  OFICIO: 'Oficio',
  NOTA: 'Nota',
  MEMORANDO: 'Memorando',
  CIRCULAR: 'Circular',
  CARTA: 'Carta',
  OTRO: 'Otro',
};

export const NUMBERING_PLACEHOLDERS = ['{NUMERO}', '{AÑO}', '{PREFIJO}'] as const;

export const DEFAULT_NUMBERING_PATTERNS: Record<OficioDependency, string> = {
  CNI: 'CNI-{NUMERO}-{AÑO}',
  DESPACHO: 'DPICP-{NUMERO}-{AÑO}',
  INTERNO: 'MEMO-{NUMERO}-{AÑO}',
};

export const DEFAULT_NUMBERING_PREFIXES: Record<OficioDependency, string> = {
  CNI: 'CNI',
  DESPACHO: 'DPICP',
  INTERNO: 'MEMO',
};

export function normalizeOficioScope(value?: string | null): OficioScope {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'DESPACHO' || normalized === 'DPICP') return 'DESPACHO';
  if (
    normalized === 'INTERNO' ||
    normalized === 'INTERNAL' ||
    normalized === 'MEMO' ||
    normalized === 'INTERNAL_MEMO'
  ) {
    return 'INTERNO';
  }

  return 'CNI';
}

export const normalizeOficioDependency = normalizeOficioScope;

export function normalizeOficioDirection(
  value?: string | null,
  scope?: OficioScope,
): OficioDirection {
  const normalized = value?.trim().toUpperCase();

  if (scope === 'INTERNO') return 'INTERNAL_MEMO';
  if (normalized === 'INCOMING' || normalized === 'INGRESADO' || normalized === 'RECIBIDO' || normalized === 'ENTRADA') {
    return 'INCOMING';
  }
  if (normalized === 'INTERNAL' || normalized === 'INTERNAL_MEMO' || normalized === 'MEMO') {
    return 'INTERNAL_MEMO';
  }

  return 'OUTGOING';
}

export function shouldGenerateOficioNumber(direction: OficioDirection): boolean {
  return direction === 'OUTGOING' || direction === 'INTERNAL_MEMO';
}

export function normalizeOficioDocumentKind(value?: string | null): OficioDocumentKind {
  const normalized = value?.trim().toUpperCase();
  if (normalized && (OFICIO_DOCUMENT_KINDS as readonly string[]).includes(normalized)) {
    return normalized as OficioDocumentKind;
  }
  return 'OFICIO';
}

export type PatternValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates a nomenclature pattern.
 * Must include {NUMERO}. Unknown placeholders are rejected.
 * {AÑO} is recommended but not strictly required.
 */
export function validateNomenclaturePattern(pattern: string): PatternValidationResult {
  const trimmed = pattern?.trim() ?? '';
  if (!trimmed) {
    return { valid: false, error: 'El patrón de nomenclatura es obligatorio.' };
  }
  if (trimmed.length > 80) {
    return { valid: false, error: 'El patrón no puede exceder 80 caracteres.' };
  }
  if (!trimmed.includes('{NUMERO}')) {
    return { valid: false, error: 'El patrón debe incluir el marcador {NUMERO}.' };
  }

  const placeholders = trimmed.match(/\{[A-ZÁÉÍÓÚÑ_]+\}/g) ?? [];
  const allowed = new Set(NUMBERING_PLACEHOLDERS);
  for (const token of placeholders) {
    if (!allowed.has(token as (typeof NUMBERING_PLACEHOLDERS)[number])) {
      return {
        valid: false,
        error: `Marcador no permitido: ${token}. Use ${NUMBERING_PLACEHOLDERS.join(', ')}.`,
      };
    }
  }

  return { valid: true };
}

export function applyNomenclaturePattern(params: {
  pattern: string;
  sequence: number;
  year: number;
  prefix?: string | null;
  sequencePadding?: number | null;
}): string {
  const validation = validateNomenclaturePattern(params.pattern);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const padding = Math.max(0, Math.min(params.sequencePadding ?? 0, 8));
  const numero =
    padding > 0
      ? params.sequence.toString().padStart(padding, '0')
      : params.sequence.toString();

  return params.pattern
    .replaceAll('{NUMERO}', numero)
    .replaceAll('{AÑO}', String(params.year))
    .replaceAll('{PREFIJO}', params.prefix?.trim() || '');
}

export function previewNextNumber(params: {
  pattern: string;
  lastGeneratedSequence: number;
  year: number;
  prefix?: string | null;
  sequencePadding?: number | null;
}): string {
  return applyNomenclaturePattern({
    ...params,
    sequence: params.lastGeneratedSequence + 1,
  });
}

/**
 * Legacy hardcoded formatter — kept for tests/backward compatibility when
 * no numbering config exists yet. Prefer applyNomenclaturePattern via config.
 */
export function formatOficioNumber(params: {
  scope: OficioScope;
  direction: OficioDirection;
  sequence: number;
  year: number;
  sequencePadding?: number;
}): string {
  if (params.direction === 'INCOMING') {
    throw new Error('Los oficios ingresados conservan la nomenclatura de la institución remitente.');
  }

  const pattern = DEFAULT_NUMBERING_PATTERNS[params.scope];
  const prefix = DEFAULT_NUMBERING_PREFIXES[params.scope];
  return applyNomenclaturePattern({
    pattern,
    sequence: params.sequence,
    year: params.year,
    prefix,
    sequencePadding: params.sequencePadding ?? 0,
  });
}

/**
 * Extracts the sequence integer from a generated document number given a pattern.
 * Falls back to the first numeric segment that is not a 4-digit year.
 */
export function parseOficioSequence(number: string, year?: number): number {
  const parts = number.split(/[-_/]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (!/^\d+$/.test(part)) continue;
    const value = Number.parseInt(part, 10);
    if (Number.isNaN(value)) continue;
    if (year != null && value === year) continue;
    if (part.length === 4 && value >= 1990 && value <= 2100) continue;
    return value;
  }
  return 0;
}

export const OFICIO_SCOPE_PATHS: Record<OficioScope, string> = {
  INTERNO: '/oficios/internos',
  CNI: '/oficios/cni',
  DESPACHO: '/oficios/despacho',
};

export const OFICIO_PATH_TO_SCOPE: Record<string, OficioScope> = {
  internos: 'INTERNO',
  cni: 'CNI',
  despacho: 'DESPACHO',
};

/** Texto informativo cuando el número se genera automáticamente. */
export function getAutoNumberHint(scope: OficioScope, direction: OficioDirection): string | null {
  if (direction === 'INCOMING') return null;
  const pattern = DEFAULT_NUMBERING_PATTERNS[scope];
  const prefix = DEFAULT_NUMBERING_PREFIXES[scope];
  const year = new Date().getFullYear();
  return `Se generará automáticamente: ${applyNomenclaturePattern({
    pattern,
    sequence: 1,
    year,
    prefix,
    sequencePadding: 0,
  })}`;
}
