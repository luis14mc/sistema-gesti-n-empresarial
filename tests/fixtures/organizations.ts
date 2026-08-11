import type {
  MembershipStatus,
  OnboardingStatus,
  OrganizationRole,
  OrganizationStatus,
} from '@prisma/client';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetFactoryCounters(): void {
  counter = 0;
}

export type TestOrganization = Readonly<{
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  onboardingStatus: OnboardingStatus;
  timezone: string;
  locale: string;
  currency: string;
  primaryContactEmail: string;
  activatedAt: Date | null;
}>;

export function createTestOrganization(overrides: Partial<TestOrganization> = {}): TestOrganization {
  const id = overrides.id ?? nextId('org');
  return {
    id,
    name: overrides.name ?? `Test Organization ${id}`,
    slug: overrides.slug ?? id,
    status: overrides.status ?? 'ACTIVE',
    onboardingStatus: overrides.onboardingStatus ?? 'COMPLETED',
    timezone: overrides.timezone ?? 'America/Tegucigalpa',
    locale: overrides.locale ?? 'es-HN',
    currency: overrides.currency ?? 'HNL',
    primaryContactEmail: overrides.primaryContactEmail ?? `contact-${id}@example.test`,
    activatedAt: overrides.activatedAt ?? new Date('2026-01-01T00:00:00Z'),
  };
}

export type TestMembership = Readonly<{
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  status: MembershipStatus;
}>;

export function createTestMembership(overrides: Partial<TestMembership> & { organizationId: string; userId: string }): TestMembership {
  return {
    id: overrides.id ?? nextId('mem'),
    organizationId: overrides.organizationId,
    userId: overrides.userId,
    role: overrides.role ?? 'USER',
    status: overrides.status ?? 'ACTIVE',
  };
}

export function createTestOrganizationPair(): { organizationA: TestOrganization; organizationB: TestOrganization } {
  return {
    organizationA: createTestOrganization({ id: 'org-a', slug: 'org-a' }),
    organizationB: createTestOrganization({ id: 'org-b', slug: 'org-b' }),
  };
}
