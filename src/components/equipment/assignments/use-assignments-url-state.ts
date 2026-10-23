'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AssignmentFilters } from '@/types';
import type { AssignmentsTab } from '@/components/equipment/assignments/constants';
import { readAssignmentsSearchParams } from '@/components/equipment/assignments/assignments-search-params';

export function useAssignmentsUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(() => readAssignmentsSearchParams(searchParams), [searchParams]);

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
      if (resetPage) {
        next.set('page', '1');
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filtersForApi: AssignmentFilters = useMemo(
    () => ({
      tab: state.tab,
      search: state.search || undefined,
      departmentId: state.departmentId || undefined,
      equipmentCategory: state.equipmentCategory || undefined,
      assignedFrom: state.assignedFrom || undefined,
      assignedTo: state.assignedTo || undefined,
      page: state.page,
      pageSize: 20,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      summary: '1',
    }),
    [state],
  );

  return { state, patchParams, filtersForApi };
}
