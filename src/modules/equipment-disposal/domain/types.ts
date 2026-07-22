export const PHYSICAL_CONDITIONS = ['EXCELLENT', 'ACCEPTABLE', 'FAIR', 'POOR', 'CRITICAL'] as const;
export type PhysicalCondition = (typeof PHYSICAL_CONDITIONS)[number];

export const FUNCTIONAL_CONDITIONS = ['OPERATIONAL', 'SLOW', 'FREQUENT_FAILURES', 'INOPERABLE'] as const;
export type FunctionalCondition = (typeof FUNCTIONAL_CONDITIONS)[number];

export const SECURITY_SUPPORT_STATUSES = ['SUPPORTED', 'LIMITED_SUPPORT', 'UNSUPPORTED', 'VULNERABLE'] as const;
export type SecuritySupportStatus = (typeof SECURITY_SUPPORT_STATUSES)[number];

export const DISPOSAL_RESULTS = ['DISPOSAL_JUSTIFIED', 'EVALUATION_REQUIRED', 'KEEP_IN_SERVICE'] as const;
export type DisposalResult = (typeof DISPOSAL_RESULTS)[number];

export const DISPOSAL_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type DisposalStatus = (typeof DISPOSAL_STATUSES)[number];

export type EvaluationFactor = 'AGE' | 'REPAIR_COST' | 'CONDITION' | 'SECURITY';

export interface DisposalPolicy {
  weights: Record<EvaluationFactor, number>;
  maxAgeYears: number;
  repairThresholdPct: number;
  approvalScoreThreshold: number;
  reviewScoreThreshold: number;
}

export interface DisposalEvaluationInput {
  physicalCondition: PhysicalCondition;
  functionalCondition: FunctionalCondition;
  securitySupportStatus: SecuritySupportStatus;
  purchaseDate: Date;
  evaluatedAt: Date;
  estimatedReplacementPrice: number;
  estimatedRepairCost: number;
}

export type RiskFactor =
  | 'BEYOND_USEFUL_LIFE'
  | 'REPAIR_EXCEEDS_THRESHOLD'
  | 'POOR_CONDITION'
  | 'INOPERABLE'
  | 'SECURITY_UNSUPPORTED';

export interface DisposalEvaluation {
  score: number;
  result: DisposalResult;
  rationales: string[];
  ageInYears: number;
  repairRatioPct: number;
  riskFactors: RiskFactor[];
}
