// Phase 10B — domain unit tests for organization lifecycle rules.
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MEMBERSHIP_TRANSITIONS,
  ALLOWED_ORGANIZATION_TRANSITIONS,
  ONBOARDING_TRANSITIONS,
  assertOnboardingReadyForActivation,
  assertOrganizationTransition,
  canTransitionMembership,
  canTransitionOrganization,
} from '@/modules/organizations/domain/rules';
import {
  InvalidOrganizationTransitionError,
  OnboardingIncompleteError,
} from '@/modules/organizations/domain/errors';

describe('ALLOWED_ORGANIZATION_TRANSITIONS', () => {
  it('allows the documented lifecycle moves', () => {
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.PROVISIONING).toEqual(
      expect.arrayContaining(['ACTIVE', 'ARCHIVED', 'PENDING_DELETION']),
    );
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.ACTIVE).toEqual(
      expect.arrayContaining(['SUSPENDED', 'ARCHIVED', 'PENDING_DELETION']),
    );
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.SUSPENDED).toEqual(
      expect.arrayContaining(['ACTIVE', 'ARCHIVED', 'PENDING_DELETION']),
    );
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.ARCHIVED).toEqual(
      expect.arrayContaining(['ACTIVE', 'PENDING_DELETION']),
    );
    expect(ALLOWED_ORGANIZATION_TRANSITIONS.PENDING_DELETION).toEqual([]);
  });

  it('forbids resurrecting from PENDING_DELETION', () => {
    expect(canTransitionOrganization('PENDING_DELETION', 'ACTIVE')).toBe(false);
    expect(canTransitionOrganization('PENDING_DELETION', 'SUSPENDED')).toBe(false);
  });

  it('forbids skipping straight from PROVISIONING to SUSPENDED', () => {
    expect(canTransitionOrganization('PROVISIONING', 'SUSPENDED')).toBe(false);
  });
});

describe('assertOrganizationTransition', () => {
  it('does not throw on allowed moves', () => {
    expect(() => assertOrganizationTransition('PROVISIONING', 'ACTIVE')).not.toThrow();
    expect(() => assertOrganizationTransition('ACTIVE', 'SUSPENDED')).not.toThrow();
    expect(() => assertOrganizationTransition('SUSPENDED', 'ACTIVE')).not.toThrow();
  });

  it('throws InvalidOrganizationTransitionError on forbidden moves', () => {
    expect(() => assertOrganizationTransition('PENDING_DELETION', 'ACTIVE')).toThrow(InvalidOrganizationTransitionError);
    expect(() => assertOrganizationTransition('PROVISIONING', 'SUSPENDED')).toThrow(InvalidOrganizationTransitionError);
  });
});

describe('ALLOWED_MEMBERSHIP_TRANSITIONS', () => {
  it('allows invitation from INVITED to ACTIVE / REVOKED', () => {
    expect(canTransitionMembership('INVITED', 'ACTIVE')).toBe(true);
    expect(canTransitionMembership('INVITED', 'REVOKED')).toBe(true);
    expect(canTransitionMembership('INVITED', 'SUSPENDED')).toBe(false);
  });

  it('allows suspending or revoking an ACTIVE membership', () => {
    expect(canTransitionMembership('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransitionMembership('ACTIVE', 'REVOKED')).toBe(true);
  });

  it('forbids resuscitating a REVOKED membership', () => {
    expect(canTransitionMembership('REVOKED', 'ACTIVE')).toBe(false);
    expect(canTransitionMembership('REVOKED', 'SUSPENDED')).toBe(false);
  });

  it('treats REVOKED as terminal', () => {
    expect(ALLOWED_MEMBERSHIP_TRANSITIONS.REVOKED).toEqual([]);
  });
});

describe('ONBOARDING_TRANSITIONS', () => {
  it('allows the documented onboarding moves', () => {
    expect(ONBOARDING_TRANSITIONS.PENDING).toEqual(expect.arrayContaining(['IN_PROGRESS', 'SKIPPED']));
    expect(ONBOARDING_TRANSITIONS.IN_PROGRESS).toEqual(expect.arrayContaining(['COMPLETED', 'SKIPPED', 'PENDING']));
    expect(ONBOARDING_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ONBOARDING_TRANSITIONS.SKIPPED).toEqual(expect.arrayContaining(['IN_PROGRESS', 'COMPLETED']));
  });
});

describe('assertOnboardingReadyForActivation', () => {
  it('does not throw when onboarding is COMPLETED', () => {
    expect(() => assertOnboardingReadyForActivation('org-1', 'COMPLETED')).not.toThrow();
  });

  it('throws OnboardingIncompleteError when onboarding is PENDING or IN_PROGRESS', () => {
    expect(() => assertOnboardingReadyForActivation('org-1', 'PENDING')).toThrow(OnboardingIncompleteError);
    expect(() => assertOnboardingReadyForActivation('org-1', 'IN_PROGRESS')).toThrow(OnboardingIncompleteError);
  });

  it('treats SKIPPED as ready for activation (the operator consciously opted out)', () => {
    expect(() => assertOnboardingReadyForActivation('org-1', 'SKIPPED')).not.toThrow();
  });
});
