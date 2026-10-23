'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { EmployeeFilters } from '@/types';
import { readEmployeesSearchParams } from '@/components/employees/employees-search-params';

export function useEmployeesUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => readEmployeesSearchParams(searchParams), [searchParams]);

  const patchParams = useCallback(
    (patch: Record<string, string | null | undefined>, resetPage = false) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      if (resetPage) next.set('page', '1');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filtersForApi: EmployeeFilters = useMemo(
    () => ({
      search: state.search || undefined,
      departmentId: state.departmentId || undefined,
      positionId: state.positionId || undefined,
      status: state.status,
      page: state.page,
      pageSize: 20,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    }),
    [state],
  );

  return { state, patchParams, filtersForApi };
}
