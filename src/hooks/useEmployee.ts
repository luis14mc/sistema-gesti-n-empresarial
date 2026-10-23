'use client';

import { useQuery } from '@tanstack/react-query';
import { employeesService } from '@/services/employees.service';
import { employeeKeys } from '@/hooks/useEmployees';

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ''),
    queryFn: async () => {
      const response = await employeesService.getById(id!);
      return response.data.employee;
    },
    enabled: Boolean(id),
  });
}
