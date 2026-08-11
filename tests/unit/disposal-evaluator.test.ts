// Phase 10B — domain unit tests for the disposal evaluator.
import { describe, expect, it } from 'vitest';
import { evaluateEquipmentDisposal } from '@/modules/equipment-disposal/domain/evaluator';
import type { DisposalEvaluationInput, DisposalPolicy } from '@/modules/equipment-disposal/domain/types';

const policy: DisposalPolicy = {
  weights: { AGE: 25, REPAIR_COST: 30, CONDITION: 30, SECURITY: 15 },
  maxAgeYears: 5,
  repairThresholdPct: 50,
  reviewScoreThreshold: 35,
  approvalScoreThreshold: 60,
};

const baseInput: DisposalEvaluationInput = {
  purchaseDate: new Date('2020-01-01T00:00:00Z'),
  evaluatedAt: new Date('2026-01-01T00:00:00Z'),
  estimatedReplacementPrice: 1000,
  estimatedRepairCost: 500,
  physicalCondition: 'FAIR',
  functionalCondition: 'FREQUENT_FAILURES',
  securitySupportStatus: 'LIMITED_SUPPORT',
};

describe('evaluateEquipmentDisposal — score calculation', () => {
  it('produces a score between 0 and 100', () => {
    const result = evaluateEquipmentDisposal(baseInput, policy);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns DISPOSAL_JUSTIFIED when the score is past the approval threshold', () => {
    const result = evaluateEquipmentDisposal(
      {
        ...baseInput,
        physicalCondition: 'CRITICAL',
        functionalCondition: 'INOPERABLE',
        securitySupportStatus: 'VULNERABLE',
        estimatedRepairCost: 1000,
      },
      policy,
    );
    expect(result.result).toBe('DISPOSAL_JUSTIFIED');
    expect(result.riskFactors).toContain('POOR_CONDITION');
    expect(result.riskFactors).toContain('INOPERABLE');
    expect(result.riskFactors).toContain('SECURITY_UNSUPPORTED');
  });

  it('returns KEEP_IN_SERVICE when the score is below the review threshold', () => {
    const result = evaluateEquipmentDisposal(
      {
        ...baseInput,
        purchaseDate: new Date('2025-12-01T00:00:00Z'),
        evaluatedAt: new Date('2026-01-01T00:00:00Z'),
        estimatedRepairCost: 10,
        physicalCondition: 'EXCELLENT',
        functionalCondition: 'OPERATIONAL',
        securitySupportStatus: 'SUPPORTED',
      },
      policy,
    );
    expect(result.result).toBe('KEEP_IN_SERVICE');
    expect(result.riskFactors).not.toContain('BEYOND_USEFUL_LIFE');
  });

  it('flags BEYOND_USEFUL_LIFE when the age exceeds the policy maxAgeYears', () => {
    const result = evaluateEquipmentDisposal(
      {
        ...baseInput,
        purchaseDate: new Date('2010-01-01T00:00:00Z'),
        evaluatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      policy,
    );
    expect(result.riskFactors).toContain('BEYOND_USEFUL_LIFE');
  });

  it('flags REPAIR_EXCEEDS_THRESHOLD when the repair-to-replacement ratio is too high', () => {
    const result = evaluateEquipmentDisposal(
      { ...baseInput, estimatedRepairCost: 1000, estimatedReplacementPrice: 1000 },
      policy,
    );
    expect(result.riskFactors).toContain('REPAIR_EXCEEDS_THRESHOLD');
  });
});

describe('evaluateEquipmentDisposal — input validation', () => {
  it('throws when the evaluation date is before the purchase date', () => {
    expect(() => evaluateEquipmentDisposal(
      { ...baseInput, purchaseDate: new Date('2026-06-01T00:00:00Z'), evaluatedAt: new Date('2026-01-01T00:00:00Z') },
      policy,
    )).toThrow(/after purchase/i);
  });

  it('throws when the replacement price is non-positive', () => {
    expect(() => evaluateEquipmentDisposal(
      { ...baseInput, estimatedReplacementPrice: 0 },
      policy,
    )).toThrow(/replacement price/i);
  });

  it('throws when the repair cost is negative', () => {
    expect(() => evaluateEquipmentDisposal(
      { ...baseInput, estimatedRepairCost: -1 },
      policy,
    )).toThrow(/replacement price/i);
  });
});
