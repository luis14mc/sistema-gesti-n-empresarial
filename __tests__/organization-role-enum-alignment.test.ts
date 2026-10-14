import { describe, expect, it } from 'vitest';
import { OrganizationRole, PlatformRole } from '@prisma/client';
import { ORGANIZATION_ROLES, PLATFORM_ROLES } from '@/platform/security/authorization/permissions';

describe('authorization role catalogs vs Prisma enums', () => {
  it('ORGANIZATION_ROLES matches OrganizationRole enum values', () => {
    const prismaValues = Object.values(OrganizationRole).sort();
    expect([...ORGANIZATION_ROLES].sort()).toEqual(prismaValues);
  });

  it('PLATFORM_ROLES matches PlatformRole enum values', () => {
    const prismaValues = Object.values(PlatformRole).sort();
    expect([...PLATFORM_ROLES].sort()).toEqual(prismaValues);
  });
});
