// ============================================
// OFICIOS — Nomenclatura oficial CNI / Despacho / Memos
// ============================================

export type OficioScope = 'INTERNO' | 'CNI' | 'DESPACHO';
export type OficioDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL_MEMO';

export const OFICIO_SCOPE_LABELS: Record<OficioScope, string> = {
  INTERNO: 'Internos / Memos',
  CNI: 'Externos CNI',
  DESPACHO: 'Externos Despacho',
};

export const OFICIO_DIRECTION_LABELS: Record<OficioDirection, string> = {
  INCOMING: 'Ingresado',
  OUTGOING: 'Enviado',
  INTERNAL_MEMO: 'Memo interno',
};

export function normalizeOficioScope(value?: string | null): OficioScope {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'DESPACHO' || normalized === 'DPICP') return 'DESPACHO';
  if (normalized === 'INTERNO' || normalized === 'INTERNAL' || normalized === 'MEMO' || normalized === 'INTERNAL_MEMO') return 'INTERNO';

  return 'CNI';
}

export function normalizeOficioDirection(value?: string | null, scope?: OficioScope): OficioDirection {
  const normalized = value?.trim().toUpperCase();

  if (scope === 'INTERNO') return 'INTERNAL_MEMO';
  if (normalized === 'INCOMING' || normalized === 'INGRESADO' || normalized === 'RECIBIDO') return 'INCOMING';
  if (normalized === 'INTERNAL' || normalized === 'INTERNAL_MEMO' || normalized === 'MEMO') return 'INTERNAL_MEMO';

  return 'OUTGOING';
}

export function shouldGenerateOficioNumber(direction: OficioDirection): boolean {
  return direction === 'OUTGOING' || direction === 'INTERNAL_MEMO';
}

export function formatOficioNumber(params: {
  scope: OficioScope;
  direction: OficioDirection;
  sequence: number;
  year: number;
}): string {
  const sequence = params.sequence.toString().padStart(4, '0');

  if (params.direction === 'OUTGOING' && params.scope === 'DESPACHO') {
    return `DPICP-${sequence}-${params.year}`;
  }

  if (params.direction === 'OUTGOING' && params.scope === 'CNI') {
    return `${sequence}-CNI-${params.year}`;
  }

  if (params.direction === 'INTERNAL_MEMO') {
    return `MEMO-${sequence}-${params.year}`;
  }

  throw new Error('Los oficios ingresados conservan la nomenclatura de la institución remitente.');
}

export function parseOficioSequence(number: string): number {
  const match = number.match(/(\d{4})/);
  if (!match) return 0;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  if (direction === 'INTERNAL_MEMO') return 'Se generará automáticamente: MEMO-0001-2026';
  if (scope === 'CNI') return 'Se generará automáticamente: 0001-CNI-2026';
  if (scope === 'DESPACHO') return 'Se generará automáticamente: DPICP-0001-2026';
  return null;
}
