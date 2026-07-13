import type { OficioScope, OficioDirection } from '@/lib/oficios-numbering';
import { decodeOficioMeta } from '@/lib/oficios-meta';
import type { Oficio } from '@/types';

export interface ResolvedOficioFields {
  recipient: string;
  institution: string;
  preparedBy: string;
}

/** Resuelve campos institucionales con fallback a metadata legacy en comments. */
export function resolveOficioFields(oficio: Oficio): ResolvedOficioFields {
  const meta = decodeOficioMeta(oficio.comments);

  const recipient =
    oficio.recipient?.trim() ||
    (meta as { destinatario?: string } | null)?.destinatario?.trim() ||
    '—';

  const institution =
    oficio.institution?.trim() ||
    meta?.externalInstitution?.trim() ||
    (meta as { institucion?: string } | null)?.institucion?.trim() ||
    '—';

  const preparedBy =
    oficio.preparedBy?.trim() ||
    (meta as { elaboradoPor?: string } | null)?.elaboradoPor?.trim() ||
    (oficio.createdBy
      ? `${oficio.createdBy.firstName} ${oficio.createdBy.lastName}`.trim()
      : '—');

  return { recipient, institution, preparedBy };
}

export function getInstitutionLabel(scope: OficioScope, direction: OficioDirection): string {
  if (direction === 'INCOMING') return 'Institución remitente *';
  if (direction === 'INTERNAL_MEMO') return 'Institución / Unidad *';
  return 'Institución destinataria *';
}

export function getInstitutionPlaceholder(scope: OficioScope, direction: OficioDirection): string {
  if (direction === 'INCOMING') return 'Nombre de la institución emisora';
  if (direction === 'INTERNAL_MEMO') return 'Ej. CNI / Unidad interna';
  return 'Institución a la que se dirige el oficio';
}
