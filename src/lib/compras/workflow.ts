import type { CompraEstado } from '@prisma/client';
import type { Role } from '@/types';

export type CompraWorkflowAction =
  | 'enviar'
  | 'autorizar'
  | 'aprobar'
  | 'rechazar'
  | 'emitir_orden'
  | 'recibir'
  | 'cerrar'
  | 'anular';

const TRANSITIONS: Record<CompraWorkflowAction, { from: CompraEstado[]; to: CompraEstado }> = {
  enviar: { from: ['BORRADOR'], to: 'ENVIADA' },
  autorizar: { from: ['ENVIADA'], to: 'AUTORIZADA' },
  aprobar: { from: ['AUTORIZADA'], to: 'APROBADA' },
  rechazar: { from: ['ENVIADA', 'AUTORIZADA'], to: 'RECHAZADA' },
  emitir_orden: { from: ['APROBADA'], to: 'ORDEN_EMITIDA' },
  recibir: { from: ['ORDEN_EMITIDA'], to: 'RECIBIDA' },
  cerrar: { from: ['RECIBIDA'], to: 'CERRADA' },
  anular: { from: ['BORRADOR', 'ENVIADA', 'AUTORIZADA', 'APROBADA'], to: 'ANULADA' },
};

export function getNextEstado(action: CompraWorkflowAction, current: CompraEstado): CompraEstado | null {
  const rule = TRANSITIONS[action];
  if (!rule?.from.includes(current)) return null;
  return rule.to;
}

export function canPerformCompraAction(
  role: Role,
  action: CompraWorkflowAction,
  estado: CompraEstado,
  ctx: { isOwner?: boolean; sameDepartment?: boolean } = {}
): boolean {
  if (getNextEstado(action, estado) === null) return false;

  switch (action) {
    case 'enviar':
      return !!ctx.isOwner || role === 'ADMIN' || role === 'IT';
    case 'autorizar':
    case 'rechazar':
      return role === 'ADMIN' || (role === 'RRHH' && !!ctx.sameDepartment);
    case 'aprobar':
      return role === 'ADMIN';
    case 'emitir_orden':
    case 'recibir':
    case 'cerrar':
      return role === 'ADMIN' || role === 'IT';
    case 'anular':
      return role === 'ADMIN' || (estado === 'BORRADOR' && !!ctx.isOwner);
    default:
      return false;
  }
}

export const COMPRA_ACTION_LABELS: Record<CompraWorkflowAction, string> = {
  enviar: 'Enviar solicitud',
  autorizar: 'Autorizar (Jefe)',
  aprobar: 'Aprobar (Gerencia)',
  rechazar: 'Rechazar',
  emitir_orden: 'Emitir orden de compra',
  recibir: 'Registrar recepción',
  cerrar: 'Cerrar',
  anular: 'Anular',
};

export function isCompraEditable(estado: CompraEstado): boolean {
  return estado === 'BORRADOR';
}
