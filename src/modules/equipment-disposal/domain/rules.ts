import { InvalidDisposalPolicyError, InvalidDisposalTransitionError } from './errors';
import type { DisposalPolicy, DisposalStatus, EvaluationFactor } from './types';

const FACTORS: EvaluationFactor[] = ['AGE', 'REPAIR_COST', 'CONDITION', 'SECURITY'];

export const ALLOWED_DISPOSAL_TRANSITIONS: Readonly<Record<DisposalStatus, readonly DisposalStatus[]>> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function validateDisposalPolicy(policy: DisposalPolicy): void {
  for (const factor of FACTORS) {
    const weight = policy.weights[factor];
    if (!Number.isFinite(weight) || weight < 0) {
      throw new InvalidDisposalPolicyError(`${factor} weight must be nonnegative`);
    }
  }
  if (FACTORS.reduce((sum, factor) => sum + policy.weights[factor], 0) !== 100) {
    throw new InvalidDisposalPolicyError('Policy weights must sum to 100');
  }
  if (!Number.isFinite(policy.maxAgeYears) || policy.maxAgeYears <= 0) {
    throw new InvalidDisposalPolicyError('Maximum age must be greater than zero');
  }
  if (!Number.isFinite(policy.repairThresholdPct) || policy.repairThresholdPct <= 0 || policy.repairThresholdPct > 100) {
    throw new InvalidDisposalPolicyError('Repair threshold must be in the range (0, 100]');
  }
  if (
    !Number.isFinite(policy.reviewScoreThreshold) ||
    !Number.isFinite(policy.approvalScoreThreshold) ||
    policy.reviewScoreThreshold < 0 ||
    policy.approvalScoreThreshold > 100 ||
    policy.reviewScoreThreshold > policy.approvalScoreThreshold
  ) {
    throw new InvalidDisposalPolicyError('Score thresholds must be ordered values in the range [0, 100]');
  }
}

export function canTransitionDisposal(from: DisposalStatus, to: DisposalStatus): boolean {
  return ALLOWED_DISPOSAL_TRANSITIONS[from].includes(to);
}

export function assertDisposalTransition(from: DisposalStatus, to: DisposalStatus): void {
  if (!canTransitionDisposal(from, to)) throw new InvalidDisposalTransitionError(from, to);
}
