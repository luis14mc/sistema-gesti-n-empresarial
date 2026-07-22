import { describe, expect, it } from 'vitest';
import {
  disposalDocumentScope,
  disposalPolicyScope,
  disposalScope,
  disposalSequenceScope,
} from '@/modules/equipment-disposal/infrastructure/tenant-scope';

describe('equipment disposal tenant ownership', () => {
  it('scopes disposal reads and writes by organization', () => {
    expect(disposalScope('org-a', 'same-id')).toEqual({ organizationId: 'org-a', id: 'same-id' });
    expect(disposalScope('org-b', 'same-id')).not.toEqual(disposalScope('org-a', 'same-id'));
  });

  it('scopes document endpoints by organization and parent disposal', () => {
    expect(disposalDocumentScope('org-a', 'disposal-a', 'document-1')).toEqual({
      organizationId: 'org-a', disposalId: 'disposal-a', id: 'document-1',
    });
  });

  it('isolates policies by organization', () => {
    expect(disposalPolicyScope('org-a')).not.toEqual(disposalPolicyScope('org-b'));
  });

  it('isolates annual sequences by organization', () => {
    const a = disposalSequenceScope('org-a', 2026);
    const b = disposalSequenceScope('org-b', 2026);
    expect(a.organizationId_documentType_year.documentType).toBe('EQUIPMENT_DISPOSAL');
    expect(a).not.toEqual(b);
  });

  it('does not accept an organization field from disposal input', async () => {
    const { disposalEvaluationSchema } = await import('@/modules/equipment-disposal/presentation/schemas/disposal');
    const parsed = disposalEvaluationSchema.parse({
      organizationId: 'org-attacker', equipmentId: 'equipment-1', purchaseDate: '2020-01-01',
      purchasePrice: 100, estimatedRepairCost: 10, estimatedReplacementPrice: 200,
      physicalCondition: 'FAIR', functionalCondition: 'SLOW', securitySupportStatus: 'LIMITED_SUPPORT',
    });
    expect('organizationId' in parsed).toBe(false);
  });
});
