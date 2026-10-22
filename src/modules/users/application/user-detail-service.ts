import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  CannotChangeOwnRoleError,
  CannotDeleteSelfError,
  InvalidRoleError,
  RoleNotAssignableError,
  UserHasHistoryError,
  UserNotFoundError,
} from '@/modules/users/domain/errors';
import { countBlockingUserReferences } from '@/modules/users/infrastructure/user-reference-counts';
import {
  deactivateUser,
  findActiveMembership,
  findActiveMembershipWithUserDetail,
  hardDeleteUser,
  updateUserInOrganization,
} from '@/modules/users/infrastructure/user-repository';
import { isOrganizationRoleAssignable } from '@/platform/security/authorization/role-catalog-service';
import {
  parseOrganizationRole,
  persistUserAccountRoles,
  presentAccountRole,
} from '@/platform/security/authorization/user-account-roles';

export async function getUserByIdUseCase(organizationId: string, userId: string) {
  const membership = await findActiveMembershipWithUserDetail(organizationId, userId);
  if (!membership) {
    throw new UserNotFoundError();
  }
  return {
    user: {
      ...membership.user,
      role: presentAccountRole(membership.role, membership.user.role),
    },
  };
}

export async function patchUserByIdUseCase(params: {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
  body: Record<string, unknown>;
}) {
  const { organizationId, actorUserId, targetUserId, body } = params;

  const membership = await findActiveMembership(organizationId, targetUserId);
  if (!membership) {
    throw new UserNotFoundError();
  }
  const existing = membership.user;

  const presentedExistingRole = presentAccountRole(membership.role, existing.role);
  if (targetUserId === actorUserId && body.role && body.role !== presentedExistingRole) {
    throw new CannotChangeOwnRoleError();
  }

  let nextRoles: ReturnType<typeof persistUserAccountRoles> | null = null;
  if (body.role) {
    const parsedRole = parseOrganizationRole(String(body.role));
    if (!parsedRole) {
      throw new InvalidRoleError();
    }
    const roleUnchanged = parsedRole === membership.role;
    if (!roleUnchanged && !(await isOrganizationRoleAssignable(organizationId, parsedRole))) {
      throw new RoleNotAssignableError();
    }
    if (!roleUnchanged) {
      nextRoles = persistUserAccountRoles(parsedRole);
    }
  }

  const user = await updateUserInOrganization({
    userId: targetUserId,
    membershipId: membership.id,
    membershipRole: nextRoles?.membershipRole,
    userPatch: {
      ...(typeof body.firstName === 'string' && body.firstName ? { firstName: body.firstName } : {}),
      ...(typeof body.lastName === 'string' && body.lastName ? { lastName: body.lastName } : {}),
      ...(typeof body.email === 'string' && body.email ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone as string | null } : {}),
      ...(nextRoles ? { role: nextRoles.prismaUserRole } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.departmentId !== undefined ? { departmentId: body.departmentId as string | null } : {}),
      ...(body.positionId !== undefined ? { positionId: body.positionId as string | null } : {}),
    },
  });

  const presentedRole = presentAccountRole(nextRoles?.membershipRole ?? membership.role, user.role);

  await createAuditRecord({
    title: 'Actualización de usuario',
    description: `Se actualizó usuario: ${user.firstName} ${user.lastName}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: user.id,
    organizationId,
    previousData: { role: existing.role, isActive: existing.isActive },
    newData: { role: presentedRole, isActive: user.isActive },
  });

  return { user: { ...user, role: presentedRole } };
}

export async function deleteUserByIdUseCase(params: {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
  hard: boolean;
}) {
  const { organizationId, actorUserId, targetUserId, hard } = params;

  if (targetUserId === actorUserId) {
    throw new CannotDeleteSelfError();
  }

  const membership = await findActiveMembership(organizationId, targetUserId);
  if (!membership) {
    throw new UserNotFoundError();
  }
  const existing = membership.user;

  if (hard) {
    const references = await countBlockingUserReferences(targetUserId);
    if (references > 0) {
      throw new UserHasHistoryError();
    }
    await hardDeleteUser(organizationId, targetUserId);
    await createAuditRecord({
      title: 'Eliminación definitiva de usuario',
      description: `Se eliminó usuario: ${existing.firstName} ${existing.lastName} (${existing.email})`,
      module: 'USUARIOS',
      category: 'DELETE',
      userId: actorUserId,
      entityId: targetUserId,
      organizationId,
    });
    return { deleted: true as const };
  }

  const user = await deactivateUser(targetUserId);
  await createAuditRecord({
    title: 'Desactivación de usuario',
    description: `Se desactivó usuario: ${user.firstName} ${user.lastName} (${user.email})`,
    module: 'USUARIOS',
    category: 'DELETE',
    userId: actorUserId,
    entityId: user.id,
    organizationId,
    previousData: { isActive: existing.isActive },
    newData: { isActive: false },
  });

  return { user };
}
