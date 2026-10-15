import type { OrganizationRole, Role as PrismaUserRole } from '@prisma/client';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import {
  isPromotedOrganizationRole,
  toPrismaUserRole,
  type PromotedOrganizationRole,
} from './roles';

export function parseOrganizationRole(value: unknown): OrganizationRole | null {
  if (typeof value !== 'string') return null;
  return (ORGANIZATION_ROLES as readonly string[]).includes(value) ? (value as OrganizationRole) : null;
}

export function parsePromotedOrganizationRole(value: unknown): PromotedOrganizationRole | null {
  if (typeof value !== 'string' || !isPromotedOrganizationRole(value)) return null;
  return value;
}

/** Maps organization membership role to legacy Prisma `User.role` enum. */
export function organizationRoleToPrismaUserRole(role: OrganizationRole): PrismaUserRole {
  switch (role) {
    case 'ADMIN':
    case 'OWNER':
      return 'ADMIN';
    case 'ADMINISTRACION':
    case 'HR':
      return 'RRHH';
    case 'IT_MANAGER':
    case 'IT_TECHNICIAN':
      return 'IT';
    default:
      return 'USER';
  }
}

export function persistUserAccountRoles(organizationRole: OrganizationRole): {
  membershipRole: OrganizationRole;
  prismaUserRole: PrismaUserRole;
} {
  if (isPromotedOrganizationRole(organizationRole)) {
    return {
      membershipRole: organizationRole,
      prismaUserRole: toPrismaUserRole(organizationRole),
    };
  }
  return {
    membershipRole: organizationRole,
    prismaUserRole: organizationRoleToPrismaUserRole(organizationRole),
  };
}

export function presentAccountRole(membershipRole: OrganizationRole | null | undefined, prismaUserRole: PrismaUserRole): string {
  return membershipRole ?? prismaUserRole;
}
