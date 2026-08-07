import type { OficioStatus } from '@/types';

/**
 * Single source of truth para transiciones de estado de oficios.
 *
 * Antes había dos definiciones divergentes en:
 * - `src/app/oficios/[id]/page.tsx` (STATUS_NEXT)
 * - `src/components/oficios/OficiosScopePage.tsx` (STATUS_TRANSITIONS)
 *
 * Ambas se consolidan aquí para evitar inconsistencias entre UI y backend.
 * La validación server-side en `/api/oficios/[id]/status` aplica la misma matriz.
 */
export const OFICIO_STATUS_TRANSITIONS: Record<OficioStatus, readonly OficioStatus[]> = {
  DRAFT: ['SENT', 'ARCHIVED'],
  SENT: ['RECEIVED', 'IN_PROCESS'],
  RECEIVED: ['IN_PROCESS', 'COMPLETED'],
  IN_PROCESS: ['COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
} as const;

export const OFICIO_STATUS_LABELS: Record<OficioStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  RECEIVED: 'Recibido',
  IN_PROCESS: 'En proceso',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
} as const;

/** Estados terminales: no permiten transiciones salientes. */
export const OFICIO_TERMINAL_STATUSES: OficioStatus[] = ['ARCHIVED'];

/** Estados que aún permiten edición libre del oficio. */
export const OFICIO_EDITABLE_STATUSES: OficioStatus[] = ['DRAFT'];

/**
 * Verifica si una transición `current → next` es válida.
 */
export function isValidOficioStatusTransition(
  current: OficioStatus,
  next: OficioStatus
): boolean {
  if (current === next) return false;
  const allowed = OFICIO_STATUS_TRANSITIONS[current];
  return allowed?.includes(next) ?? false;
}

/**
 * Retorna los estados a los que se puede transicionar desde el estado actual.
 */
export function getNextOficioStatuses(current: OficioStatus): readonly OficioStatus[] {
  return OFICIO_STATUS_TRANSITIONS[current] ?? [];
}
