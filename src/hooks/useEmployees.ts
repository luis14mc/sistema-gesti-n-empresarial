'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@/services/employees.service';
import type { EmployeeFilters, CreateEmployeeData, UpdateEmployeeData } from '@/types';

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters?: EmployeeFilters) => [...employeeKeys.lists(), filters] as const,
  detail: (id: string) => [...employeeKeys.all, 'detail', id] as const,
};

export function useEmployees(filters?: EmployeeFilters) {
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: async () => {
      const response = await employeesService.list(filters);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateEmployeeData) => {
      const response = await employeesService.create(data);
      return response.data.employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeData }) => {
      const response = await employeesService.update(id, data);
      return response.data.employee;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(variables.id) });
    },
  });

  return {
    employees: employeesQuery.data?.employees ?? [],
    total: employeesQuery.data?.total ?? 0,
    isLoading: employeesQuery.isLoading,
    createEmployee: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateEmployee: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    refetch: employeesQuery.refetch,
  };
}
