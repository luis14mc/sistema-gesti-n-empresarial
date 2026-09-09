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

const MATRIX: Record<string, OrderAction[]> = {
  ADMIN: ['read', 'create', 'update', 'delete', 'generar', 'emitir', 'anular', 'cerrar', 'regenerar_pdf', 'documentos', 'historial', 'template'],
  OWNER: ['read', 'create', 'update', 'delete', 'generar', 'emitir', 'anular', 'cerrar', 'regenerar_pdf', 'documentos', 'historial', 'template'],
  ADMINISTRACION: ['read', 'create', 'update', 'delete', 'generar', 'emitir', 'anular', 'cerrar', 'regenerar_pdf', 'documentos', 'historial'],
  PROCUREMENT: ['read', 'create', 'update', 'delete', 'generar', 'documentos', 'historial'],
  IT: ['read'],
  IT_MANAGER: ['read'],
  RRHH: ['read', 'create', 'update', 'delete', 'historial'],
  USER: ['read'],
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
    return role === 'ADMIN' || role === 'OWNER' || role === 'ADMINISTRACION';
  }

  if (action === 'emitir' || action === 'cerrar') {
    return role === 'ADMIN' || role === 'OWNER' || role === 'ADMINISTRACION';
  }

  if (action === 'template') {
    return role === 'ADMIN' || role === 'OWNER';
  }

  if (action === 'read' || action === 'historial' || action === 'documentos') {
    if (role === 'USER') return !!ctx.isCreator;
    return true;
  }

  return true;
}
