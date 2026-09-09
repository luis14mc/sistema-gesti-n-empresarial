import type { OrganizationRole, Role as PrismaUserRole } from '@prisma/client';
import {
  isPromotedOrganizationRole,
  toPrismaUserRole,
  type PromotedOrganizationRole,
} from './roles';

export function parsePromotedOrganizationRole(value: unknown): PromotedOrganizationRole | null {
  if (typeof value !== 'string' || !isPromotedOrganizationRole(value)) return null;
  return value;
}

export function persistUserAccountRoles(organizationRole: PromotedOrganizationRole): {
  membershipRole: OrganizationRole;
  prismaUserRole: PrismaUserRole;
} {
  return {
    membershipRole: organizationRole,
    prismaUserRole: toPrismaUserRole(organizationRole),
  };
}

export function presentAccountRole(membershipRole: OrganizationRole | null | undefined, prismaUserRole: PrismaUserRole): string {
  return membershipRole ?? prismaUserRole;
}
