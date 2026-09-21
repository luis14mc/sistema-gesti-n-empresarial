import type { OficioStatus } from '@/types';

/**
 * Single source of truth for oficios status transitions.
 * Supports both legacy statuses and institutional incoming/outgoing workflow.
 */
export const OFICIO_STATUS_TRANSITIONS: Record<OficioStatus, readonly OficioStatus[]> = {
  DRAFT: ['PENDING_SIGNATURE', 'SENT', 'ARCHIVED'],
  PENDING_SIGNATURE: ['SIGNED', 'DRAFT', 'ARCHIVED'],
  SIGNED: ['SENT', 'ARCHIVED'],
  SENT: ['ACKNOWLEDGED', 'RECEIVED', 'IN_PROCESS', 'RESPONDED', 'ARCHIVED'],
  ACKNOWLEDGED: ['ARCHIVED', 'RESPONDED'],
  RECEIVED: ['ASSIGNED', 'IN_PROCESS', 'RESPONDED', 'COMPLETED', 'ARCHIVED'],
  ASSIGNED: ['IN_PROCESS', 'RESPONDED', 'COMPLETED', 'ARCHIVED'],
  IN_PROCESS: ['RESPONDED', 'COMPLETED', 'ARCHIVED'],
  RESPONDED: ['COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
} as const;

export const OFICIO_STATUS_LABELS: Record<OficioStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_SIGNATURE: 'Pendiente de firma',
  SIGNED: 'Firmado',
  SENT: 'Enviado',
  ACKNOWLEDGED: 'Acuse recibido',
  RECEIVED: 'Recibido',
  ASSIGNED: 'Asignado',
  IN_PROCESS: 'En proceso',
  RESPONDED: 'Respondido',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
} as const;

export const OFICIO_INCOMING_STATUSES: readonly OficioStatus[] = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROCESS',
  'RESPONDED',
  'ARCHIVED',
];

export const OFICIO_OUTGOING_STATUSES: readonly OficioStatus[] = [
  'DRAFT',
  'PENDING_SIGNATURE',
  'SIGNED',
  'SENT',
  'ACKNOWLEDGED',
  'ARCHIVED',
];

/** Estados terminales: no permiten transiciones salientes. */
export const OFICIO_TERMINAL_STATUSES: OficioStatus[] = ['ARCHIVED'];

/** Estados que aún permiten edición libre del oficio. */
export const OFICIO_EDITABLE_STATUSES: OficioStatus[] = ['DRAFT'];

export function isValidOficioStatusTransition(
  current: OficioStatus,
  next: OficioStatus,
): boolean {
  if (current === next) return false;
  const allowed = OFICIO_STATUS_TRANSITIONS[current];
  return allowed?.includes(next) ?? false;
}

export function getNextOficioStatuses(current: OficioStatus): readonly OficioStatus[] {
  return OFICIO_STATUS_TRANSITIONS[current] ?? [];
}
