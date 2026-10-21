import { createAuditRecord } from '@/lib/audit';
import {
  AdminRoleAlwaysAssignableError,
  ConfirmRetainMembersError,
} from '@/modules/users/domain/errors';
import {
  countActiveMembersByRole,
  findRoleSetting,
  updateRoleSetting,
} from '@/modules/users/infrastructure/role-repository';
import type { RoleSettingsPutInput } from '@/modules/users/presentation/schemas/users';
import {
  ensureRoleSettingsForOrganization,
  getRoleSettingRow,
} from '@/platform/security/authorization/role-catalog-service';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';

export async function getRoleSettingsUseCase(params: {
  organizationId: string;
  role: OrganizationRole;
}) {
  const memberCount = await countActiveMembersByRole(params.organizationId, params.role);
  const settings = await getRoleSettingRow(params.organizationId, params.role);
  return {
    role: params.role,
    displayName: settings.displayName,
    description: settings.description,
    assignable: settings.assignable,
    memberCount,
    adminLocked: params.role === 'ADMIN',
  };
}

export async function putRoleSettingsUseCase(params: {
  organizationId: string;
  actorUserId: string;
  role: OrganizationRole;
  body: RoleSettingsPutInput;
}) {
  const { organizationId, actorUserId, role, body } = params;
  await ensureRoleSettingsForOrganization(organizationId);

  const memberCount = await countActiveMembersByRole(organizationId, role);

  const assignable = role === 'ADMIN' ? true : body.assignable;
  if (role === 'ADMIN' && body.assignable === false) {
    throw new AdminRoleAlwaysAssignableError();
  }

  if (!assignable && memberCount > 0 && !body.confirmRetainMembers) {
    throw new ConfirmRetainMembersError(memberCount);
  }

  const before = await findRoleSetting(organizationId, role);

  const updated = await updateRoleSetting({
    organizationId,
    role,
    data: {
      displayName: body.displayName,
      description: body.description ?? null,
      assignable,
      updatedById: actorUserId,
    },
  });

  await createAuditRecord({
    title: 'Configuración de rol',
    description: `Ajustes de catálogo para rol ${role}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: role,
    organizationId,
    previousData: before
      ? {
          displayName: before.displayName,
          description: before.description,
          assignable: before.assignable,
        }
      : null,
    newData: {
      displayName: updated.displayName,
      description: updated.description,
      assignable: updated.assignable,
    },
  });

  return {
    role,
    displayName: updated.displayName,
    description: updated.description,
    assignable: role === 'ADMIN' ? true : updated.assignable,
    memberCount,
    adminLocked: role === 'ADMIN',
  };
}
