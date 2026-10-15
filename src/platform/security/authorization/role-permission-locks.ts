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
