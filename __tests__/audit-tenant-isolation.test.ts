import { describe, expect, it } from 'vitest';
import {
  auditChildScope,
  auditRecordScope,
  auditScope,
  correctiveActionScope,
} from '@/modules/audits/infrastructure/tenant-scope';
import { auditWhere, correctiveActionWhere } from '@/modules/audits/infrastructure/repository';

describe('audit tenant ownership', () => {
  it('scopes aggregate roots and repository predicates by organization', () => {
    expect(auditWhere('org-a', { id: 'audit-1' })).toEqual({ id: 'audit-1', organizationId: 'org-a' });
    expect(correctiveActionWhere('org-a', { id: 'action-1' })).toEqual({ id: 'action-1', organizationId: 'org-a' });
    expect(auditScope('org-a', 'same-id')).not.toEqual(auditScope('org-b', 'same-id'));
    expect(correctiveActionScope('org-a', 'same-id')).not.toEqual(correctiveActionScope('org-b', 'same-id'));
  });

  it('derives child ownership through the scoped audit', () => {
    expect(auditChildScope('org-a', 'audit-1', 'item-1')).toEqual({
      id: 'item-1', auditId: 'audit-1', audit: { id: 'audit-1', organizationId: 'org-a' },
    });
  });

  it('scopes audit records by organization', () => {
    expect(auditRecordScope('org-a')).not.toEqual(auditRecordScope('org-b'));
  });
});
