import type { DisposalStatus } from './types';

export class InvalidDisposalPolicyError extends Error {
  readonly name = 'InvalidDisposalPolicyError';
}

export class InvalidDisposalEvaluationError extends Error {
  readonly name = 'InvalidDisposalEvaluationError';
}

export class InvalidDisposalTransitionError extends Error {
  readonly name = 'InvalidDisposalTransitionError';

  constructor(from: DisposalStatus, to: DisposalStatus) {
    super(`Disposal status cannot transition from ${from} to ${to}`);
  }
}
