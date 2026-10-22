import type { PurchaseOrderStatus } from '@prisma/client';
import type { OrganizationRole, Permission } from '@/platform/security/authorization/permissions';
import { PURCHASE_ORDER_APPROVE } from '@/platform/security/authorization/permissions';

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

const ACTION_TO_PERMISSION: Record<OrderAction, Permission> = {
  read: 'purchase-orders.read',
  historial: 'purchase-orders.read',
  create: 'purchase-orders.create',
  update: 'purchase-orders.update',
  delete: 'purchase-orders.update',
  documentos: 'purchase-orders.update',
  generar: 'purchase-orders.generate',
  regenerar_pdf: 'purchase-orders.generate',
  emitir: PURCHASE_ORDER_APPROVE,
  cerrar: PURCHASE_ORDER_APPROVE,
  anular: 'purchase-orders.cancel',
  template: PURCHASE_ORDER_APPROVE,
};

export type EffectivePermissions = ReadonlySet<Permission> | readonly Permission[];

/** Lista GET: usuarios USER ven solo las propias (equivalente a ?mine=true). */
export function shouldScopePurchaseOrdersToMine(
  permissions: EffectivePermissions,
  membershipRole?: OrganizationRole,
): boolean {
  return membershipRole === 'USER';
}

function hasPermission(permissions: EffectivePermissions, permission: Permission): boolean {
  if (permissions instanceof Set) return permissions.has(permission);
  return (permissions as readonly Permission[]).includes(permission);
}

function requiresOwnPurchaseOrderForMutations(ctx: {
  membershipRole?: OrganizationRole;
  sessionRole?: string;
}): boolean {
  if (ctx.membershipRole === 'USER' || ctx.membershipRole === 'HR') return true;
  if (ctx.sessionRole === 'RRHH') return true;
  return false;
}

export function canOrdenAction(
  permissions: EffectivePermissions,
  action: OrderAction,
  ctx: {
    isCreator?: boolean;
    status?: PurchaseOrderStatus;
    membershipRole?: OrganizationRole;
    sessionRole?: string;
  } = {},
): boolean {
  const required = ACTION_TO_PERMISSION[action];
  if (!hasPermission(permissions, required)) return false;

  if (action === 'update') {
    if (ctx.status !== 'DRAFT') return false;
    if (requiresOwnPurchaseOrderForMutations(ctx)) return !!ctx.isCreator;
    return true;
  }

  if (action === 'delete') {
    if (ctx.status !== 'DRAFT') return false;
    if (requiresOwnPurchaseOrderForMutations(ctx)) return !!ctx.isCreator;
    return true;
  }

  if (action === 'generar' || action === 'regenerar_pdf') {
    if (requiresOwnPurchaseOrderForMutations(ctx)) return !!ctx.isCreator;
    return true;
  }

  if (action === 'anular') {
    if (ctx.status === 'CLOSED') return false;
    return true;
  }

  if (action === 'emitir') {
    if (ctx.status && ctx.status !== 'GENERATED') return false;
    return true;
  }

  if (action === 'cerrar') {
    if (ctx.status && ctx.status !== 'ISSUED') return false;
    return true;
  }

  if (action === 'read' || action === 'historial' || action === 'documentos') {
    if (ctx.membershipRole === 'USER') return !!ctx.isCreator;
    return true;
  }

  return true;
}
