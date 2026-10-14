import type { PurchaseOrderStatus } from '@prisma/client';
import type { Role } from '@/types';
import type { OrganizationRole, Permission } from '@/platform/security/authorization/permissions';
import { canForOrganization } from '@/platform/security/authorization/effective-permissions';

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

export type OrdenActionContext = {
  isCreator?: boolean;
  status?: PurchaseOrderStatus;
};

export type OrdenActionAuth = {
  userId: string;
  organizationId: string;
  organizationRole: OrganizationRole;
};

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

export function permissionsForOrdenAction(action: OrderAction): readonly Permission[] {
  switch (action) {
    case 'read':
    case 'historial':
    case 'documentos':
      return ['purchase-orders.read'];
    case 'create':
      return ['purchase-orders.create'];
    case 'update':
      return ['purchase-orders.update'];
    case 'delete':
    case 'anular':
      return ['purchase-orders.cancel'];
    case 'generar':
    case 'regenerar_pdf':
      return ['purchase-orders.generate'];
    case 'emitir':
    case 'cerrar':
      return ['purchase-orders.approve'];
    case 'template':
      return ['organizations.manage'];
    default:
      return [];
  }
}

function ordenWorkflowAllows(
  role: Role,
  action: OrderAction,
  ctx: OrdenActionContext,
): boolean {
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

  if (action === 'emitir') {
    if (ctx.status && ctx.status !== 'GENERATED') return false;
    return role === 'ADMIN' || role === 'OWNER' || role === 'ADMINISTRACION';
  }

  if (action === 'cerrar') {
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

/** Session-role matrix + workflow (client UI; no per-user overrides). */
export function canOrdenActionByRole(
  role: Role,
  action: OrderAction,
  ctx: OrdenActionContext = {},
): boolean {
  if (!MATRIX[role]?.includes(action)) return false;
  return ordenWorkflowAllows(role, action, ctx);
}

/** Role matrix or effective org permission + workflow when `auth` is set. */
export async function canOrdenAction(
  role: Role,
  action: OrderAction,
  ctx: OrdenActionContext = {},
  auth?: OrdenActionAuth,
): Promise<boolean> {
  if (auth) {
    for (const permission of permissionsForOrdenAction(action)) {
      const allowed = await canForOrganization(
        auth.userId,
        auth.organizationId,
        auth.organizationRole,
        permission,
      );
      if (!allowed) return false;
    }
    return ordenWorkflowAllows(role, action, ctx);
  }
  return canOrdenActionByRole(role, action, ctx);
}

export function ordenActionAuthFromContext(context: {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
}): OrdenActionAuth {
  return {
    userId: context.userId,
    organizationId: context.organizationId,
    organizationRole: context.role,
  };
}
