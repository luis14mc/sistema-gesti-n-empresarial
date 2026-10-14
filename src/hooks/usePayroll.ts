'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollService, type PayslipPreview } from '@/services/payroll.service';
import type { ApiSuccess } from '@/platform/api/response';

export const payrollKeys = {
  all: ['payroll'] as const,
  employees: (filters?: Record<string, unknown>) => [...payrollKeys.all, 'employees', filters] as const,
  payslips: (filters?: Record<string, unknown>) => [...payrollKeys.all, 'payslips', filters] as const,
  settings: () => [...payrollKeys.all, 'settings'] as const,
  isr: (year: number) => [...payrollKeys.all, 'isr', year] as const,
};

export function usePayrollEmployees(filters?: { search?: string; payrollEnabled?: boolean; page?: number }) {
  const query = useQuery({
    queryKey: payrollKeys.employees(filters),
    queryFn: async () => (await payrollService.listEmployees(filters as Record<string, unknown>)).data.data,
  });
  return {
    employees: query.data?.employees ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function usePayrollPayslips(filters?: { year?: number; month?: number; page?: number }) {
  const query = useQuery({
    queryKey: payrollKeys.payslips(filters),
    queryFn: async () => (await payrollService.listPayslips(filters as Record<string, unknown>)).data.data,
  });
  return {
    payslips: query.data?.payslips ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function usePayrollSettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: payrollKeys.settings(),
    queryFn: async () => (await payrollService.getSettings()).data.data,
  });
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, number>) => payrollService.patchSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.settings() }),
  });
  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export function usePayrollMutations() {
  const queryClient = useQueryClient();
  const previewMutation = useMutation({
    mutationFn: (data: { employeeId: string; payMonth: string }) => payrollService.preview(data),
  });
  const generateMutation = useMutation({
    mutationFn: (data: { employeeId: string; payMonth: string }) => payrollService.generatePayslip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.payslips() });
    },
  });
  const batchMutation = useMutation({
    mutationFn: (data: { payMonth: string; employeeIds?: string[] }) => payrollService.batchGenerate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.payslips() });
    },
  });
  const patchEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      payrollService.patchEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.employees() });
    },
  });
  return {
    preview: previewMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    previewData: (previewMutation.data?.data as ApiSuccess<PayslipPreview> | undefined)?.data,
    generate: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    batchGenerate: batchMutation.mutateAsync,
    isBatching: batchMutation.isPending,
    patchEmployee: patchEmployeeMutation.mutateAsync,
    isPatching: patchEmployeeMutation.isPending,
  };
}
