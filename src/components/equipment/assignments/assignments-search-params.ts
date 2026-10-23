import type { AssignmentFilters } from '@/types';
import type { AssignmentsTab } from '@/components/equipment/assignments/constants';

export function readAssignmentsSearchParams(searchParams: URLSearchParams) {
  const tab = (searchParams.get('tab') as AssignmentsTab | null) ?? 'active';
  return {
    tab,
    search: searchParams.get('search') ?? '',
    departmentId: searchParams.get('departmentId') ?? '',
    equipmentCategory: searchParams.get('equipmentCategory') ?? '',
    assignedFrom: searchParams.get('assignedFrom') ?? '',
    assignedTo: searchParams.get('assignedTo') ?? '',
    page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
    sortBy: (searchParams.get('sortBy') as AssignmentFilters['sortBy']) ?? 'assignedDate',
    sortDir: (searchParams.get('sortDir') as AssignmentFilters['sortDir']) ?? 'desc',
  };
}
