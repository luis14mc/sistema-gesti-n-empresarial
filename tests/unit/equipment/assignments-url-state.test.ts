import { describe, expect, it } from 'vitest';
import { readAssignmentsSearchParams } from '@/components/equipment/assignments/assignments-search-params';

describe('assignments URL params', () => {
  it('refleja filtros y pestaña en query string', () => {
    const params = new URLSearchParams(
      'tab=history&search=ana&departmentId=dep-1&equipmentCategory=LAPTOP&assignedFrom=2026-01-01&page=2&sortBy=employee&sortDir=asc',
    );
    const parsed = readAssignmentsSearchParams(params);
    expect(parsed).toEqual({
      tab: 'history',
      search: 'ana',
      departmentId: 'dep-1',
      equipmentCategory: 'LAPTOP',
      assignedFrom: '2026-01-01',
      assignedTo: '',
      page: 2,
      sortBy: 'employee',
      sortDir: 'asc',
    });
  });
});
