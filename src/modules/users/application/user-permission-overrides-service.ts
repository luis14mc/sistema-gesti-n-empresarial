import { createAuditRecord } from '@/lib/audit';
import {
  ActorMembershipMissingError,
  DenyLockedPermissionError,
  MembershipNotFoundError,
} from '@/modules/users/domain/errors';
import {
  clearUserPermissionOverrides,
  findMembershipByOrgUser,
  listUserPermissionOverrides,
  replaceUserPermissionOverrides,
} from '@/modules/users/infrastructure/user-repository';
import type { UserPermissionOverridesPutInput } from '@/modules/users/presentation/schemas/users';
import {
  buildEffectiveModuleMatrix,
  normalizeDesiredRow,
  overridesFromDesiredMatrix,
} from '@/platform/security/module-effective';
import { MODULE_CATALOG } from '@/platform/security/modules';
import type { PermissionOverride } from '@/platform/security/authorization/permissions';
import {
  createRolePermissionCheck,
  loadOrganizationRolePermissionMap,
} from '@/platform/security/authorization/role-permission-service';
import { findDenyOverridesOnLockedPermissions } from '@/platform/security/authorization/role-permission-locks';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';

export async function getUserPermissionOverridesUseCase(params: {
  organizationId: string;
  targetUserId: string;
}) {
  const targetMembership = await findMembershipByOrgUser(params.organizationId, params.targetUserId);
  if (!targetMembership) {
    throw new MembershipNotFoundError();
  }

  const [overrides, roleMap] = await Promise.all([
    listUserPermissionOverrides(params.organizationId, params.targetUserId),
    loadOrganizationRolePermissionMap(params.organizationId),
  ]);
  const roleHas = createRolePermissionCheck(targetMembership.role, roleMap);
  const typedOverrides = overrides as PermissionOverride[];

  return {
    role: targetMembership.role,
    overrides: typedOverrides,
    roleModuleAccess: buildEffectiveModuleMatrix(targetMembership.role, [], roleHas),
    moduleAccess: buildEffectiveModuleMatrix(targetMembership.role, typedOverrides, roleHas),
  };
}

export async function putUserPermissionOverridesUseCase(params: {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
  body: UserPermissionOverridesPutInput;
}) {
  const { organizationId, actorUserId, targetUserId, body } = params;

  const targetMembership = await findMembershipByOrgUser(organizationId, targetUserId);
  if (!targetMembership) {
    throw new MembershipNotFoundError();
  }

  const beforeOverrides = await listUserPermissionOverrides(organizationId, targetUserId);

  const roleMap = await loadOrganizationRolePermissionMap(organizationId);
  const roleHas = createRolePermissionCheck(targetMembership.role, roleMap);

  let nextOverrides: PermissionOverride[] = beforeOverrides as PermissionOverride[];
  for (const row of body.rows) {
    const def = MODULE_CATALOG[row.module];
    const allowedExtras = new Set(def.specials.map((s) => s.id));
    const normalized = normalizeDesiredRow({
      ...row,
      extras: row.extras.filter((e) => allowedExtras.has(e as never)),
    });
    nextOverrides = overridesFromDesiredMatrix(targetMembership.role, nextOverrides, normalized, roleHas);
  }

  const illegalDenies = findDenyOverridesOnLockedPermissions(targetMembership.role, nextOverrides);
  if (illegalDenies.length > 0) {
    throw new DenyLockedPermissionError(illegalDenies);
  }

  await replaceUserPermissionOverrides({
    organizationId,
    userId: targetUserId,
    actorUserId,
    overrides: nextOverrides,
  });

  await createAuditRecord({
    title: 'Excepciones de permisos por usuario',
    description: `Overrides actualizados para ${targetUserId}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: targetUserId,
    previousData: { overrides: beforeOverrides },
    newData: { overrides: nextOverrides },
  });

  return {
    ok: true as const,
    overrides: nextOverrides,
    moduleAccess: buildEffectiveModuleMatrix(targetMembership.role, nextOverrides, roleHas),
  };
}

export async function deleteUserPermissionOverridesUseCase(params: {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
}) {
  const { organizationId, actorUserId, targetUserId } = params;

  const beforeOverrides = await listUserPermissionOverrides(organizationId, targetUserId);

  await clearUserPermissionOverrides(organizationId, targetUserId);

  await createAuditRecord({
    title: 'Excepciones de permisos eliminadas',
    description: `Se restableció el rol base para ${targetUserId}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: targetUserId,
    previousData: { overrides: beforeOverrides },
    newData: { overrides: [] },
  });

  return { ok: true as const };
}

/** Used by routes after requireOrganizationPermission to load actor membership role. */
export async function findActorMembershipRole(organizationId: string, actorUserId: string): Promise<OrganizationRole> {
  const actorMembership = await findMembershipByOrgUser(organizationId, actorUserId);
  if (!actorMembership) {
    throw new ActorMembershipMissingError();
  }
  return actorMembership.role;
}
