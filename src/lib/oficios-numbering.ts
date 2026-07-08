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

export function getOficioNumberPrefix(scope: OficioScope, direction: OficioDirection): string {
  if (direction === 'INCOMING') {
    return scope === 'DESPACHO' ? 'ING-DPICP' : 'ING-CNI';
  }

  if (direction === 'INTERNAL_MEMO') return 'MEMO';

  return scope === 'DESPACHO' ? 'DPICP' : 'CNI';
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

  const prefix = getOficioNumberPrefix(params.scope, params.direction);
  return `${prefix}-${sequence}-${params.year}`;
}

export function parseOficioSequence(number: string): number {
  const match = number.match(/(\d{4})/);
  if (!match) return 0;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}
