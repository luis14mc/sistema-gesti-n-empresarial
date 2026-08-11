import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationStatus, OnboardingStatus } from '@prisma/client';

const txMock = vi.hoisted(() => ({
  organization: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  organizationMembership: {
    count: vi.fn(),
  },
  systemAuditEvent: {
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const recordEventMock = vi.hoisted(() => vi.fn());
const appendEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/platform/security/audit/security-events', () => ({
  appendSecurityEvent: appendEventMock,
  recordSecurityEvent: recordEventMock,
}));

import {
  ALLOWED_MEMBERSHIP_TRANSITIONS,
  ALLOWED_ORGANIZATION_TRANSITIONS,
  ONBOARDING_TRANSITIONS,
  assertCanRemoveOwner,
  assertMembershipTransition,
  assertOnboardingReadyForActivation,
  assertOnboardingTransition,
  assertOrganizationTransition,
  canTransitionMembership,
  canTransitionOnboarding,
  canTransitionOrganization,
  isOwnerRole,
  isWritableOrganizationStatus,
} from '@/modules/organizations/domain/rules';
import {
  InvalidOrganizationTransitionError,
  LastOwnerRequiredError,
  OnboardingIncompleteError,
} from '@/modules/organizations/domain/errors';
import { organizationLifecycleService } from '@/modules/organizations/application/lifecycle';

describe('organization lifecycle transitions', () => {
  it('allows the canonical Phase 7A transitions', () => {
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.PROVISIONING).toEqual(['ACTIVE', 'ARCHIVED', 'PENDING_DELETION']);
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.ACTIVE).toEqual(['SUSPENDED', 'ARCHIVED', 'PENDING_DELETION']);
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.SUSPENDED).toEqual(['ACTIVE', 'ARCHIVED', 'PENDING_DELETION']);
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.ARCHIVED).toEqual(['ACTIVE', 'PENDING_DELETION']);
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.PENDING_DELETION).toEqual([]);
  });

  it('rejects transitions that must never happen implicitly', () => {
    expect(canTransitionOrganization('PENDING_DELETION', 'ACTIVE')).toBe(false);
    expect(canTransitionOrganization('SUSPENDED', 'PROVISIONING')).toBe(false);
    expect(canTransitionOrganization('ACTIVE', 'ACTIVE')).toBe(false);
  });

  it('throws InvalidOrganizationTransitionError for forbidden moves', () => {
    expect(() => assertOrganizationTransition('ACTIVE' as OrganizationStatus, 'PROVISIONING' as OrganizationStatus))
      .toThrow(InvalidOrganizationTransitionError);
  });

  it('keeps the existing CNI organization operational (ACTIVE is writable)', () => {
    expect(isWritableOrganizationStatus('ACTIVE')).toBe(true);
    expect(isWritableOrganizationStatus('SUSPENDED')).toBe(false);
    expect(isWritableOrganizationStatus('ARCHIVED')).toBe(false);
    expect(isWritableOrganizationStatus('PROVISIONING')).toBe(false);
  });
});

describe('membership lifecycle transitions', () => {
  it('allows the canonical Phase 7A transitions', () => {
    expect(ALLOWED_MEMBERSHIP_TRANSITIONS.INVITED).toEqual(['ACTIVE', 'REVOKED']);
    expect(ALLOWED_MEMBERSHIP_TRANSITIONS.ACTIVE).toEqual(['SUSPENDED', 'REVOKED']);
    expect(ALLOWED_MEMBERSHIP_TRANSITIONS.SUSPENDED).toEqual(['ACTIVE', 'REVOKED']);
    expect(ALLOWED_MEMBERSHIP_TRANSITIONS.REVOKED).toEqual([]);
  });

  it('rejects re-revoking or un-archiving memberships', () => {
    expect(canTransitionMembership('REVOKED', 'ACTIVE')).toBe(false);
    expect(canTransitionMembership('ACTIVE', 'INVITED')).toBe(false);
    expect(() => assertMembershipTransition('REVOKED', 'ACTIVE'))
      .toThrow(InvalidOrganizationTransitionError);
  });
});

