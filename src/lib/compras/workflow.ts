import type { CompraEstado } from '@prisma/client';
import type { Role } from '@/types';

export type CompraWorkflowAction =
  | 'enviar'
  | 'autorizar'
  | 'rechazar_jefe'
  | 'aprobar'
  | 'rechazar_gerencia'
  | 'emitir_orden'
  | 'cerrar'
  | 'anular';

const TRANSITIONS: Record<CompraWorkflowAction, { from: CompraEstado[]; to: CompraEstado }> = {
  enviar: {
    from: ['BORRADOR'],
    to: 'PENDIENTE_AUTORIZACION_JEFE',
  },
  autorizar: {
    from: ['PENDIENTE_AUTORIZACION_JEFE', 'ENVIADA'],
    to: 'PENDIENTE_APROBACION_GERENCIA',
  },
  rechazar_jefe: {
    from: ['PENDIENTE_AUTORIZACION_JEFE', 'ENVIADA'],
    to: 'RECHAZADA_JEFE',
  },
  aprobar: {
    from: ['PENDIENTE_APROBACION_GERENCIA', 'AUTORIZADA_JEFE'],
    to: 'PENDIENTE_COMPRAS',
  },
  rechazar_gerencia: {
    from: ['PENDIENTE_APROBACION_GERENCIA', 'AUTORIZADA_JEFE'],
    to: 'RECHAZADA_GERENCIA',
  },
  emitir_orden: {
    from: ['PENDIENTE_COMPRAS', 'APROBADA_GERENCIA'],
    to: 'ORDEN_EMITIDA',
  },
  cerrar: {
    from: ['ORDEN_EMITIDA', 'RECIBIDA'],
    to: 'CERRADA',
  },
  anular: {
    from: [
      'BORRADOR',
      'ENVIADA',
      'PENDIENTE_AUTORIZACION_JEFE',
      'AUTORIZADA_JEFE',
      'PENDIENTE_APROBACION_GERENCIA',
      'APROBADA_GERENCIA',
      'PENDIENTE_COMPRAS',
    ],
    to: 'ANULADA',
  },
};

export function getNextEstado(
  action: CompraWorkflowAction,
  current: CompraEstado
): CompraEstado | null {
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(current)) return null;
  return transition.to;
}

export function canPerformCompraAction(
  role: Role,
  action: CompraWorkflowAction,
  estado: CompraEstado,
  opts?: {
    isOwner?: boolean;
    sameDepartment?: boolean;
  }
): boolean {
  if (getNextEstado(action, estado) === null) return false;

  switch (action) {
    case 'enviar':
      return opts?.isOwner === true && ['ADMIN', 'IT', 'RRHH'].includes(role);
    case 'autorizar':
    case 'rechazar_jefe':
      return role === 'ADMIN' || (role === 'RRHH' && opts?.sameDepartment === true);
    case 'aprobar':
    case 'rechazar_gerencia':
      return role === 'ADMIN';
    case 'emitir_orden':
    case 'cerrar':
      return role === 'ADMIN' || role === 'IT';
    case 'anular':
      return role === 'ADMIN' || (opts?.isOwner === true && estado === 'BORRADOR');
    default:
      return false;
  }
}

const ESTADOS_SIN_REGENERACION = new Set<CompraEstado>([
  'ORDEN_EMITIDA',
  'RECIBIDA',
  'CERRADA',
  'ANULADA',
]);

export function canRegenerateCompraDocument(
  estado: CompraEstado,
  role: Role,
  isOwner: boolean
): boolean {
  if (ESTADOS_SIN_REGENERACION.has(estado)) return role === 'ADMIN';
  if (estado === 'BORRADOR') return isOwner || role === 'ADMIN';
  return role === 'ADMIN' || role === 'IT' || (role === 'RRHH' && isOwner);
}

export function getCompraActionLabel(action: CompraWorkflowAction): string {
  const labels: Record<CompraWorkflowAction, string> = {
    enviar: 'Enviar solicitud',
    autorizar: 'Autorizar',
    rechazar_jefe: 'Rechazar (jefe)',
    aprobar: 'Aprobar',
    rechazar_gerencia: 'Rechazar (gerencia)',
    emitir_orden: 'Emitir orden',
    cerrar: 'Cerrar compra',
    anular: 'Anular',
  };
  return labels[action];
}
