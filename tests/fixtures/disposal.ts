let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetDisposalFactoryCounters(): void {
  counter = 0;
}

export type TestDisposal = Readonly<{
  id: string;
  organizationId: string;
  equipmentId: string;
  evaluatorId: string;
  approverId: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  justification: string;
  physicalCondition: 'EXCELLENT' | 'ACCEPTABLE' | 'FAIR' | 'POOR' | 'CRITICAL';
  functionalCondition: 'OPERATIONAL' | 'SLOW' | 'FREQUENT_FAILURES' | 'INOPERABLE';
  securitySupportStatus: 'SUPPORTED' | 'LIMITED_SUPPORT' | 'UNSUPPORTED' | 'VULNERABLE';
  purchaseDate: Date;
  evaluatedAt: Date;
  estimatedReplacementPrice: number;
  estimatedRepairCost: number;
  version: number;
}>;

export function createTestDisposal(overrides: Partial<TestDisposal> & { organizationId: string; equipmentId: string; evaluatorId: string }): TestDisposal {
  const id = overrides.id ?? nextId('disp');
  return {
    id,
    organizationId: overrides.organizationId,
    equipmentId: overrides.equipmentId,
    evaluatorId: overrides.evaluatorId,
    approverId: overrides.approverId ?? null,
    status: overrides.status ?? 'DRAFT',
    justification: overrides.justification ?? `Justification for ${id}`,
    physicalCondition: overrides.physicalCondition ?? 'FAIR',
    functionalCondition: overrides.functionalCondition ?? 'FREQUENT_FAILURES',
    securitySupportStatus: overrides.securitySupportStatus ?? 'LIMITED_SUPPORT',
    purchaseDate: overrides.purchaseDate ?? new Date('2020-06-01T00:00:00Z'),
    evaluatedAt: overrides.evaluatedAt ?? new Date('2026-03-15T00:00:00Z'),
    estimatedReplacementPrice: overrides.estimatedReplacementPrice ?? 2200,
    estimatedRepairCost: overrides.estimatedRepairCost ?? 1800,
    version: overrides.version ?? 1,
  };
}
