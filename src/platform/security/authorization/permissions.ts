import { PermissionDeniedError } from '@/platform/domain/errors';
import { ORGANIZATION_PERMISSIONS } from './organization-permission-catalog';
import { OFFICIAL_ROLE_PERMISSIONS } from './official-role-permissions';

export { ORGANIZATION_PERMISSIONS } from './organization-permission-catalog';
export { OFFICIAL_ROLE_PERMISSIONS } from './official-role-permissions';

/** Mirrors DB OrganizationRole enum — defined locally so Edge middleware never pulls the ORM client. */
export const ORGANIZATION_ROLES = [
  'OWNER',
  'ADMIN',
  'ADMINISTRACION',
  'SECRETARIA',
  'IT_MANAGER',
  'IT_TECHNICIAN',
  'PROCUREMENT',
  'HR',
  'AUDITOR',
  'USER',
  'DIRECTOR',
] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const PLATFORM_ROLES = ['PLATFORM_ADMIN', 'SUPPORT_ADMIN'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_PERMISSIONS = [
  'platform.health.read',
  'platform.audit.read',
  'reports.platform',
] as const;

export const PERMISSIONS = [...ORGANIZATION_PERMISSIONS, ...PLATFORM_PERMISSIONS] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Capability required to issue / approve a generated purchase order. */
export const PURCHASE_ORDER_APPROVE: Permission = 'purchase-orders.approve';

export type ScopedRole =
  | Readonly<{ scope: 'organization'; role: OrganizationRole }>
  | Readonly<{ scope: 'platform'; role: PlatformRole }>;

export type PermissionContext =
  | Readonly<{ authorizationScope: 'organization'; userId: string; organizationId: string; role: OrganizationRole }>
  | Readonly<{ authorizationScope: 'platform'; userId: string; role: PlatformRole }>;

const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  PLATFORM_ADMIN: PLATFORM_PERMISSIONS,
  SUPPORT_ADMIN: ['platform.health.read'],
};

export function organizationRole(role: OrganizationRole): ScopedRole {
  return { scope: 'organization', role };
}

export function platformRole(role: PlatformRole): ScopedRole {
  return { scope: 'platform', role };
}

/** Official template matrix — protected RBAC tests depend on this behavior. */
export function can(scopedRole: ScopedRole, permission: Permission): boolean {
  if (!scopedRole || typeof scopedRole !== 'object') return false;
  const permissions = scopedRole.scope === 'organization'
    ? OFFICIAL_ROLE_PERMISSIONS[scopedRole.role]
    : scopedRole.scope === 'platform'
      ? PLATFORM_ROLE_PERMISSIONS[scopedRole.role]
      : undefined;
  return Boolean(permissions?.includes(permission));
}

export function requirePermission(context: PermissionContext, permission: Permission): void {
  const scopedRole = context.authorizationScope === 'organization'
    ? organizationRole(context.role)
    : platformRole(context.role);
  if (!can(scopedRole, permission)) {
    throw new PermissionDeniedError('No tiene permiso para realizar esta operación.', {
      permission,
      scope: context.authorizationScope,
    });
  }
}

export type PermissionOverride = Readonly<{
  permission: Permission;
  effect: 'ALLOW' | 'DENY';
}>;

export type RolePermissionCheck = (permission: Permission) => boolean;

/** Applies user exceptions after role defaults. DENY always wins. */
export function canWithOverrides(
  scopedRole: ScopedRole,
  permission: Permission,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): boolean {
  const matching = overrides.filter((override) => override.permission === permission);
  if (matching.some((override) => override.effect === 'DENY')) return false;
  if (matching.some((override) => override.effect === 'ALLOW')) return true;
  if (roleHas) return roleHas(permission);
  return can(scopedRole, permission);
}
