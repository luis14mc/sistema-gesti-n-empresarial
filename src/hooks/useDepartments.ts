'use client';

import { useQuery } from '@tanstack/react-query';
import { apiHelpers } from '@/utils/api';

export interface DepartmentWithPositions {
  id: string;
  name: string;
  description: string | null;
  positions: { id: string; name: string }[];
}

export function useDepartments() {
  const query = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiHelpers.get<{ departments: DepartmentWithPositions[] }>('/api/departments');
      return res.data.departments;
    },
  });

  return {
    departments: query.data ?? [],
    isLoading: query.isLoading,
  };
}
