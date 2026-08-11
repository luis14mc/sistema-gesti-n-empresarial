import { describe, expect, it } from 'vitest';
import {
  oficioBatchScope,
  oficioDocumentScope,
  oficioDocumentTenantScope,
  oficioScope,
  oficioSequenceScope,
  oficioTenantScope,
  oficioUserAccessScope,
} from '@/modules/oficios/infrastructure/tenant-scope';

describe('oficios tenant ownership', () => {
  it('scopes lists and aggregate ids by organization', () => {
    expect(oficioTenantScope('org-a')).toEqual({ organizationId: 'org-a' });
    expect(oficioScope('org-a', 'same-id')).toEqual({ organizationId: 'org-a', id: 'same-id' });
    expect(oficioScope('org-a', 'same-id')).not.toEqual(oficioScope('org-b', 'same-id'));
  });

  it('scopes documents through their parent oficio', () => {
    expect(oficioDocumentScope('org-a', 'oficio-1')).toEqual({
      oficioId: 'oficio-1',
      oficio: { id: 'oficio-1', organizationId: 'org-a' },
    });
    expect(oficioDocumentTenantScope('org-a')).toEqual({ oficio: { organizationId: 'org-a' } });
  });

  it('scopes import batch ids by organization', () => {
    expect(oficioBatchScope('org-a', 'same-id')).not.toEqual(oficioBatchScope('org-b', 'same-id'));
  });

  it('keeps user authorization as an AND condition beside text search', () => {
    const authorization = oficioUserAccessScope('user-1', 'user@example.com');
    const where = {
      ...oficioTenantScope('org-a'),
      AND: [authorization, { OR: [{ subject: { contains: 'needle' } }] }],
    };
    expect(oficioTenantScope('org-a')).toMatchObject({ organizationId: 'org-a' });
    expect(where.AND).toContain(authorization);
    expect(where.AND).toHaveLength(2);
  });

  it('isolates atomic office number sequences by organization', () => {
    const a = oficioSequenceScope('org-a', 2026);
    const b = oficioSequenceScope('org-b', 2026);
    expect(a.organizationId_documentType_year.documentType).toBe('OFFICE_DOCUMENT');
    expect(a).not.toEqual(b);
  });
});
