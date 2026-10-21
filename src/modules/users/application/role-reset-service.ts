import { createAuditRecord } from '@/lib/audit';
import {
  listRolePermissionKeys,
  resetRolePermissionsToOfficial,
} from '@/modules/users/infrastructure/role-repository';
import { officialPermissionsForRole } from '@/platform/security/authorization/official-role-permissions';
import { loadOrganizationRolePermissionMapUncached } from '@/platform/security/authorization/role-permission-service';
import { buildRoleModuleMatrix } from '@/platform/security/role-permission-matrix';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';

export async function resetRolePermissionsUseCase(params: {
  organizationId: string;
  actorUserId: string;
  role: OrganizationRole;
}) {
  const { organizationId, actorUserId, role } = params;

  const before = (await listRolePermissionKeys(organizationId, role)).sort();
  const official = [...officialPermissionsForRole(role)].sort();

  await resetRolePermissionsToOfficial({
    organizationId,
    role,
    officialPermissions: official,
  });

  await createAuditRecord({
    title: 'Restablecer permisos oficiales del rol',
    description: `Rol ${role} restaurado a plantilla oficial`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: role,
    organizationId,
    previousData: { role, permissions: before },
    newData: { role, permissions: official, source: 'official_template' },
  });

  const map = await loadOrganizationRolePermissionMapUncached(organizationId);
  return {
    ok: true as const,
    modified: false,
    moduleAccess: buildRoleModuleMatrix(role, map),
  };
}
