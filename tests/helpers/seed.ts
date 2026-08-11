// Phase 10A — helper that produces a ready-to-persist tenant. The
// returned object is intentionally loose (Prisma create input) so it
// can be passed straight to `prisma.organization.create({ data })`
// inside a live-database test. If the database is not available, the
// factory still returns a valid shape so non-integration tests can
// assert against it.

import type { Prisma } from '@prisma/client';
import { createTestOrganization, createTestMembership, createTestUser, type TestOrganization, type TestMembership, type TestUserFixture } from '../fixtures';

export type SeededTenant = Readonly<{
  organization: TestOrganization;
  owner: TestUserFixture;
  membership: TestMembership;
  extraUser?: TestUserFixture;
  extraMembership?: TestMembership;
}>;

export type CreateTenantInput = Readonly<{
  id?: string;
  slug?: string;
  name?: string;
  status?: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'PENDING_DELETION';
  onboardingStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  ownerUserId?: string;
  ownerEmail?: string;
  ownerRole?: 'OWNER' | 'ADMIN' | 'IT_MANAGER' | 'IT_TECHNICIAN' | 'PROCUREMENT' | 'HR' | 'AUDITOR' | 'USER';
  extraUser?: { userId?: string; email?: string; role?: 'OWNER' | 'ADMIN' | 'IT_MANAGER' | 'IT_TECHNICIAN' | 'PROCUREMENT' | 'HR' | 'AUDITOR' | 'USER' };
}>;

export function createTestTenant(input: CreateTenantInput = {}): SeededTenant {
  const id = input.id ?? 'org-test';
  const organization = createTestOrganization({
    id,
    slug: input.slug ?? id,
    name: input.name ?? `Test ${id}`,
    status: input.status ?? 'ACTIVE',
    onboardingStatus: input.onboardingStatus ?? 'COMPLETED',
  });
  const owner = createTestUser({
    id: input.ownerUserId ?? 'user-owner',
    email: input.ownerEmail ?? `owner@${id}.example.test`,
    role: 'ADMIN',
  });
  const membership = createTestMembership({
    organizationId: organization.id,
    userId: owner.id,
    role: input.ownerRole ?? 'OWNER',
  });
  if (!input.extraUser) {
    return { organization, owner, membership };
  }
  const extra = createTestUser({
    id: input.extraUser.userId ?? 'user-extra',
    email: input.extraUser.email ?? `extra@${id}.example.test`,
    role: 'USER',
  });
  const extraMembership = createTestMembership({
    organizationId: organization.id,
    userId: extra.id,
    role: input.extraUser.role ?? 'USER',
  });
  return { organization, owner, membership, extraUser: extra, extraMembership };
}

/**
 * Convert a seeded tenant into Prisma create inputs. Use this inside
 * `describeWithDatabase` blocks to actually persist a tenant.
 */
export function toTenantCreateInputs(tenant: SeededTenant): {
  organization: Prisma.OrganizationCreateInput;
  user: Prisma.UserCreateInput;
  membership: Prisma.OrganizationMembershipCreateInput;
  extraUser?: Prisma.UserCreateInput;
  extraMembership?: Prisma.OrganizationMembershipCreateInput;
} {
  const organization: Prisma.OrganizationCreateInput = {
    id: tenant.organization.id,
    name: tenant.organization.name,
    slug: tenant.organization.slug,
    status: tenant.organization.status,
    onboardingStatus: tenant.organization.onboardingStatus,
    timezone: tenant.organization.timezone,
    locale: tenant.organization.locale,
    currency: tenant.organization.currency,
    primaryContactEmail: tenant.organization.primaryContactEmail,
    activatedAt: tenant.organization.activatedAt,
  };
  const user: Prisma.UserCreateInput = {
    id: tenant.owner.id,
    email: tenant.owner.email,
    employeeNumber: tenant.owner.employeeNumber,
    firstName: tenant.owner.firstName,
    lastName: tenant.owner.lastName,
    isActive: tenant.owner.isActive,
    platformRole: tenant.owner.platformRole,
    role: tenant.owner.role,
    password: tenant.owner.password,
  };
  const membership: Prisma.OrganizationMembershipCreateInput = {
    id: tenant.membership.id,
    role: tenant.membership.role,
    status: tenant.membership.status,
    organization: { connect: { id: tenant.organization.id } },
    user: { connect: { id: tenant.owner.id } },
  };
  if (!tenant.extraUser || !tenant.extraMembership) {
    return { organization, user, membership };
  }
  const extraUser: Prisma.UserCreateInput = {
    id: tenant.extraUser.id,
    email: tenant.extraUser.email,
    employeeNumber: tenant.extraUser.employeeNumber,
    firstName: tenant.extraUser.firstName,
    lastName: tenant.extraUser.lastName,
    isActive: tenant.extraUser.isActive,
    platformRole: tenant.extraUser.platformRole,
    role: tenant.extraUser.role,
    password: tenant.extraUser.password,
  };
  const extraMembership: Prisma.OrganizationMembershipCreateInput = {
    id: tenant.extraMembership.id,
    role: tenant.extraMembership.role,
    status: tenant.extraMembership.status,
    organization: { connect: { id: tenant.organization.id } },
    user: { connect: { id: tenant.extraUser.id } },
  };
  return { organization, user, membership, extraUser, extraMembership };
}
