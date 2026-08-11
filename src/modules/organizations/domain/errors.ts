import type { MembershipStatus, OnboardingStatus, OrganizationStatus } from '@prisma/client';

export class OrganizationNotFoundError extends Error {
  readonly name = 'OrganizationNotFoundError';
  readonly code = 'ORGANIZATION_NOT_FOUND';
  readonly status = 404;
  readonly details: Readonly<{ organizationId: string }>;
  constructor(organizationId: string) {
    super(`Organization ${organizationId} was not found.`);
    this.details = Object.freeze({ organizationId });
  }
}

export class OrganizationNotActiveError extends Error {
  readonly name = 'OrganizationNotActiveError';
  readonly code = 'ORGANIZATION_NOT_ACTIVE';
  readonly status = 409;
  readonly details: Readonly<{ organizationId: string; status: OrganizationStatus }>;
  constructor(organizationId: string, status: OrganizationStatus) {
    super(`Organization ${organizationId} is not active (current status: ${status}).`);
    this.details = Object.freeze({ organizationId, status });
  }
}

export class OrganizationSuspendedError extends Error {
  readonly name = 'OrganizationSuspendedError';
  readonly code = 'ORGANIZATION_SUSPENDED';
  readonly status = 423;
  readonly details: Readonly<{ organizationId: string }>;
  constructor(organizationId: string) {
    super(`Organization ${organizationId} is suspended and cannot perform this operation.`);
    this.details = Object.freeze({ organizationId });
  }
}

export class OrganizationArchivedError extends Error {
  readonly name = 'OrganizationArchivedError';
  readonly code = 'ORGANIZATION_ARCHIVED';
  readonly status = 409;
  readonly details: Readonly<{ organizationId: string }>;
  constructor(organizationId: string) {
    super(`Organization ${organizationId} is archived and is read-only.`);
    this.details = Object.freeze({ organizationId });
  }
}

export class OrganizationClosureRequestedError extends Error {
  readonly name = 'OrganizationClosureRequestedError';
  readonly code = 'ORGANIZATION_CLOSURE_REQUESTED';
  readonly status = 409;
  readonly details: Readonly<{ organizationId: string }>;
  constructor(organizationId: string) {
    super(`Organization ${organizationId} has a pending closure request.`);
    this.details = Object.freeze({ organizationId });
  }
}

export class InvalidOrganizationTransitionError extends Error {
  readonly name = 'InvalidOrganizationTransitionError';
  readonly code = 'INVALID_ORGANIZATION_TRANSITION';
  readonly status = 409;
  readonly details: Readonly<{ from: string; to: string; entity: 'organization' | 'membership' | 'onboarding' }>;
  constructor(from: string, to: string, entity: 'organization' | 'membership' | 'onboarding' = 'organization') {
    super(`${entity} cannot transition from ${from} to ${to}.`);
    this.details = Object.freeze({ from, to, entity });
  }
}

export class LastOwnerRequiredError extends Error {
  readonly name = 'LastOwnerRequiredError';
  readonly code = 'LAST_OWNER_REQUIRED';
  readonly status = 409;
  readonly details: Readonly<{ organizationId: string; activeOwnerCount: number }>;
  constructor(organizationId: string, activeOwnerCount: number) {
    super('Every active organization must have at least one active owner.');
    this.details = Object.freeze({ organizationId, activeOwnerCount });
  }
}

export class OnboardingIncompleteError extends Error {
  readonly name = 'OnboardingIncompleteError';
  readonly code = 'ONBOARDING_INCOMPLETE';
  readonly status = 409;
  readonly details: Readonly<{ organizationId: string; onboardingStatus: OnboardingStatus }>;
  constructor(organizationId: string, onboardingStatus: OnboardingStatus) {
    super(`Organization ${organizationId} cannot be activated while onboarding is ${onboardingStatus}.`);
    this.details = Object.freeze({ organizationId, onboardingStatus });
  }
}

export class MembershipNotFoundError extends Error {
  readonly name = 'MembershipNotFoundError';
  readonly code = 'MEMBERSHIP_NOT_FOUND';
  readonly status = 404;
  readonly details: Readonly<{ organizationId: string; membershipId: string }>;
  constructor(organizationId: string, membershipId: string) {
    super(`Membership ${membershipId} was not found in organization ${organizationId}.`);
    this.details = Object.freeze({ organizationId, membershipId });
  }
}

export class MembershipAlreadyActiveError extends Error {
  readonly name = 'MembershipAlreadyActiveError';
  readonly code = 'MEMBERSHIP_ALREADY_ACTIVE';
  readonly status = 409;
  readonly details: Readonly<{ membershipId: string; status: MembershipStatus }>;
  constructor(membershipId: string, status: MembershipStatus) {
    super(`Membership ${membershipId} is already ${status}.`);
    this.details = Object.freeze({ membershipId, status });
  }
}

export function isOrganizationDomainError(error: unknown): boolean {
  return error instanceof Error && [
    OrganizationNotFoundError,
    OrganizationNotActiveError,
    OrganizationSuspendedError,
    OrganizationArchivedError,
    OrganizationClosureRequestedError,
    InvalidOrganizationTransitionError,
    LastOwnerRequiredError,
    OnboardingIncompleteError,
    MembershipNotFoundError,
    MembershipAlreadyActiveError,
  ].some((constructor) => error instanceof constructor);
}
