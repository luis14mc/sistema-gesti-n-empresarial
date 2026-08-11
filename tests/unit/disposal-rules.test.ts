// Phase 10B — domain unit tests for disposal workflow rules.
import { describe, expect, it } from 'vitest';
import { InvalidDisposalPolicyError, InvalidDisposalTransitionError } from '@/modules/equipment-disposal/domain/errors';
import { assertDisposalTransition, canTransitionDisposal, validateDisposalPolicy } from '@/modules/equipment-disposal/domain/rules';
import type { DisposalPolicy } from '@/modules/equipment-disposal/domain/types';

const validPolicy: DisposalPolicy = {
  weights: { AGE: 25, REPAIR_COST: 30, CONDITION: 30, SECURITY: 15 },
  maxAgeYears: 5,
  repairThresholdPct: 50,
  reviewScoreThreshold: 35,
  approvalScoreThreshold: 60,
};

describe('canTransitionDisposal / assertDisposalTransition', () => {
  it('allows DRAFT → PENDING_APPROVAL and DRAFT → CANCELLED', () => {
    expect(canTransitionDisposal('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionDisposal('DRAFT', 'CANCELLED')).toBe(true);
  });

  it('allows PENDING_APPROVAL → APPROVED, REJECTED and CANCELLED', () => {
    expect(canTransitionDisposal('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransitionDisposal('PENDING_APPROVAL', 'REJECTED')).toBe(true);
    expect(canTransitionDisposal('PENDING_APPROVAL', 'CANCELLED')).toBe(true);
  });

  it('forbids leaving the terminal states', () => {
    expect(canTransitionDisposal('APPROVED', 'DRAFT')).toBe(false);
    expect(canTransitionDisposal('REJECTED', 'PENDING_APPROVAL')).toBe(false);
    expect(canTransitionDisposal('CANCELLED', 'DRAFT')).toBe(false);
  });

  it('throws InvalidDisposalTransitionError on a forbidden transition', () => {
    expect(() => assertDisposalTransition('CANCELLED', 'DRAFT')).toThrow(InvalidDisposalTransitionError);
    expect(() => assertDisposalTransition('APPROVED', 'CANCELLED')).toThrow(InvalidDisposalTransitionError);
  });

  it('does not throw on a permitted transition', () => {
    expect(() => assertDisposalTransition('DRAFT', 'PENDING_APPROVAL')).not.toThrow();
    expect(() => assertDisposalTransition('PENDING_APPROVAL', 'APPROVED')).not.toThrow();
    expect(() => assertDisposalTransition('PENDING_APPROVAL', 'CANCELLED')).not.toThrow();
  });
});

describe('validateDisposalPolicy', () => {
  it('accepts a well-formed policy', () => {
    expect(() => validateDisposalPolicy(validPolicy)).not.toThrow();
  });

  it('rejects a negative weight', () => {
    expect(() => validateDisposalPolicy({ ...validPolicy, weights: { ...validPolicy.weights, AGE: -1 } }))
      .toThrow(InvalidDisposalPolicyError);
  });

  it('rejects weights that do not sum to 100', () => {
    expect(() => validateDisposalPolicy({
      ...validPolicy,
      weights: { AGE: 25, REPAIR_COST: 30, CONDITION: 30, SECURITY: 20 },
    })).toThrow(/sum to 100/);
  });

  it('rejects a non-positive maxAgeYears', () => {
    expect(() => validateDisposalPolicy({ ...validPolicy, maxAgeYears: 0 }))
      .toThrow(/maximum age/i);
  });

  it('rejects a repairThresholdPct outside (0, 100]', () => {
    expect(() => validateDisposalPolicy({ ...validPolicy, repairThresholdPct: 0 }))
      .toThrow(/repair threshold/i);
    expect(() => validateDisposalPolicy({ ...validPolicy, repairThresholdPct: 101 }))
      .toThrow(/repair threshold/i);
  });

  it('rejects score thresholds that are inverted or out of range', () => {
    expect(() => validateDisposalPolicy({ ...validPolicy, reviewScoreThreshold: 61 }))
      .toThrow(/ordered values/i);
    expect(() => validateDisposalPolicy({ ...validPolicy, approvalScoreThreshold: 101 }))
      .toThrow(/ordered values/i);
  });
});
