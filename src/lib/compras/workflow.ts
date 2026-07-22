import type { CompraEstado } from '@prisma/client';
import type { Role } from '@/types';

export type CompraWorkflowAction =
  | 'generar_orden'
  | 'emitir'
  | 'regenerar_pdf'
  | 'anular'
  | 'cerrar';

const TRANSITIONS: Record<CompraWorkflowAction, { from: CompraEstado[]; to: CompraEstado }> = {
  generar_orden: { from: ['BORRADOR'], to: 'GENERADA' },
  emitir: { from: ['GENERADA'], to: 'EMITIDA' },
  regenerar_pdf: { from: ['EMITIDA'], to: 'EMITIDA' },
  anular: { from: ['BORRADOR', 'GENERADA'], to: 'ANULADA' },
  cerrar: { from: ['EMITIDA'], to: 'CERRADA' },
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
  ctx: { isOwner?: boolean } = {}
): boolean {
  if (getNextEstado(action, estado) === null) return false;

  switch (action) {
    case 'generar_orden':
    case 'emitir':
    case 'regenerar_pdf':
      return !!ctx.isOwner || role === 'ADMIN' || role === 'IT';
    case 'anular':
      return role === 'ADMIN' || (estado === 'BORRADOR' && !!ctx.isOwner);
    case 'cerrar':
      return role === 'ADMIN' || role === 'IT';
    default:
      return false;
  }
}

export const COMPRA_ACTION_LABELS: Record<CompraWorkflowAction, string> = {
  generar_orden: 'Generar orden',
  emitir: 'Crear PDF',
  regenerar_pdf: 'Regenerar PDF',
  anular: 'Anular',
  cerrar: 'Cerrar',
};

export function isCompraEditable(estado: CompraEstado): boolean {
  return estado === 'BORRADOR';
}

export function canPreviewCompra(estado: CompraEstado): boolean {
  return ['GENERADA', 'EMITIDA', 'CERRADA'].includes(estado);
}
