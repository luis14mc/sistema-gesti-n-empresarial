import type { OrganizationRole, Permission } from './permissions';

const USER_ADMIN_PERMISSIONS = [
  'users.read',
  'users.create',
  'users.update',
  'users.deactivate',
  'roles.manage',
] as const satisfies readonly Permission[];

export function lockedPermissionsForRole(role: OrganizationRole): readonly Permission[] {
  if (role === 'OWNER' || role === 'ADMIN') return USER_ADMIN_PERMISSIONS;
  return [];
}

export function applyLockedPermissions(role: OrganizationRole, permissions: Set<Permission>): void {
  for (const permission of lockedPermissionsForRole(role)) {
    permissions.add(permission);
  }
}

export function findMissingLockedPermissions(
  role: OrganizationRole,
  permissions: readonly Permission[],
): Permission[] {
  const set = new Set(permissions);
  return lockedPermissionsForRole(role).filter((permission) => !set.has(permission));
}

export const LOCKED_ADMIN_PERMISSIONS = USER_ADMIN_PERMISSIONS;

export function findDenyOverridesOnLockedPermissions(
  role: OrganizationRole,
  overrides: readonly { permission: Permission; effect: 'ALLOW' | 'DENY' }[],
): Permission[] {
  const locked = new Set(lockedPermissionsForRole(role));
  if (!locked.size) return [];
  return overrides
    .filter((o) => o.effect === 'DENY' && locked.has(o.permission))
    .map((o) => o.permission);
}

export function isLockedPermissionForRole(role: OrganizationRole, permission: Permission): boolean {
  return lockedPermissionsForRole(role).includes(permission);
}
