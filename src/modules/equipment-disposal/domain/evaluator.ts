import { InvalidDisposalEvaluationError } from './errors';
import { validateDisposalPolicy } from './rules';
import type { DisposalEvaluation, DisposalEvaluationInput, DisposalPolicy, RiskFactor } from './types';

const PHYSICAL_SCORE = { EXCELLENT: 0, ACCEPTABLE: 20, FAIR: 50, POOR: 80, CRITICAL: 100 } as const;
const FUNCTIONAL_SCORE = { OPERATIONAL: 0, SLOW: 35, FREQUENT_FAILURES: 75, INOPERABLE: 100 } as const;
const SECURITY_SCORE = { SUPPORTED: 0, LIMITED_SUPPORT: 40, UNSUPPORTED: 80, VULNERABLE: 100 } as const;
const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const bounded = (value: number): number => Math.min(100, Math.max(0, value));

export function evaluateEquipmentDisposal(input: DisposalEvaluationInput, policy: DisposalPolicy): DisposalEvaluation {
  validateDisposalPolicy(policy);
  const purchaseTime = input.purchaseDate.getTime();
  const evaluationTime = input.evaluatedAt.getTime();
  if (!Number.isFinite(purchaseTime) || !Number.isFinite(evaluationTime) || evaluationTime < purchaseTime) {
    throw new InvalidDisposalEvaluationError('Evaluation date must be on or after purchase date');
  }
  if (
    !Number.isFinite(input.estimatedReplacementPrice) || input.estimatedReplacementPrice <= 0 ||
    !Number.isFinite(input.estimatedRepairCost) || input.estimatedRepairCost < 0
  ) {
    throw new InvalidDisposalEvaluationError('Replacement price must be positive and repair cost nonnegative');
  }

  const ageInYears = round((evaluationTime - purchaseTime) / MS_PER_YEAR);
  const repairRatioPct = round(input.estimatedRepairCost / input.estimatedReplacementPrice * 100);
  const conditionScore = (PHYSICAL_SCORE[input.physicalCondition] + FUNCTIONAL_SCORE[input.functionalCondition]) / 2;
  const factors = {
    AGE: bounded(ageInYears / policy.maxAgeYears * 100),
    REPAIR_COST: bounded(repairRatioPct / policy.repairThresholdPct * 100),
    CONDITION: conditionScore,
    SECURITY: SECURITY_SCORE[input.securitySupportStatus],
  };
  const score = round(Object.entries(policy.weights).reduce(
    (sum, [factor, weight]) => sum + factors[factor as keyof typeof factors] * weight / 100,
    0,
  ));
  const result = score >= policy.approvalScoreThreshold
    ? 'DISPOSAL_JUSTIFIED'
    : score >= policy.reviewScoreThreshold
      ? 'EVALUATION_REQUIRED'
      : 'KEEP_IN_SERVICE';
  const riskFactors: RiskFactor[] = [];
  if (ageInYears >= policy.maxAgeYears) riskFactors.push('BEYOND_USEFUL_LIFE');
  if (repairRatioPct >= policy.repairThresholdPct) riskFactors.push('REPAIR_EXCEEDS_THRESHOLD');
  if (input.physicalCondition === 'POOR' || input.physicalCondition === 'CRITICAL') riskFactors.push('POOR_CONDITION');
  if (input.functionalCondition === 'INOPERABLE') riskFactors.push('INOPERABLE');
  if (input.securitySupportStatus === 'UNSUPPORTED' || input.securitySupportStatus === 'VULNERABLE') riskFactors.push('SECURITY_UNSUPPORTED');

  return {
    score,
    result,
    ageInYears,
    repairRatioPct,
    riskFactors,
    rationales: [
      `Antigüedad: ${ageInYears} años.`,
      `Costo de reparación: ${repairRatioPct}% del reemplazo.`,
      `Condición física: ${input.physicalCondition}.`,
      `Condición funcional: ${input.functionalCondition}.`,
      `Soporte de seguridad: ${input.securitySupportStatus}.`,
    ],
  };
}
