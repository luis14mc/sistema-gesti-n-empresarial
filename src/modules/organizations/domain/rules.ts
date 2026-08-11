import type {
  MembershipStatus,
  OnboardingStatus,
  OrganizationRole,
  OrganizationStatus,
} from '@prisma/client';
import {
  InvalidOrganizationTransitionError,
  LastOwnerRequiredError,
  OnboardingIncompleteError,
} from './errors';

export const ALLOWED_ORGANIZATION_TRANSITIONS: Readonly<Record<OrganizationStatus, readonly OrganizationStatus[]>> = Object.freeze({
  PROVISIONING: ['ACTIVE', 'ARCHIVED', 'PENDING_DELETION'],
  ACTIVE: ['SUSPENDED', 'ARCHIVED', 'PENDING_DELETION'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED', 'PENDING_DELETION'],
  ARCHIVED: ['ACTIVE', 'PENDING_DELETION'],
  PENDING_DELETION: [],
  INACTIVE: ['ARCHIVED', 'PENDING_DELETION'],
});

export const ARCHIVAL_REQUIRES_PLATFORM_PERMISSION: ReadonlySet<OrganizationStatus> = new Set<OrganizationStatus>(['ARCHIVED']);
export const SUSPENSION_TARGET_STATUS: OrganizationStatus = 'SUSPENDED';
export const REACTIVATION_SOURCE_STATUS: ReadonlySet<OrganizationStatus> = new Set<OrganizationStatus>(['SUSPENDED']);

export const ALLOWED_MEMBERSHIP_TRANSITIONS: Readonly<Record<MembershipStatus, readonly MembershipStatus[]>> = Object.freeze({
  INVITED: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['ACTIVE', 'REVOKED'],
  REVOKED: [],
  INACTIVE: ['REVOKED'],
});

export const ONBOARDING_TRANSITIONS: Readonly<Record<OnboardingStatus, readonly OnboardingStatus[]>> = Object.freeze({
  PENDING: ['IN_PROGRESS', 'SKIPPED'],
  IN_PROGRESS: ['COMPLETED', 'SKIPPED', 'PENDING'],
  COMPLETED: [],
  SKIPPED: ['IN_PROGRESS', 'COMPLETED'],
});

export function canTransitionOrganization(
  from: OrganizationStatus,
  to: OrganizationStatus,
): boolean {
  return ALLOWED_ORGANIZATION_TRANSITIONS[from].includes(to);
}

export function assertOrganizationTransition(
  from: OrganizationStatus,
  to: OrganizationStatus,
): void {
  if (!canTransitionOrganization(from, to)) {
    throw new InvalidOrganizationTransitionError(from, to);
  }
}

export function canTransitionMembership(
  from: MembershipStatus,
  to: MembershipStatus,
): boolean {
  return ALLOWED_MEMBERSHIP_TRANSITIONS[from].includes(to);
}

export function assertMembershipTransition(
  from: MembershipStatus,
  to: MembershipStatus,
): void {
  if (!canTransitionMembership(from, to)) {
    throw new InvalidOrganizationTransitionError(from, to, 'membership');
  }
}

export function canTransitionOnboarding(
  from: OnboardingStatus,
  to: OnboardingStatus,
): boolean {
  return ONBOARDING_TRANSITIONS[from].includes(to);
}

export function assertOnboardingTransition(
  from: OnboardingStatus,
  to: OnboardingStatus,
): void {
  if (!canTransitionOnboarding(from, to)) {
    throw new InvalidOrganizationTransitionError(from, to, 'onboarding');
  }
}

export function isWritableOrganizationStatus(status: OrganizationStatus): boolean {
  return status === 'ACTIVE';
}

export function isOnboardingReadyForActivation(status: OnboardingStatus): boolean {
  return status === 'COMPLETED' || status === 'SKIPPED';
}

export function assertOnboardingReadyForActivation(
  organizationId: string,
  status: OnboardingStatus,
): void {
  if (!isOnboardingReadyForActivation(status)) {
    throw new OnboardingIncompleteError(organizationId, status);
  }
}

export function isOwnerRole(role: OrganizationRole): boolean {
  return role === 'OWNER';
}

export function assertCanRemoveOwner(
  organizationId: string,
  activeOwnerCount: number,
): void {
  if (activeOwnerCount <= 1) {
    throw new LastOwnerRequiredError(organizationId, activeOwnerCount);
  }
}

export function assertCanDemoteOwner(
  organizationId: string,
  activeOwnerCount: number,
): void {
  assertCanRemoveOwner(organizationId, activeOwnerCount);
}
