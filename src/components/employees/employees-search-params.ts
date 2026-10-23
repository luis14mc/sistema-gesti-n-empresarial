import type { EmployeeFilters } from '@/types';

export type EmployeesUrlState = {
  search: string;
  departmentId: string;
  positionId: string;
  status: 'active' | 'inactive' | 'all';
  page: number;
  sortBy: NonNullable<EmployeeFilters['sortBy']>;
  sortDir: NonNullable<EmployeeFilters['sortDir']>;
};

export function readEmployeesSearchParams(searchParams: URLSearchParams): EmployeesUrlState {
  const statusRaw = searchParams.get('status');
  const status =
    statusRaw === 'inactive' || statusRaw === 'all' ? statusRaw : 'active';
  return {
    search: searchParams.get('search') ?? '',
    departmentId: searchParams.get('departmentId') ?? '',
    positionId: searchParams.get('positionId') ?? '',
    status,
    page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
    sortBy: (searchParams.get('sortBy') as EmployeesUrlState['sortBy']) ?? 'name',
    sortDir: searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc',
  };
}
