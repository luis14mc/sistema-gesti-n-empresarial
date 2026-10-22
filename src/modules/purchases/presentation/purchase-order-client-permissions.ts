'use client';

import { useAuth } from '@/hooks/useAuth';
import type { Permission } from '@/platform/security/authorization/permissions';
import {
  canOrdenAction,
  type OrderAction,
} from '@/modules/purchases/domain/purchase-order-permissions';
import type { PurchaseOrderStatus } from '@prisma/client';

export function useOrganizationPermissions(): readonly Permission[] {
  const { user } = useAuth();
  return user?.permissions ?? [];
}

export function canCompraOrdenAction(
  permissions: readonly Permission[] | undefined,
  action: OrderAction,
  ctx: {
    isCreator?: boolean;
    status?: PurchaseOrderStatus;
    membershipRole?: import('@/platform/security/authorization/permissions').OrganizationRole;
  } = {},
): boolean {
  if (!permissions?.length) return false;
  return canOrdenAction(permissions, action, ctx);
}

export function useCompraOrdenPermissionContext(isCreator: boolean, status?: PurchaseOrderStatus) {
  const { user } = useAuth();
  const permissions = useOrganizationPermissions();
  const membershipRole = (user?.membershipRole ?? user?.role) as
    | import('@/platform/security/authorization/permissions').OrganizationRole
    | undefined;
  return {
    permissions,
    ctx: { isCreator, status, membershipRole },
  };
}
