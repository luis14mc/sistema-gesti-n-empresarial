import { createAuditRecord } from '@/lib/audit';
import {
  LockedPermissionsMissingError,
  RoleMustHavePermissionsError,
} from '@/modules/users/domain/errors';
import {
  countActiveMembersByRole,
  replaceRolePermissions,
} from '@/modules/users/infrastructure/role-repository';
import type { RolePermissionsPutInput } from '@/modules/users/presentation/schemas/users';
import {
  applyLockedPermissions,
  findMissingLockedPermissions,
} from '@/platform/security/authorization/role-permission-locks';
import {
  effectivePermissionSetForRole,
  isRoleMatrixModified,
  loadOrganizationRolePermissionMap,
  loadOrganizationRolePermissionMapUncached,
} from '@/platform/security/authorization/role-permission-service';
import { buildRoleModuleMatrix, permissionsFromRoleModuleRows } from '@/platform/security/role-permission-matrix';
import { normalizeModuleRow } from '@/platform/security/modules';
import { normalizeDesiredRow } from '@/platform/security/module-effective';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';

export async function getRolePermissionsUseCase(params: {
  organizationId: string;
  role: OrganizationRole;
}) {
  const roleMap = await loadOrganizationRolePermissionMap(params.organizationId);
  const memberCount = await countActiveMembersByRole(params.organizationId, params.role);

  return {
    role: params.role,
    memberCount,
    modified: isRoleMatrixModified(params.role, roleMap),
    moduleAccess: buildRoleModuleMatrix(params.role, roleMap),
  };
}

export async function putRolePermissionsUseCase(params: {
  organizationId: string;
  actorUserId: string;
  role: OrganizationRole;
  body: RolePermissionsPutInput;
}) {
  const { organizationId, actorUserId, role, body } = params;

  const normalizedRows = body.rows.map((row) => normalizeDesiredRow(normalizeModuleRow(row)));
  const desiredPermissions = permissionsFromRoleModuleRows(normalizedRows);
  const missingLocks = findMissingLockedPermissions(role, desiredPermissions);
  if (missingLocks.length > 0) {
    throw new LockedPermissionsMissingError(missingLocks);
  }
  const desiredSet = new Set(desiredPermissions);
  applyLockedPermissions(role, desiredSet);

  if (desiredSet.size === 0) {
    throw new RoleMustHavePermissionsError();
  }

  const roleMap = await loadOrganizationRolePermissionMap(organizationId);
  const currentSet = effectivePermissionSetForRole(role, roleMap);
  const before = [...currentSet].sort();
  const nextSet = desiredSet;

  const toAdd = [...nextSet].filter((permission) => !currentSet.has(permission));
  const toRemove = [...currentSet].filter((permission) => !nextSet.has(permission));

  await replaceRolePermissions({
    organizationId,
    role,
    permissions: [...nextSet],
  });

  const after = [...nextSet].sort();

  await createAuditRecord({
    title: 'Matriz de permisos por rol',
    description: `Permisos actualizados para rol ${role}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: role,
    organizationId,
    previousData: { role, permissions: before },
    newData: { role, permissions: after, added: toAdd, removed: toRemove },
  });

  const refreshedMap = await loadOrganizationRolePermissionMapUncached(organizationId);
  return {
    ok: true as const,
    modified: isRoleMatrixModified(role, refreshedMap),
    moduleAccess: buildRoleModuleMatrix(role, refreshedMap),
  };
}
