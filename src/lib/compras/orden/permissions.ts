import type { PurchaseOrderStatus } from '@prisma/client';
import type { Role } from '@/types';

export type OrderAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'generar'
  | 'emitir'
  | 'anular'
  | 'cerrar'
  | 'regenerar_pdf'
  | 'documentos'
  | 'historial'
  | 'template';

const MATRIX: Record<Role, OrderAction[]> = {
  ADMIN: ['read', 'create', 'update', 'delete', 'generar', 'emitir', 'anular', 'cerrar', 'regenerar_pdf', 'documentos', 'historial', 'template'],
  IT: ['read', 'create', 'update', 'delete', 'generar', 'documentos', 'historial'],
  RRHH: ['read', 'create', 'update', 'delete', 'historial'],
  USER: ['read', 'create', 'update', 'delete', 'historial'],
};

export function canOrdenAction(
  role: Role,
  action: OrderAction,
  ctx: { isCreator?: boolean; status?: PurchaseOrderStatus } = {}
): boolean {
  if (!MATRIX[role]?.includes(action)) return false;

  if (action === 'update') {
    if (ctx.status !== 'DRAFT') return false;
    if (role === 'USER' || role === 'RRHH') return !!ctx.isCreator;
    return true;
  }

  if (action === 'delete') {
    if (ctx.status !== 'DRAFT') return false;
    if (role === 'USER' || role === 'RRHH') return !!ctx.isCreator;
    return true;
  }

  if (['generar', 'regenerar_pdf'].includes(action)) {
    if (role === 'USER' || role === 'RRHH') return !!ctx.isCreator;
    return true;
  }

  if (action === 'anular') {
    if (ctx.status === 'CLOSED') return false;
    return role === 'ADMIN';
  }

  if (action === 'emitir' || action === 'cerrar') {
    return role === 'ADMIN';
  }

  if (action === 'template') {
    return role === 'ADMIN';
  }

  if (action === 'read' || action === 'historial' || action === 'documentos') {
    if (role === 'USER') return !!ctx.isCreator;
    return true;
  }

  return true;
}
