import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  ConfirmSelfRoleChangeError,
  InvalidRoleError,
  LastSuperAdminError,
  RoleNotAssignableError,
  UserEmailAlreadyRegisteredError,
  UserNotFoundError,
} from '@/modules/users/domain/errors';
import {
  countActiveSuperAdminMemberships,
  isSuperAdminMembershipRole,
} from '@/modules/users/infrastructure/super-admin-membership';
import {
  createUserWithMembership,
  findActiveMembership,
  findUserByEmail,
  listOrganizationUsers,
  updateUserInOrganization,
} from '@/modules/users/infrastructure/user-repository';
import type { CreateUserInput } from '@/modules/users/presentation/schemas/users';
import { isOrganizationRoleAssignable } from '@/platform/security/authorization/role-catalog-service';
import {
  parseOrganizationRole,
  persistUserAccountRoles,
  presentAccountRole,
} from '@/platform/security/authorization/user-account-roles';
import type { OrganizationRole } from '@prisma/client';

export async function listUsers(params: {
  organizationId: string;
  query: {
    role?: string | null;
    search?: string | null;
    isActive?: string | null;
    page: number;
    pageSize: number;
  };
}) {
  const { organizationId, query } = params;
  const skip = (query.page - 1) * query.pageSize;
  const roleFilter = query.role ? (query.role as OrganizationRole) : undefined;

  const { users, total } = await listOrganizationUsers({
    organizationId,
    role: roleFilter ?? null,
    search: query.search,
    isActive: query.isActive,
    skip,
    take: query.pageSize,
  });

  return {
    users: users.map(({ organizationMemberships, ...user }) => ({
      ...user,
      role: presentAccountRole(organizationMemberships[0]?.role, user.role),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function createUser(params: {
  organizationId: string;
  actorUserId: string;
  input: CreateUserInput;
  hashPassword: (plain: string) => Promise<string>;
}) {
  const { organizationId, actorUserId, input, hashPassword } = params;
  const parsedRole = parseOrganizationRole(input.role);
  if (!parsedRole) {
    throw new InvalidRoleError('Seleccione un rol válido');
  }
  if (!(await isOrganizationRoleAssignable(organizationId, parsedRole))) {
    throw new RoleNotAssignableError();
  }
  const accountRoles = persistUserAccountRoles(parsedRole);

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new UserEmailAlreadyRegisteredError();
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await createUserWithMembership({
    organizationId,
    userData: {
      employeeNumber: input.employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: hashedPassword,
      mustChangePassword: input.mustChangePassword,
      phone: input.phone,
      role: accountRoles.prismaUserRole,
      departmentId: input.departmentId,
      positionId: input.positionId,
    },
    membershipRole: accountRoles.membershipRole,
  });

  await createAuditRecord({
    title: 'Creación de usuario',
    description: `Se creó usuario: ${user.firstName} ${user.lastName} (${user.email})`,
    module: 'USUARIOS',
    category: 'CREATE',
    userId: actorUserId,
    entityId: user.id,
    organizationId,
    newData: { email: user.email, role: accountRoles.membershipRole, employeeNumber: user.employeeNumber },
  });

  return { user: { ...user, role: accountRoles.membershipRole } };
}

export async function patchUserCollection(params: {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
  confirmSelfRoleDemotion?: boolean;
  data: Record<string, unknown>;
}) {
  const { organizationId, actorUserId, targetUserId, confirmSelfRoleDemotion, data } = params;

  const membership = await findActiveMembership(organizationId, targetUserId);
  if (!membership) {
    throw new UserNotFoundError();
  }
  const previousUser = membership.user;

  let nextRoles: ReturnType<typeof persistUserAccountRoles> | null = null;
  if (data.role) {
    const parsedRole = parseOrganizationRole(String(data.role));
    if (!parsedRole) {
      throw new InvalidRoleError();
    }
    const roleUnchanged = parsedRole === membership.role;
    if (!roleUnchanged && !(await isOrganizationRoleAssignable(organizationId, parsedRole))) {
      throw new RoleNotAssignableError();
    }
    if (!roleUnchanged) {
      if (
        isSuperAdminMembershipRole(membership.role) &&
        !isSuperAdminMembershipRole(parsedRole)
      ) {
        const remaining = await countActiveSuperAdminMemberships(organizationId, targetUserId);
        if (remaining === 0) {
          throw new LastSuperAdminError();
        }
      }

      if (targetUserId === actorUserId && !confirmSelfRoleDemotion) {
        throw new ConfirmSelfRoleChangeError();
      }

      nextRoles = persistUserAccountRoles(parsedRole);
    }
  }

  if (
    data.isActive === false &&
    membership.user.isActive &&
    isSuperAdminMembershipRole(membership.role)
  ) {
    const remaining = await countActiveSuperAdminMemberships(organizationId, targetUserId);
    if (remaining === 0) {
      throw new LastSuperAdminError();
    }
  }

  const user = await updateUserInOrganization({
    userId: targetUserId,
    membershipId: membership.id,
    membershipRole: nextRoles?.membershipRole,
    userPatch: {
      ...(typeof data.firstName === 'string' && data.firstName ? { firstName: data.firstName } : {}),
      ...(typeof data.lastName === 'string' && data.lastName ? { lastName: data.lastName } : {}),
      ...(typeof data.email === 'string' && data.email ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone as string | null } : {}),
      ...(nextRoles ? { role: nextRoles.prismaUserRole } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId as string | null } : {}),
      ...(data.positionId !== undefined ? { positionId: data.positionId as string | null } : {}),
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
    previousData: {
      role: previousUser.role,
      isActive: previousUser.isActive,
    },
    newData: { role: presentedRole, isActive: user.isActive },
  });

  return { user: { ...user, role: presentedRole } };
}
