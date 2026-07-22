import { describe, expect, it } from 'vitest';
import { InvalidDisposalPolicyError, InvalidDisposalTransitionError } from '../errors';
import { evaluateEquipmentDisposal } from '../evaluator';
import { assertDisposalTransition, canTransitionDisposal, validateDisposalPolicy } from '../rules';
import type { DisposalEvaluationInput, DisposalPolicy } from '../types';

const policy: DisposalPolicy = {
  weights: { AGE: 25, REPAIR_COST: 30, CONDITION: 30, SECURITY: 15 },
  maxAgeYears: 5,
  repairThresholdPct: 50,
  reviewScoreThreshold: 35,
  approvalScoreThreshold: 60,
};

const input: DisposalEvaluationInput = {
  physicalCondition: 'EXCELLENT',
  functionalCondition: 'OPERATIONAL',
  securitySupportStatus: 'SUPPORTED',
  purchaseDate: new Date('2021-01-01T00:00:00Z'),
  evaluatedAt: new Date('2026-01-01T00:00:00Z'),
  estimatedReplacementPrice: 1000,
  estimatedRepairCost: 0,
};

describe('evaluateEquipmentDisposal', () => {
  it('returns a justified disposal with rationales and risks', () => {
    const evaluation = evaluateEquipmentDisposal({
      ...input,
      physicalCondition: 'CRITICAL',
      functionalCondition: 'INOPERABLE',
      securitySupportStatus: 'VULNERABLE',
      estimatedRepairCost: 1000,
    }, policy);
    expect(evaluation).toMatchObject({ result: 'DISPOSAL_JUSTIFIED', ageInYears: 5, repairRatioPct: 100 });
    expect(evaluation.rationales).toHaveLength(5);
    expect(evaluation.riskFactors).toEqual([
      'BEYOND_USEFUL_LIFE', 'REPAIR_EXCEEDS_THRESHOLD', 'POOR_CONDITION', 'INOPERABLE', 'SECURITY_UNSUPPORTED',
    ]);
  });

  it('uses organization policy thresholds', () => {
    const repairOnly: DisposalPolicy = { ...policy, weights: { AGE: 0, REPAIR_COST: 100, CONDITION: 0, SECURITY: 0 }, repairThresholdPct: 100 };
    expect(evaluateEquipmentDisposal({ ...input, estimatedRepairCost: 200 }, repairOnly).result).toBe('KEEP_IN_SERVICE');
    expect(evaluateEquipmentDisposal({ ...input, estimatedRepairCost: 400 }, repairOnly).result).toBe('EVALUATION_REQUIRED');
    expect(evaluateEquipmentDisposal({ ...input, estimatedRepairCost: 600 }, repairOnly).result).toBe('DISPOSAL_JUSTIFIED');
  });
});

describe('disposal policy and workflow rules', () => {
  it('rejects invalid policy weights and thresholds', () => {
    expect(() => validateDisposalPolicy({ ...policy, weights: { ...policy.weights, AGE: -1, REPAIR_COST: 56 } })).toThrow(InvalidDisposalPolicyError);
    expect(() => validateDisposalPolicy({ ...policy, weights: { ...policy.weights, AGE: 26 } })).toThrow('sum to 100');
    expect(() => validateDisposalPolicy({ ...policy, reviewScoreThreshold: 61 })).toThrow('ordered values');
  });

  it('enforces the centralized workflow', () => {
    expect(canTransitionDisposal('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionDisposal('APPROVED', 'DRAFT')).toBe(false);
    expect(() => assertDisposalTransition('PENDING_APPROVAL', 'APPROVED')).not.toThrow();
    expect(() => assertDisposalTransition('CANCELLED', 'DRAFT')).toThrow(InvalidDisposalTransitionError);
  });
});
