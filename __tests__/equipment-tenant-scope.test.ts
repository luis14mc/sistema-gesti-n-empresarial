import { describe, expect, it } from 'vitest';
import { assignmentScope, equipmentScope, maintenanceScope } from '@/modules/equipment/tenant';

describe('equipment tenant scopes', () => {
  it('scopes equipment directly to the organization', () => {
    expect(equipmentScope('org-a')).toEqual({ organizationId: 'org-a' });
  });

  it('scopes assignments directly and through their equipment', () => {
    expect(assignmentScope('org-a')).toEqual({
      organizationId: 'org-a',
      equipment: { organizationId: 'org-a' },
    });
  });

  it('scopes maintenance through equipment ownership', () => {
    expect(maintenanceScope('org-a')).toEqual({ equipment: { organizationId: 'org-a' } });
  });
});