describe('onboarding transitions', () => {
  it('supports PENDING → IN_PROGRESS → COMPLETED', () => {
    expect(canTransitionOnboarding('PENDING' as OnboardingStatus, 'IN_PROGRESS' as OnboardingStatus)).toBe(true);
    expect(canTransitionOnboarding('IN_PROGRESS' as OnboardingStatus, 'COMPLETED' as OnboardingStatus)).toBe(true);
    expect(ONBOARDING_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('blocks skipping straight to completed from PENDING', () => {
    expect(canTransitionOnboarding('PENDING' as OnboardingStatus, 'COMPLETED' as OnboardingStatus)).toBe(false);
    expect(() => assertOnboardingTransition('PENDING' as OnboardingStatus, 'COMPLETED' as OnboardingStatus))
      .toThrow(InvalidOrganizationTransitionError);
  });
});

describe('owner protection', () => {
  it('refuses to remove the last active owner', () => {
    expect(() => assertCanRemoveOwner('org-1', 1)).toThrow(LastOwnerRequiredError);
  });

  it('allows removing an owner when at least two are active', () => {
    expect(() => assertCanRemoveOwner('org-1', 2)).not.toThrow();
  });

  it('classifies OWNER correctly', () => {
    expect(isOwnerRole('OWNER')).toBe(true);
    expect(isOwnerRole('ADMIN')).toBe(false);
    expect(isOwnerRole('USER')).toBe(false);
  });
});

describe('onboarding readiness for activation', () => {
  it('requires COMPLETED or SKIPPED before activation', () => {
    expect(() => assertOnboardingReadyForActivation('org-1', 'PENDING' as OnboardingStatus))
      .toThrow(OnboardingIncompleteError);
    expect(() => assertOnboardingReadyForActivation('org-1', 'IN_PROGRESS' as OnboardingStatus))
      .toThrow(OnboardingIncompleteError);
    expect(() => assertOnboardingReadyForActivation('org-1', 'COMPLETED' as OnboardingStatus))
      .not.toThrow();
    expect(() => assertOnboardingReadyForActivation('org-1', 'SKIPPED' as OnboardingStatus))
      .not.toThrow();
  });
});

describe('organization lifecycle service audit wiring', () => {
  beforeEach(() => {
    txMock.organization.create.mockReset();
    txMock.organization.findUnique.mockReset();
    txMock.organization.update.mockReset();
    txMock.organizationMembership.count.mockReset();
    txMock.systemAuditEvent.create.mockReset();
    prismaMock.$transaction.mockReset();
    recordEventMock.mockReset();
    appendEventMock.mockReset();
  });

  it('creates the organization in PROVISIONING and writes a lifecycle audit event', async () => {
    const created = {
      id: 'org-1',
      name: 'Org 1',
      slug: 'org-1',
      status: 'PROVISIONING',
      onboardingStatus: 'PENDING',
    };
    txMock.organization.create.mockResolvedValue(created);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));

    const result = await organizationLifecycleService.create(
      { name: 'Org 1', slug: 'org-1' },
      { userId: 'admin-1', email: 'admin@example.com', requestId: 'req-1' },
    );
    expect(result.status).toBe('PROVISIONING');
    expect(appendEventMock).toHaveBeenCalledWith(txMock, expect.objectContaining({
      eventType: 'organization.lifecycle.created',
      outcome: 'SUCCESS',
      organizationId: 'org-1',
    }));
  });

  it('rejects activation without an active owner and writes a denied audit', async () => {
    txMock.organization.findUnique.mockResolvedValue({
      id: 'org-2',
      status: 'PROVISIONING',
      onboardingStatus: 'COMPLETED',
      activatedAt: null,
    });
    txMock.organizationMembership.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    recordEventMock.mockResolvedValue(undefined);

    await expect(
      organizationLifecycleService.activate(
        { organizationId: 'org-2' },
        { userId: 'admin-1', email: 'admin@example.com', requestId: 'req-2' },
      ),
    ).rejects.toThrow(/propietario activo/i);
    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'organization.lifecycle.activate',
      outcome: 'DENIED',
    }));
  });

  it('rejects suspension from PROVISIONING with an audit and InvalidOrganizationTransitionError', async () => {
    txMock.organization.findUnique.mockResolvedValue({
      id: 'org-3',
      status: 'PROVISIONING',
      suspendedAt: null,
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    recordEventMock.mockResolvedValue(undefined);

    await expect(
      organizationLifecycleService.suspend(
        { organizationId: 'org-3', reason: 'maintenance' },
        { userId: 'admin-1', email: 'admin@example.com', requestId: 'req-3' },
      ),
    ).rejects.toBeInstanceOf(InvalidOrganizationTransitionError);
    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'organization.lifecycle.suspend',
      outcome: 'DENIED',
    }));
  });

  it('suspends an ACTIVE organization and records a success audit', async () => {
    const suspended = {
      id: 'org-4',
      status: 'SUSPENDED',
      suspendedAt: new Date('2026-07-24T00:00:00Z'),
    };
    txMock.organization.findUnique.mockResolvedValue({
      id: 'org-4',
      status: 'ACTIVE',
      suspendedAt: null,
    });
    txMock.organization.update.mockResolvedValue(suspended);
    txMock.organizationMembership.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    recordEventMock.mockResolvedValue(undefined);

    const result = await organizationLifecycleService.suspend(
      { organizationId: 'org-4', reason: 'policy violation' },
      { userId: 'admin-1', email: 'admin@example.com', requestId: 'req-4' },
    );
    expect(result.status).toBe('SUSPENDED');
    expect(appendEventMock).toHaveBeenCalledWith(txMock, expect.objectContaining({
      eventType: 'organization.lifecycle.suspended',
      outcome: 'SUCCESS',
      attributes: expect.objectContaining({ from: 'ACTIVE', to: 'SUSPENDED', reason: 'policy violation' }),
    }));
  });
});
