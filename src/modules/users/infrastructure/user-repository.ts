import { prisma } from '@/lib/prisma';
import type { OrganizationRole, Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { PermissionOverride } from '@/platform/security/authorization/permissions';

const userListSelect = {
  id: true,
  employeeNumber: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  departmentId: true,
  positionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UserListRow = Prisma.UserGetPayload<{ select: typeof userListSelect }>;

export async function listOrganizationUsers(params: {
  organizationId: string;
  role?: OrganizationRole | null;
  search?: string | null;
  isActive?: string | null;
  skip: number;
  take: number;
}) {
  const { organizationId, role, search, isActive, skip, take } = params;

  const membershipFilter: Prisma.OrganizationMembershipListRelationFilter = {
    some: {
      organizationId,
      status: 'ACTIVE',
      ...(role ? { role } : {}),
    },
  };

  const where: Prisma.UserWhereInput = {
    organizationMemberships: membershipFilter,
  };
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        ...userListSelect,
        organizationMemberships: {
          where: { organizationId, status: 'ACTIVE' },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

export async function findActiveMembership(organizationId: string, userId: string) {
  return prisma.organizationMembership.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          role: true,
          isActive: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function findActiveMembershipWithUserDetail(organizationId: string, userId: string) {
  return prisma.organizationMembership.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
    select: {
      role: true,
      user: {
        select: {
          ...userListSelect,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function findUserWithPassword(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, email: true, role: true },
  });
}

export async function findUserForSession(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, isActive: true },
  });
}

export async function emailUsedByOtherUser(email: string, excludeUserId: string) {
  return prisma.user.findFirst({
    where: { email, NOT: { id: excludeUserId } },
  });
}

export async function findMembershipByOrgUser(organizationId: string, userId: string) {
  return prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, accessVersion: true },
  });
}

export async function listUserPermissionOverrides(organizationId: string, userId: string) {
  return prisma.userPermissionOverride.findMany({
    where: { organizationId, userId },
    select: { permission: true, effect: true },
  });
}

export async function createUserWithMembership(params: {
  organizationId: string;
  userData: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    mustChangePassword: boolean;
    phone?: string;
    role: Role;
    departmentId?: string;
    positionId?: string;
  };
  membershipRole: OrganizationRole;
}) {
  const { organizationId, userData, membershipRole } = params;
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: userData,
      select: userListSelect,
    });
    await tx.organizationMembership.create({
      data: {
        organizationId,
        userId: created.id,
        role: membershipRole,
        status: 'ACTIVE',
      },
    });
    return created;
  });
}

export async function updateUserInOrganization(params: {
  userId: string;
  membershipId: string;
  membershipRole?: OrganizationRole;
  userPatch: Prisma.UserUpdateInput;
}) {
  const { userId, membershipId, membershipRole, userPatch } = params;
  return prisma.$transaction(async (tx) => {
    if (membershipRole) {
      await tx.organizationMembership.update({
        where: { id: membershipId },
        data: { role: membershipRole, accessVersion: { increment: 1 } },
      });
    }
    return tx.user.update({
      where: { id: userId },
      data: userPatch,
      select: userListSelect,
    });
  });
}

export async function hardDeleteUser(organizationId: string, userId: string) {
  await prisma.$transaction([
    prisma.organizationMembership.deleteMany({ where: { userId, organizationId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

export async function deactivateUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
  });
}

export async function updatePasswordAndBumpAccess(params: {
  userId: string;
  organizationId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  membershipId?: string;
  bumpAllMemberships?: boolean;
}) {
  const { userId, organizationId, passwordHash, mustChangePassword, membershipId, bumpAllMemberships } = params;
  const now = new Date();
  const userUpdate = prisma.user.update({
    where: { id: userId },
    data: {
      password: passwordHash,
      passwordChangedAt: now,
      mustChangePassword,
    },
  });
  if (bumpAllMemberships) {
    await prisma.$transaction([
      userUpdate,
      prisma.organizationMembership.updateMany({
        where: { userId, organizationId },
        data: { accessVersion: { increment: 1 } },
      }),
    ]);
    return;
  }
  if (membershipId) {
    await prisma.$transaction([
      userUpdate,
      prisma.organizationMembership.update({
        where: { id: membershipId },
        data: { accessVersion: { increment: 1 } },
      }),
    ]);
  }
}

export async function replaceUserPermissionOverrides(params: {
  organizationId: string;
  userId: string;
  actorUserId: string;
  overrides: PermissionOverride[];
}) {
  const { organizationId, userId, actorUserId, overrides } = params;
  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { organizationId, userId } });
    if (overrides.length) {
      await tx.userPermissionOverride.createMany({
        data: overrides.map((o) => ({
          organizationId,
          userId,
          permission: o.permission,
          effect: o.effect,
          createdById: actorUserId,
        })),
      });
    }
    await tx.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { accessVersion: { increment: 1 } },
    });
  });
}

export async function clearUserPermissionOverrides(organizationId: string, userId: string) {
  await prisma.$transaction([
    prisma.userPermissionOverride.deleteMany({ where: { organizationId, userId } }),
    prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { accessVersion: { increment: 1 } },
    }),
  ]);
}

export async function getProfileUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      employeeNumber: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      departmentId: true,
      positionId: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
}

export async function updateProfileUser(
  userId: string,
  data: { firstName?: string; lastName?: string; phone?: string; email?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
    },
    select: {
      id: true,
      employeeNumber: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getProfileSnapshot(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, phone: true, email: true },
  });
}
