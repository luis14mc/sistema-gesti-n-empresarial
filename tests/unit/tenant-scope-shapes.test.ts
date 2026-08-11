// Phase 10B — domain unit tests for the oficios / disposal tenant scopes.
import { describe, expect, it } from 'vitest';
import {
  disposalDocumentScope,
  disposalPolicyScope,
  disposalScope,
  disposalSequenceScope,
} from '@/modules/equipment-disposal/infrastructure/tenant-scope';
import {
  oficioBatchScope,
  oficioBatchTenantScope,
  oficioDocumentScope,
  oficioDocumentTenantScope,
  oficioScope,
  oficioSequenceScope,
  oficioTenantScope,
  oficioUserAccessScope,
} from '@/modules/oficios/infrastructure/tenant-scope';

describe('disposal tenant scope', () => {
  it('isolates disposal rows by organizationId and id', () => {
    expect(disposalScope('org-a', 'd-1')).toEqual({ id: 'd-1', organizationId: 'org-a' });
    expect(disposalScope('org-a', 'd-1')).not.toEqual(disposalScope('org-b', 'd-1'));
  });

  it('requires both organizationId and disposalId when scoping documents', () => {
    expect(disposalDocumentScope('org-a', 'd-1', 'doc-1')).toEqual({
      id: 'doc-1',
      disposalId: 'd-1',
      organizationId: 'org-a',
    });
  });

  it('isolates disposal policies and sequences by organization', () => {
    expect(disposalPolicyScope('org-a')).not.toEqual(disposalPolicyScope('org-b'));
    expect(disposalSequenceScope('org-a', 2026).organizationId_documentType_year.documentType).toBe('EQUIPMENT_DISPOSAL');
  });

  it('keeps sequence uniqueness scoped per organization and year', () => {
    const a = disposalSequenceScope('org-a', 2026);
    const b = disposalSequenceScope('org-b', 2026);
    expect(a).not.toEqual(b);
  });
});

describe('oficios tenant scope', () => {
  it('isolates oficio lists by organizationId', () => {
    expect(oficioTenantScope('org-a')).toEqual({ organizationId: 'org-a' });
  });

  it('isolates oficio detail by organizationId and id', () => {
    expect(oficioScope('org-a', 'o-1')).toEqual({ id: 'o-1', organizationId: 'org-a' });
    expect(oficioScope('org-a', 'o-1')).not.toEqual(oficioScope('org-b', 'o-1'));
  });

  it('requires the oficio to belong to the same organization when accessing documents', () => {
    const scope = oficioDocumentScope('org-a', 'o-1');
    expect(scope).toMatchObject({ oficioId: 'o-1', oficio: { id: 'o-1', organizationId: 'org-a' } });
  });

  it('scopes document lists through the parent oficio organization', () => {
    expect(oficioDocumentTenantScope('org-a')).toEqual({ oficio: { organizationId: 'org-a' } });
  });

  it('isolates import batches by organization and id', () => {
    expect(oficioBatchScope('org-a', 'b-1')).toEqual({ id: 'b-1', organizationId: 'org-a' });
    expect(oficioBatchTenantScope('org-a')).toEqual({ organizationId: 'org-a' });
  });

  it('scopes user access to oficio createdById or recipient email', () => {
    const scope = oficioUserAccessScope('user-1', 'user@example.com');
    expect(scope).toMatchObject({
      OR: [
        { createdById: 'user-1' },
        { recipient: { contains: 'user@example.com', mode: 'insensitive' } },
      ],
    });
  });

  it('isolates sequence scope by organization', () => {
    const a = oficioSequenceScope('org-a', 2026);
    const b = oficioSequenceScope('org-b', 2026);
    expect(a.organizationId_documentType_year.documentType).toBe('OFFICE_DOCUMENT');
    expect(a).not.toEqual(b);
  });
});
